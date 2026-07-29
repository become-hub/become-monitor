package com.gabriele.muscogiuri.becomemonitor.muse

import android.annotation.SuppressLint
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothStatusCodes
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Muse online streaming: EEG (4ch) + optional PPG, throttled JS emits + simple band powers.
 */
class MuseStreamManager {

    companion object {
        private const val TAG = "MuseStreamManager"
        private const val EMIT_INTERVAL_MS = 100L
        private const val BAND_WINDOW = 256
    }

    data class EegSnapshot(
        val tp9: Double,
        val af7: Double,
        val af8: Double,
        val tp10: Double,
        val sampleCount: Int,
    )

    data class BandPowers(
        val delta: Double,
        val theta: Double,
        val alpha: Double,
        val beta: Double,
        val gamma: Double,
    )

    data class PpgSnapshot(
        val ambient: Double,
        val infrared: Double,
        val red: Double,
    )

    var onEegSnapshot: ((EegSnapshot) -> Unit)? = null
    var onBandPowers: ((BandPowers) -> Unit)? = null
    var onPpgSnapshot: ((PpgSnapshot) -> Unit)? = null
    var onHeartRate: ((Int) -> Unit)? = null
    var onTelemetry: ((batteryPercent: Double) -> Unit)? = null
    var onStreamError: ((String) -> Unit)? = null

    private var gatt: BluetoothGatt? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private val enableQueue = ConcurrentLinkedQueue<() -> Unit>()
    private val enabling = AtomicBoolean(false)
    private var waitingForWriteCallback = false
    private var streamingEeg = false
    private var streamingPpg = false
    private var controlNotifyEnabled = false

    private val lastEeg = DoubleArray(4)
    private val eegWindows = Array(4) { ArrayDeque<Double>() }
    private val eegLock = Any()
    private var lastPpg = DoubleArray(3)
    private val irPeaks = ArrayDeque<Long>()
    private var lastIr = 0.0
    private var lastIrSlopeUp = false
    private var eegPackets = 0

    private val emitRunnable = object : Runnable {
        override fun run() {
            if (!streamingEeg && !streamingPpg) return
            try {
                if (streamingEeg) {
                    onEegSnapshot?.invoke(
                        EegSnapshot(
                            tp9 = lastEeg[0],
                            af7 = lastEeg[1],
                            af8 = lastEeg[2],
                            tp10 = lastEeg[3],
                            sampleCount = eegPackets,
                        )
                    )
                    computeBandPowers()?.let { onBandPowers?.invoke(it) }
                }
                if (streamingPpg) {
                    onPpgSnapshot?.invoke(
                        PpgSnapshot(
                            ambient = lastPpg[0],
                            infrared = lastPpg[1],
                            red = lastPpg[2],
                        )
                    )
                }
            } catch (e: Exception) {
                Log.e(TAG, "emitRunnable failed: ${e.message}", e)
            }
            mainHandler.postDelayed(this, EMIT_INTERVAL_MS)
        }
    }

    fun attachGatt(gatt: BluetoothGatt) {
        this.gatt = gatt
    }

    fun isEegStreaming(): Boolean = streamingEeg
    fun isPpgStreaming(): Boolean = streamingPpg

    @SuppressLint("MissingPermission")
    fun startEegStreaming(includePpg: Boolean = true): Result<Unit> {
        val g = gatt ?: return Result.failure(IllegalStateException("GATT not ready"))
        return try {
            val service = g.getService(MuseProtocol.SERVICE_UUID)
                ?: return Result.failure(IllegalStateException("Muse service missing"))
            val control = service.getCharacteristic(MuseProtocol.CONTROL_UUID)
                ?: return Result.failure(IllegalStateException("Missing control characteristic"))

            // muse-js: subscribe to control responses before sending commands
            if (!controlNotifyEnabled) {
                queueEnableNotify(g, control)
                controlNotifyEnabled = true
            }

            MuseProtocol.EEG_UUIDS.forEach { uuid ->
                val ch = service.getCharacteristic(uuid)
                    ?: return Result.failure(IllegalStateException("Missing EEG char $uuid"))
                queueEnableNotify(g, ch)
            }

            // muse-js order: h → preset → s → d
            // p50 = EEG+PPG (Muse 2); p21 = EEG only
            val preset = if (includePpg) "p50" else "p21"
            queueWrite(g, control, MuseProtocol.encodeCommand("h"))
            queueWrite(g, control, MuseProtocol.encodeCommand(preset))
            queueWrite(g, control, MuseProtocol.encodeCommand("s"))
            queueWrite(g, control, MuseProtocol.encodeCommand("d"))

            streamingEeg = true
            mainHandler.removeCallbacks(emitRunnable)
            mainHandler.post(emitRunnable)
            Log.d(TAG, "EEG streaming queued preset=$preset; pending=${enableQueue.size}")
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    @SuppressLint("MissingPermission")
    fun startPpgStreaming(): Result<Unit> {
        val g = gatt ?: return Result.failure(IllegalStateException("GATT not ready"))
        return try {
            val service = g.getService(MuseProtocol.SERVICE_UUID)
                ?: return Result.failure(IllegalStateException("Muse service missing"))
            MuseProtocol.PPG_UUIDS.forEach { uuid ->
                val ch = service.getCharacteristic(uuid)
                if (ch != null) {
                    queueEnableNotify(g, ch)
                } else {
                    Log.w(TAG, "PPG characteristic missing: $uuid")
                }
            }
            // Preset/resume already sent in startEegStreaming(includePpg=true)
            streamingPpg = true
            mainHandler.removeCallbacks(emitRunnable)
            mainHandler.post(emitRunnable)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    @SuppressLint("MissingPermission")
    fun startTelemetry(): Result<Unit> {
        val g = gatt ?: return Result.failure(IllegalStateException("GATT not ready"))
        val service = g.getService(MuseProtocol.SERVICE_UUID)
            ?: return Result.failure(IllegalStateException("Muse service missing"))
        val ch = service.getCharacteristic(MuseProtocol.TELEMETRY_UUID)
            ?: return Result.success(Unit)
        queueEnableNotify(g, ch)
        return Result.success(Unit)
    }

    fun stopStreaming() {
        streamingEeg = false
        streamingPpg = false
        controlNotifyEnabled = false
        waitingForWriteCallback = false
        mainHandler.removeCallbacks(emitRunnable)
        enableQueue.clear()
        enabling.set(false)
        eegPackets = 0
        lastEeg.fill(0.0)
        lastPpg.fill(0.0)
    }

    fun onCharacteristicChanged(uuid: UUID, value: ByteArray) {
        when (uuid) {
            MuseProtocol.CONTROL_UUID -> {
                // Control ACKs / JSON responses — ignored for streaming
            }
            in MuseProtocol.EEG_UUIDS -> {
                val idx = MuseProtocol.EEG_UUIDS.indexOf(uuid)
                if (idx < 0) return
                val samples = MuseProtocol.decodeEEGSamples(value)
                if (samples.isEmpty()) return
                val last = samples.last()
                lastEeg[idx] = last
                eegPackets++
                synchronized(eegLock) {
                    val window = eegWindows[idx]
                    samples.forEach { s ->
                        window.addLast(s)
                        while (window.size > BAND_WINDOW) window.removeFirst()
                    }
                }
            }
            in MuseProtocol.PPG_UUIDS -> {
                val idx = MuseProtocol.PPG_UUIDS.indexOf(uuid)
                if (idx < 0) return
                val samples = MuseProtocol.decodePPGSamples(value)
                if (samples.isEmpty()) return
                val last = samples.last().toDouble()
                lastPpg[idx] = last
                if (idx == 1) {
                    updateHrFromInfrared(last)
                }
            }
            MuseProtocol.TELEMETRY_UUID -> {
                val battery = MuseProtocol.decodeTelemetryBatteryPercent(value)
                mainHandler.post { onTelemetry?.invoke(battery) }
            }
        }
    }

    fun onDescriptorWrite(status: Int) {
        if (status != BluetoothGatt.GATT_SUCCESS) {
            Log.w(TAG, "Descriptor write failed: $status")
        }
        enabling.set(false)
        drainQueue()
    }

    fun onCharacteristicWrite(status: Int) {
        if (!waitingForWriteCallback) {
            // WRITE_NO_RESPONSE already advanced the queue
            return
        }
        waitingForWriteCallback = false
        if (status != BluetoothGatt.GATT_SUCCESS) {
            Log.w(TAG, "Characteristic write failed: $status")
            onStreamError?.invoke("Control write failed: $status")
        }
        enabling.set(false)
        drainQueue()
    }

    private fun updateHrFromInfrared(value: Double) {
        val now = System.currentTimeMillis()
        val rising = value > lastIr
        if (rising && !lastIrSlopeUp && lastIr > 0) {
            // crude peak
            irPeaks.addLast(now)
            while (irPeaks.isNotEmpty() && now - irPeaks.first() > 10_000L) {
                irPeaks.removeFirst()
            }
            if (irPeaks.size >= 3) {
                val intervals = mutableListOf<Long>()
                val list = irPeaks.toList()
                for (i in 1 until list.size) {
                    val dt = list[i] - list[i - 1]
                    if (dt in 300..2000) intervals.add(dt)
                }
                if (intervals.isNotEmpty()) {
                    val mean = intervals.average()
                    val bpm = (60_000.0 / mean).toInt().coerceIn(40, 180)
                    mainHandler.post { onHeartRate?.invoke(bpm) }
                }
            }
        }
        lastIrSlopeUp = rising
        lastIr = value
    }

    /**
     * Lightweight relative band estimate from AF7 window using variance in
     * successive difference bands (not a full FFT — good enough for Monitor cards).
     */
    private fun computeBandPowers(): BandPowers? {
        val values: DoubleArray = synchronized(eegLock) {
            val signal = eegWindows[1]
            if (signal.size < 64) return null
            DoubleArray(signal.size) { i -> signal.elementAt(i) }
        }
        var sum = 0.0
        for (v in values) sum += v
        val mean = sum / values.size
        val centered = DoubleArray(values.size) { values[it] - mean }
        fun energy(step: Int): Double {
            if (centered.size <= step) return 0.0
            var eSum = 0.0
            var n = 0
            var i = 0
            while (i + step < centered.size) {
                val d = centered[i + step] - centered[i]
                eSum += d * d
                n++
                i += step
            }
            return if (n == 0) 0.0 else eSum / n
        }
        val delta = energy(16)
        val theta = energy(8)
        val alpha = energy(4)
        val beta = energy(2)
        val gamma = energy(1)
        val total = delta + theta + alpha + beta + gamma
        if (total <= 1e-9) {
            return BandPowers(0.0, 0.0, 0.0, 0.0, 0.0)
        }
        return BandPowers(
            delta = delta / total,
            theta = theta / total,
            alpha = alpha / total,
            beta = beta / total,
            gamma = gamma / total,
        )
    }

    @SuppressLint("MissingPermission")
    private fun queueEnableNotify(g: BluetoothGatt, ch: BluetoothGattCharacteristic) {
        enableQueue.add {
            try {
                g.setCharacteristicNotification(ch, true)
                val cccd = ch.getDescriptor(MuseProtocol.clientConfigUuid())
                if (cccd != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        g.writeDescriptor(
                            cccd,
                            BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                        )
                    } else {
                        @Suppress("DEPRECATION")
                        cccd.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                        @Suppress("DEPRECATION")
                        g.writeDescriptor(cccd)
                    }
                } else {
                    enabling.set(false)
                    drainQueue()
                }
            } catch (e: Exception) {
                Log.e(TAG, "enable notify failed: ${e.message}")
                enabling.set(false)
                drainQueue()
            }
        }
        drainQueue()
    }

    @SuppressLint("MissingPermission")
    private fun queueWrite(g: BluetoothGatt, ch: BluetoothGattCharacteristic, value: ByteArray) {
        enableQueue.add {
            tryWriteControl(g, ch, value, attempt = 0)
        }
        drainQueue()
    }

    @SuppressLint("MissingPermission")
    private fun tryWriteControl(
        g: BluetoothGatt,
        ch: BluetoothGattCharacteristic,
        value: ByteArray,
        attempt: Int,
    ) {
        try {
            val props = ch.properties
            val writeType =
                if ((props and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0) {
                    BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
                } else {
                    BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                }
            Log.d(
                TAG,
                "Control write type=$writeType len=${value.size} attempt=$attempt"
            )
            waitingForWriteCallback =
                writeType == BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT

            val writeOk: Boolean = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val code = g.writeCharacteristic(ch, value, writeType)
                when (code) {
                    BluetoothStatusCodes.SUCCESS -> true
                    // ERROR_GATT_WRITE_REQUEST_BUSY = 201 — BLE stack still busy
                    201 -> {
                        if (attempt < 20) {
                            mainHandler.postDelayed(
                                { tryWriteControl(g, ch, value, attempt + 1) },
                                50L
                            )
                            return
                        }
                        Log.w(TAG, "writeCharacteristic busy after retries: $code")
                        false
                    }
                    else -> {
                        Log.w(TAG, "writeCharacteristic returned $code")
                        false
                    }
                }
            } else {
                @Suppress("DEPRECATION")
                ch.value = value
                @Suppress("DEPRECATION")
                ch.writeType = writeType
                @Suppress("DEPRECATION")
                g.writeCharacteristic(ch)
            }

            if (!writeOk) {
                waitingForWriteCallback = false
                onStreamError?.invoke("Control write failed after retries")
                enabling.set(false)
                drainQueue()
                return
            }

            // Muse control is WRITE_NO_RESPONSE: space commands (~muse-js awaits each write)
            if (!waitingForWriteCallback) {
                mainHandler.postDelayed({
                    enabling.set(false)
                    drainQueue()
                }, 120L)
            }
        } catch (e: Exception) {
            Log.e(TAG, "write failed: ${e.message}")
            waitingForWriteCallback = false
            enabling.set(false)
            drainQueue()
        }
    }

    private fun drainQueue() {
        if (!enabling.compareAndSet(false, true)) return
        val next = enableQueue.poll()
        if (next == null) {
            enabling.set(false)
            return
        }
        next.invoke()
    }
}
