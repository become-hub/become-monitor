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

    // Callbacks
    var onDeviceFound: ((PolarDeviceInfo) -> Unit)? = null
    var onDeviceConnected: ((PolarDeviceInfo) -> Unit)? = null
    var onDeviceDisconnected: ((PolarDeviceInfo) -> Unit)? = null
    var onHeartRateReceived: ((String, PolarHrData.PolarHrSample) -> Unit)? = null
    var onBluetoothStateChanged: ((Boolean) -> Unit)? = null
    var onScanError: ((Throwable) -> Unit)? = null

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
                connectedDeviceId = info.deviceId
                Log.d(TAG, "✅ Connected: ${info.deviceId}")
                onDeviceConnected?.invoke(info)
            }

            override fun deviceDisconnected(info: PolarDeviceInfo) {
                Log.d(TAG, "⚠️ Disconnected: ${info.deviceId}")
                connectedDeviceId = null
                onDeviceDisconnected?.invoke(info)
            }

            override fun hrNotificationReceived(identifier: String, data: PolarHrData.PolarHrSample) {
                Log.d(TAG, "💓 HR: ${data.hr} BPM")
                onHeartRateReceived?.invoke(identifier, data)
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
    }
}

