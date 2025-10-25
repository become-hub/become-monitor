package com.gabriele.muscogiuri.becomemonitor

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.gabriele.muscogiuri.becomemonitor.bluetooth.BluetoothManager
import com.gabriele.muscogiuri.becomemonitor.polar.PolarDeviceManager
import com.gabriele.muscogiuri.becomemonitor.polar.PolarStreamManager
import com.polar.sdk.api.PolarBleApi
import com.polar.sdk.api.PolarBleApiDefaultImpl
import com.polar.sdk.api.model.PolarDeviceInfo
import com.polar.sdk.api.model.PolarHrData
import com.polar.sdk.api.model.PolarPpiData

class PolarBleModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "PolarBleModule"
    }

    private val api: PolarBleApi by lazy {
        PolarBleApiDefaultImpl.defaultImplementation(
            reactContext.applicationContext,
            setOf(
                PolarBleApi.PolarBleSdkFeature.FEATURE_HR,
                PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_ONLINE_STREAMING,
                PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_SDK_MODE
            )
        )
    }

    private val bluetoothManager: BluetoothManager by lazy {
        BluetoothManager(reactContext.applicationContext)
    }

    private val deviceManager: PolarDeviceManager by lazy {
        PolarDeviceManager(api)
    }

    private val streamManager: PolarStreamManager by lazy {
        PolarStreamManager(api)
    }

    init {
        setupCallbacks()
    }

    override fun getName(): String = "PolarBleModule"

    @ReactMethod
    fun checkBluetoothState(promise: Promise) {
        try {
            val powered = bluetoothManager.isBluetoothEnabled()
            promise.resolve(powered)
        } catch (e: Exception) {
            promise.reject("BLUETOOTH_CHECK_ERROR", e.message)
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
            sendEvent("onDeviceDisconnected", Arguments.createMap().apply {
                putString("deviceId", info.deviceId)
            })
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

    @ReactMethod
    fun startPpiStreaming(deviceId: String, promise: Promise) {
        try {
            streamManager.startPpiStreaming(deviceId)
                .onSuccess { promise.resolve(null) }
                .onFailure { error ->
                    promise.reject("PPI_STREAM_ERROR", error.message)
                }
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

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        deviceManager.cleanup()
        streamManager.cleanup()
        api.shutDown()
    }
}

