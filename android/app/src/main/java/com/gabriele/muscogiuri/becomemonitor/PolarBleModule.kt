package com.gabriele.muscogiuri.becomemonitor

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.gabriele.muscogiuri.becomemonitor.bluetooth.BluetoothManager
import com.gabriele.muscogiuri.becomemonitor.polar.PolarDeviceManager
import com.gabriele.muscogiuri.becomemonitor.polar.PolarFtuManager
import com.gabriele.muscogiuri.becomemonitor.polar.PolarStreamManager
import com.polar.sdk.api.PolarBleApi
import com.polar.sdk.api.PolarBleApiDefaultImpl
import io.reactivex.rxjava3.android.schedulers.AndroidSchedulers
import io.reactivex.rxjava3.disposables.CompositeDisposable
import io.reactivex.rxjava3.schedulers.Schedulers
import java.util.concurrent.TimeUnit

class PolarBleModule @JvmOverloads constructor(
    reactContext: ReactApplicationContext,
    bluetoothManagerOverride: BluetoothManager? = null,
    deviceManagerOverride: PolarDeviceManager? = null,
    streamManagerOverride: PolarStreamManager? = null,
    ftuManagerOverride: PolarFtuManager? = null,
    apiOverride: PolarBleApi? = null,
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "PolarBleModule"
    }

    private val apiLazy: Lazy<PolarBleApi> = lazy {
        apiOverride ?: PolarBleApiDefaultImpl.defaultImplementation(
            reactContext.applicationContext,
            setOf(
                PolarBleApi.PolarBleSdkFeature.FEATURE_HR,
                PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_ONLINE_STREAMING,
                PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_SDK_MODE,
                PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_DEVICE_TIME_SETUP,
                PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_FILE_TRANSFER
            )
        ).also { polarApi ->
            // Auto-reconnect hammers a broken LE bond (SMP_PAIR_AUTH_FAIL → GATT 22 loop).
            polarApi.setAutomaticReconnection(false)
        }
    }
    private val api: PolarBleApi get() = apiLazy.value

    private val bluetoothManager: BluetoothManager by lazy {
        bluetoothManagerOverride ?: BluetoothManager(reactContext.applicationContext)
    }

    private val deviceManager: PolarDeviceManager by lazy {
        deviceManagerOverride ?: PolarDeviceManager(api)
    }

    private val streamManager: PolarStreamManager by lazy {
        streamManagerOverride ?: PolarStreamManager(api)
    }

    private val ftuManager: PolarFtuManager by lazy {
        ftuManagerOverride ?: PolarFtuManager(api)
    }

    private val disposables = CompositeDisposable()

    init {
        setupCallbacks()
    }

    override fun getName(): String = "PolarBleModule"

    // Metodi richiesti da NativeEventEmitter
    @ReactMethod
    fun addListener(eventName: String) {
        // Metodo richiesto da NativeEventEmitter
        // Non necessario implementare nulla qui
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Metodo richiesto da NativeEventEmitter
        // Non necessario implementare nulla qui
    }

    @ReactMethod
    fun checkBluetoothState(promise: Promise) {
        try {
            val powered = bluetoothManager.isBluetoothEnabled()
            promise.resolve(powered)
        } catch (e: Exception) {
            promise.reject("BLUETOOTH_CHECK_ERROR", e.message)
        }
    }

    @ReactMethod
    fun hasBluetoothPermissions(promise: Promise) {
        try {
            val hasPermissions = bluetoothManager.hasBluetoothPermissions()
            promise.resolve(hasPermissions)
        } catch (e: Exception) {
            promise.reject("PERMISSION_CHECK_ERROR", e.message)
        }
    }

    @ReactMethod
    fun requestBluetoothPermissions(promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity
            if (activity != null) {
                bluetoothManager.requestBluetoothPermissions(activity)
                promise.resolve(true)
            } else {
                promise.reject("NO_ACTIVITY", "No current activity available")
            }
        } catch (e: Exception) {
            promise.reject("PERMISSION_REQUEST_ERROR", e.message)
        }
    }

    @ReactMethod
    fun requestEnableBluetooth(promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity
            if (activity != null) {
                val result = bluetoothManager.requestEnableBluetooth(activity)
                promise.resolve(result)
            } else {
                promise.reject("NO_ACTIVITY", "No current activity available")
            }
        } catch (e: Exception) {
            promise.reject("ENABLE_BT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun setBluetoothEnabled(enable: Boolean, promise: Promise) {
        try {
            // Per Android, proviamo prima setBluetoothEnabled diretto
            val result = bluetoothManager.setBluetoothEnabled(enable)
            result.onSuccess { success ->
                promise.resolve(success)
            }.onFailure { error ->
                // Se fallisce per permessi o altre ragioni, usa requestEnableBluetooth
                if (enable) {
                    val activity = reactApplicationContext.currentActivity
                    if (activity != null) {
                        val requested = bluetoothManager.requestEnableBluetooth(activity)
                        promise.resolve(requested)
                    } else {
                        promise.reject("NO_ACTIVITY", "No current activity available")
                    }
                } else {
                    // Per disabilitare, usa setBluetoothEnabled
                    promise.reject("TOGGLE_BT_ERROR", error.message)
                }
            }
        } catch (e: Exception) {
            promise.reject("TOGGLE_BT_ERROR", e.message)
        }
    }

    private fun setupCallbacks() {
        // Setup Bluetooth state callbacks
        deviceManager.onBluetoothStateChanged = { powered ->
            sendEvent("onBluetoothStateChanged", Arguments.createMap().apply {
                putBoolean("powered", powered)
            })
        }

        // Setup device found callback
        deviceManager.onDeviceFound = { info ->
            sendEvent("onDeviceFound", Arguments.createMap().apply {
                putString("deviceId", info.deviceId)
                putString("name", info.name)
                putInt("rssi", info.rssi)
            })
        }

        // Setup device connected callback
        deviceManager.onDeviceConnected = { info ->
            sendEvent("onDeviceConnected", Arguments.createMap().apply {
                putString("deviceId", info.deviceId)
                putString("name", info.name)
            })
        }

        // Setup device disconnected callback
        deviceManager.onDeviceDisconnected = { info ->
            streamManager.stopPpiStreaming()
            ftuManager.onDeviceDisconnected(info.deviceId)
            MonitorForegroundService.stop(reactApplicationContext)
            sendEvent("onDeviceDisconnected", Arguments.createMap().apply {
                putString("deviceId", info.deviceId)
            })
        }

        deviceManager.onPairingLikelyFailed = { deviceId, connectedMs, features ->
            val removed = bluetoothManager.removePolarBonds(deviceId)
            Log.w(
                TAG,
                "Pairing likely failed for $deviceId after ${connectedMs}ms " +
                    "(features=$features, removedBonds=$removed)"
            )
            sendEvent("onPairingFailed", Arguments.createMap().apply {
                putString("deviceId", deviceId)
                putDouble("connectedMs", connectedMs.toDouble())
                putString("features", features.joinToString(","))
                putInt("removedBonds", removed)
            })
        }

        deviceManager.onFeatureReady = { deviceId, feature ->
            ftuManager.onFeatureReady(deviceId, feature)
        }

        // Setup heart rate callback
        deviceManager.onHeartRateReceived = { identifier, data ->
            sendEvent("onHeartRateReceived", Arguments.createMap().apply {
                putString("deviceId", identifier)
                putInt("hr", data.hr)
                putBoolean("contactDetected", data.contactStatus)
                putBoolean("contactSupported", data.contactStatusSupported)
            })
        }

        // Setup PPI data callback
        streamManager.onPpiDataReceived = { deviceId, ppiData ->
            val samples = Arguments.createArray()
            ppiData.samples.forEach { sample ->
                val sampleMap = Arguments.createMap().apply {
                    putDouble("ppi", sample.ppi.toDouble())
                    putInt("hr", sample.hr)
                    putBoolean("blocker", sample.blockerBit)
                    putInt("errorEstimate", sample.errorEstimate)
                }
                samples.pushMap(sampleMap)
            }
            sendEvent("onPpiDataReceived", Arguments.createMap().apply {
                putString("deviceId", deviceId)
                putArray("samples", samples)
            })
        }

        // Setup PPI stream error callback
        streamManager.onPpiStreamError = { error ->
            sendEvent("onPpiStreamError", Arguments.createMap().apply {
                putString("error", error.message ?: "Unknown error")
            })
        }

        // Setup scan error callback
        deviceManager.onScanError = { error ->
            Log.e(TAG, "Scan error: ${error.message}")
        }
    }

    @ReactMethod
    fun startScan(promise: Promise) {
        try {
            deviceManager.startScan()
                .onSuccess { promise.resolve(null) }
                .onFailure { error ->
                    promise.reject("SCAN_ERROR", error.message)
                }
        } catch (e: Exception) {
            promise.reject("SCAN_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopScan(promise: Promise) {
        try {
            deviceManager.stopScan()
                .onSuccess { promise.resolve(null) }
                .onFailure { error ->
                    promise.reject("STOP_SCAN_ERROR", error.message)
                }
        } catch (e: Exception) {
            promise.reject("STOP_SCAN_ERROR", e.message)
        }
    }

    @ReactMethod
    fun connectToDevice(deviceId: String, promise: Promise) {
        try {
            deviceManager.connectToDevice(deviceId)
                .onSuccess { promise.resolve(null) }
                .onFailure { error ->
                    promise.reject("CONNECTION_ERROR", error.message)
                }
        } catch (e: Exception) {
            promise.reject("CONNECTION_ERROR", e.message)
        }
    }

    @ReactMethod
    fun disconnectFromDevice(deviceId: String, promise: Promise) {
        try {
            deviceManager.disconnectFromDevice(deviceId)
                .onSuccess { promise.resolve(null) }
                .onFailure { error ->
                    promise.reject("DISCONNECT_ERROR", error.message)
                }
        } catch (e: Exception) {
            promise.reject("DISCONNECT_ERROR", e.message)
        }
    }

    /**
     * Assicura che First Time Use sia completato sul Polar 360 prima dello streaming.
     * Idempotente: se FTU è già fatto, resolve con performed=false.
     * Se FTU viene eseguito ora, resolve con performed=true (device in restart).
     */
    @ReactMethod
    fun ensureFirstTimeUse(deviceId: String, promise: Promise) {
        Log.d(TAG, "ensureFirstTimeUse for $deviceId")
        val disposable = ftuManager.ensureFirstTimeUse(deviceId)
            .subscribeOn(Schedulers.io())
            .observeOn(AndroidSchedulers.mainThread())
            .timeout(90, TimeUnit.SECONDS)
            .subscribe({ performed ->
                Log.d(TAG, "ensureFirstTimeUse success for $deviceId performed=$performed")
                promise.resolve(Arguments.createMap().apply {
                    putBoolean("performed", performed)
                })
            }, { error ->
                Log.e(TAG, "ensureFirstTimeUse failed for $deviceId: ${error.message}")
                val code = when {
                    error.message?.contains("Timeout", ignoreCase = true) == true ||
                        error is java.util.concurrent.TimeoutException -> "FTU_TIMEOUT"
                    else -> "FTU_FAILED"
                }
                promise.reject(
                    code,
                    error.message
                        ?: "Configura Polar 360 fallita — reset di fabbrica se già abbinato altrove"
                )
            })
        disposables.add(disposable)
    }

    @ReactMethod
    fun startPpiStreaming(deviceId: String, promise: Promise) {
        try {
            val disposable = streamManager.startPpiStreaming(deviceId)
                .subscribeOn(Schedulers.io())
                .observeOn(AndroidSchedulers.mainThread())
                .subscribe({
                    promise.resolve(null)
                }, { error ->
                    promise.reject(
                        "PPI_STREAM_ERROR",
                        "${error.javaClass.simpleName}: ${error.message}"
                    )
                })
            disposables.add(disposable)
        } catch (e: Exception) {
            promise.reject("PPI_STREAM_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopPpiStreaming(promise: Promise) {
        try {
            streamManager.stopPpiStreaming()
                .onSuccess { promise.resolve(null) }
                .onFailure { error ->
                    promise.reject("STOP_PPI_ERROR", error.message)
                }
        } catch (e: Exception) {
            promise.reject("STOP_PPI_ERROR", e.message)
        }
    }

    /**
     * Starts a connectedDevice foreground service so Ably + Polar keep working
     * while the phone screen is locked.
     */
    @ReactMethod
    fun startMonitorForegroundService(deviceName: String?, promise: Promise) {
        try {
            MonitorForegroundService.start(reactApplicationContext, deviceName)
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "startMonitorForegroundService failed: ${e.message}")
            promise.reject("FGS_START_ERROR", e.message)
        }
    }

    @ReactMethod
    fun updateMonitorForegroundService(
        deviceName: String?,
        hr: Int,
        hrv: Int,
        lf: Int,
        hf: Int,
        promise: Promise
    ) {
        try {
            MonitorForegroundService.update(
                reactApplicationContext,
                deviceName,
                hr,
                hrv,
                lf,
                hf
            )
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "updateMonitorForegroundService failed: ${e.message}")
            promise.reject("FGS_UPDATE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopMonitorForegroundService(promise: Promise) {
        try {
            MonitorForegroundService.stop(reactApplicationContext)
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "stopMonitorForegroundService failed: ${e.message}")
            promise.reject("FGS_STOP_ERROR", e.message)
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        disposables.clear()
        deviceManager.cleanup()
        streamManager.cleanup()
        ftuManager.cleanup()
        MonitorForegroundService.stop(reactApplicationContext)
        if (apiLazy.isInitialized()) {
            api.shutDown()
        }
    }
}
