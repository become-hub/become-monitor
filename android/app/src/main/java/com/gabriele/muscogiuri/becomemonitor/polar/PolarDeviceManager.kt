package com.gabriele.muscogiuri.becomemonitor.polar

import android.util.Log
import com.polar.sdk.api.PolarBleApi
import com.polar.sdk.api.PolarBleApiCallback
import com.polar.sdk.api.model.PolarDeviceInfo
import com.polar.sdk.api.model.PolarHrData
import io.reactivex.rxjava3.android.schedulers.AndroidSchedulers
import io.reactivex.rxjava3.disposables.Disposable
import io.reactivex.rxjava3.schedulers.Schedulers

/**
 * PolarDeviceManager
 * Gestisce la connessione ai dispositivi Polar e la scansione
 */
class PolarDeviceManager(private val api: PolarBleApi) {

    companion object {
        private const val TAG = "PolarDeviceManager"
    }

    private var scanDisposable: Disposable? = null
    private var connectedDeviceId: String? = null
    private var connectedAtMs: Long? = null
    private val readyFeatures = mutableSetOf<PolarBleApi.PolarBleSdkFeature>()

    /**
     * Second, read-only device (developer validation: Polar H10 next to a 360/Loop).
     * Its connect / disconnect / HR / feature events never touch the primary-device state above.
     */
    private var referenceDeviceId: String? = null

    // Callbacks
    var onDeviceFound: ((PolarDeviceInfo) -> Unit)? = null
    var onDeviceConnected: ((PolarDeviceInfo) -> Unit)? = null
    var onDeviceDisconnected: ((PolarDeviceInfo) -> Unit)? = null
    var onReferenceDeviceConnected: ((PolarDeviceInfo) -> Unit)? = null
    var onReferenceDeviceDisconnected: ((PolarDeviceInfo) -> Unit)? = null
    var onHeartRateReceived: ((String, PolarHrData.PolarHrSample) -> Unit)? = null
    var onBluetoothStateChanged: ((Boolean) -> Unit)? = null
    var onFeatureReady: ((String, PolarBleApi.PolarBleSdkFeature) -> Unit)? = null
    var onScanError: ((Throwable) -> Unit)? = null
    /** Fired when connection drops quickly with only unencrypted HR ready (pairing failure). */
    var onPairingLikelyFailed: ((deviceId: String, connectedMs: Long, features: Set<String>) -> Unit)? = null

    init {
        setupApiCallback()
    }

    /**
     * Configura il callback dell'API Polar
     */
    private fun setupApiCallback() {
        api.setApiCallback(object : PolarBleApiCallback() {
            override fun blePowerStateChanged(powered: Boolean) {
                val status = if (powered) "ON" else "OFF"
                Log.d(TAG, "Bluetooth: $status")
                onBluetoothStateChanged?.invoke(powered)
            }

            override fun deviceConnected(info: PolarDeviceInfo) {
                if (isReferenceDevice(info.deviceId)) {
                    Log.d(TAG, "✅ Reference connected: ${info.deviceId}")
                    onReferenceDeviceConnected?.invoke(info)
                    return
                }
                connectedDeviceId = info.deviceId
                connectedAtMs = System.currentTimeMillis()
                readyFeatures.clear()
                Log.d(TAG, "✅ Connected: ${info.deviceId}")
                onDeviceConnected?.invoke(info)
            }

            override fun deviceDisconnected(info: PolarDeviceInfo) {
                if (isReferenceDevice(info.deviceId)) {
                    Log.d(TAG, "⚠️ Reference disconnected: ${info.deviceId}")
                    onReferenceDeviceDisconnected?.invoke(info)
                    return
                }
                val connectedMs = connectedAtMs?.let { System.currentTimeMillis() - it }
                val featureNames = readyFeatures.map { it.name }.toSet()
                val hasEncryptedFeature = readyFeatures.any {
                    it == PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_FILE_TRANSFER ||
                        it == PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_DEVICE_TIME_SETUP
                }
                Log.d(TAG, "⚠️ Disconnected: ${info.deviceId}")
                if (
                    connectedMs != null &&
                    connectedMs < 8_000 &&
                    !hasEncryptedFeature
                ) {
                    onPairingLikelyFailed?.invoke(info.deviceId, connectedMs, featureNames)
                }
                connectedDeviceId = null
                connectedAtMs = null
                readyFeatures.clear()
                onDeviceDisconnected?.invoke(info)
            }

            override fun bleSdkFeatureReady(
                identifier: String,
                feature: PolarBleApi.PolarBleSdkFeature
            ) {
                if (isReferenceDevice(identifier)) {
                    return
                }
                readyFeatures.add(feature)
                Log.d(TAG, "Feature ready: $feature for $identifier")
                onFeatureReady?.invoke(identifier, feature)
            }

            override fun deviceConnecting(polarDeviceInfo: PolarDeviceInfo) {
                Log.d(TAG, "Connecting: ${polarDeviceInfo.deviceId}")
            }

            override fun hrNotificationReceived(identifier: String, data: PolarHrData.PolarHrSample) {
                if (isReferenceDevice(identifier)) {
                    // Reference HR/RR arrives through PolarStreamManager.startReferenceHrStreaming.
                    return
                }
                Log.d(TAG, "💓 HR: ${data.hr} BPM")
                onHeartRateReceived?.invoke(identifier, data)
            }

            override fun disInformationReceived(
                identifier: String,
                disInfo: com.polar.androidcommunications.api.ble.model.DisInfo
            ) {
                // unused
            }

            override fun htsNotificationReceived(
                identifier: String,
                data: com.polar.sdk.api.model.PolarHealthThermometerData
            ) {
                // unused
            }
        })
    }

    /**
     * Avvia la scansione dei dispositivi Polar
     */
    fun startScan(): Result<Unit> {
        return try {
            if (scanDisposable?.isDisposed == false) {
                scanDisposable?.dispose()
            }

            Log.d(TAG, "🔍 Starting scan...")
            scanDisposable = api.searchForDevice()
                .subscribeOn(Schedulers.io())
                .observeOn(AndroidSchedulers.mainThread())
                .subscribe({ info ->
                    Log.d(TAG, "📡 Found: ${info.deviceId} (${info.name})")
                    onDeviceFound?.invoke(info)
                }, { error ->
                    Log.e(TAG, "❌ Scan error: $error")
                    onScanError?.invoke(error)
                })

            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start scan: ${e.message}")
            Result.failure(e)
        }
    }

    /**
     * Ferma la scansione
     */
    fun stopScan(): Result<Unit> {
        return try {
            scanDisposable?.dispose()
            scanDisposable = null
            Log.d(TAG, "Stop scan completed")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop scan: ${e.message}")
            Result.failure(e)
        }
    }

    /**
     * Connetti a un dispositivo Polar
     */
    fun connectToDevice(deviceId: String): Result<Unit> {
        return try {
            if (connectedDeviceId == deviceId) {
                Log.d(TAG, "Already connected to $deviceId — skip connect")
                return Result.success(Unit)
            }
            if (referenceDeviceId == deviceId) {
                // Device was used as reference; from now on it is the primary one.
                referenceDeviceId = null
            }
            Log.d(TAG, "🔗 Connecting to $deviceId...")
            api.connectToDevice(deviceId)
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Connection error: ${e.message}")
            Result.failure(e)
        }
    }

    /**
     * Disconnetti da un dispositivo
     */
    fun disconnectFromDevice(deviceId: String): Result<Unit> {
        return try {
            api.disconnectFromDevice(deviceId)
            connectedDeviceId = null
            Log.d(TAG, "Disconnected from $deviceId")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to disconnect: ${e.message}")
            Result.failure(e)
        }
    }

    private fun isReferenceDevice(deviceId: String): Boolean =
        referenceDeviceId != null && referenceDeviceId == deviceId

    /**
     * Connetti il dispositivo di riferimento (es. H10) accanto al principale.
     * Rifiuta l'id del dispositivo principale.
     */
    fun connectReferenceDevice(deviceId: String): Result<Unit> {
        return try {
            if (connectedDeviceId == deviceId) {
                return Result.failure(
                    IllegalArgumentException("Il dispositivo di riferimento coincide con il principale")
                )
            }
            referenceDeviceId = deviceId
            Log.d(TAG, "🔗 Connecting reference $deviceId...")
            api.connectToDevice(deviceId)
            Result.success(Unit)
        } catch (e: Exception) {
            referenceDeviceId = null
            Log.e(TAG, "❌ Reference connection error: ${e.message}")
            Result.failure(e)
        }
    }

    /**
     * Keeps [referenceDeviceId] set: the SDK reports the disconnect asynchronously, and that
     * late callback must still be routed to the reference path, not treated as a primary drop.
     */
    fun disconnectReferenceDevice(): Result<Unit> {
        val id = referenceDeviceId ?: return Result.success(Unit)
        return try {
            api.disconnectFromDevice(id)
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to disconnect reference: ${e.message}")
            Result.failure(e)
        }
    }

    fun getReferenceDeviceId(): String? = referenceDeviceId

    /**
     * Ottiene l'ID del dispositivo connesso
     */
    fun getConnectedDeviceId(): String? = connectedDeviceId

    /**
     * Verifica se c'è un dispositivo connesso
     */
    fun isDeviceConnected(): Boolean = connectedDeviceId != null

    /**
     * Cleanup delle risorse
     */
    fun cleanup() {
        scanDisposable?.dispose()
        scanDisposable = null
        connectedDeviceId = null
        referenceDeviceId = null
    }
}
