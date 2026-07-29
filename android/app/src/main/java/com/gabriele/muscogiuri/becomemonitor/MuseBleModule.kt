package com.gabriele.muscogiuri.becomemonitor

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.gabriele.muscogiuri.becomemonitor.muse.MuseConnectionManager
import com.gabriele.muscogiuri.becomemonitor.muse.MuseStreamManager

/**
 * React Native bridge for Muse 2 (direct BLE GATT — parallel to PolarBleModule).
 * Does not touch Polar SDK paths.
 *
 * Event names are Muse-prefixed to avoid colliding with PolarBleModule on
 * RCTDeviceEventEmitter.
 */
class MuseBleModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "MuseBleModule"
    }

    private val connectionManager = MuseConnectionManager(reactContext.applicationContext)
    private val streamManager = MuseStreamManager()

    init {
        connectionManager.onDeviceFound = { info ->
            sendEvent(
                "onMuseDeviceFound",
                Arguments.createMap().apply {
                    putString("deviceId", info.deviceId)
                    putString("name", info.name)
                    info.rssi?.let { putInt("rssi", it) }
                }
            )
        }
        connectionManager.onDeviceConnected = { info ->
            sendEvent(
                "onMuseDeviceConnected",
                Arguments.createMap().apply {
                    putString("deviceId", info.deviceId)
                    putString("name", info.name)
                }
            )
        }
        connectionManager.onDeviceDisconnected = { info ->
            streamManager.stopStreaming()
            sendEvent(
                "onMuseDeviceDisconnected",
                Arguments.createMap().apply {
                    putString("deviceId", info.deviceId)
                    putString("name", info.name)
                }
            )
        }
        connectionManager.onGattReady = { gatt ->
            streamManager.attachGatt(gatt)
        }
        connectionManager.onCharacteristicChanged = { uuid, value ->
            streamManager.onCharacteristicChanged(uuid, value)
        }
        connectionManager.onDescriptorWrite = { status ->
            streamManager.onDescriptorWrite(status)
        }
        connectionManager.onCharacteristicWrite = { status ->
            streamManager.onCharacteristicWrite(status)
        }
        connectionManager.onConnectionError = { message ->
            sendEvent(
                "onMuseStreamError",
                Arguments.createMap().apply { putString("error", message) }
            )
        }

        streamManager.onEegSnapshot = { snap ->
            sendEvent(
                "onMuseEegSample",
                Arguments.createMap().apply {
                    putDouble("tp9", snap.tp9)
                    putDouble("af7", snap.af7)
                    putDouble("af8", snap.af8)
                    putDouble("tp10", snap.tp10)
                    putInt("sampleCount", snap.sampleCount)
                }
            )
        }
        streamManager.onBandPowers = { bands ->
            sendEvent(
                "onMuseBandPowers",
                Arguments.createMap().apply {
                    putDouble("delta", bands.delta)
                    putDouble("theta", bands.theta)
                    putDouble("alpha", bands.alpha)
                    putDouble("beta", bands.beta)
                    putDouble("gamma", bands.gamma)
                }
            )
        }
        streamManager.onPpgSnapshot = { ppg ->
            sendEvent(
                "onMusePpgSample",
                Arguments.createMap().apply {
                    putDouble("ambient", ppg.ambient)
                    putDouble("infrared", ppg.infrared)
                    putDouble("red", ppg.red)
                }
            )
        }
        streamManager.onHeartRate = { hr ->
            sendEvent(
                "onMuseHeartRate",
                Arguments.createMap().apply { putInt("hr", hr) }
            )
        }
        streamManager.onTelemetry = { battery ->
            sendEvent(
                "onMuseTelemetry",
                Arguments.createMap().apply { putDouble("batteryPercent", battery) }
            )
        }
        streamManager.onStreamError = { message ->
            sendEvent(
                "onMuseStreamError",
                Arguments.createMap().apply { putString("error", message) }
            )
        }
    }

    override fun getName(): String = "MuseBleModule"

    @ReactMethod
    fun addListener(eventName: String) {
        // Required by NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required by NativeEventEmitter
    }

    @ReactMethod
    fun startScan(promise: Promise) {
        connectionManager.startScan()
            .onSuccess { promise.resolve(null) }
            .onFailure { promise.reject("MUSE_SCAN_ERROR", it.message) }
    }

    @ReactMethod
    fun stopScan(promise: Promise) {
        connectionManager.stopScan()
            .onSuccess { promise.resolve(null) }
            .onFailure { promise.reject("MUSE_STOP_SCAN_ERROR", it.message) }
    }

    @ReactMethod
    fun connectToDevice(deviceId: String, promise: Promise) {
        connectionManager.connectToDevice(deviceId)
            .onSuccess { promise.resolve(null) }
            .onFailure { promise.reject("MUSE_CONNECT_ERROR", it.message) }
    }

    @ReactMethod
    fun disconnectFromDevice(deviceId: String, promise: Promise) {
        streamManager.stopStreaming()
        connectionManager.disconnect()
            .onSuccess { promise.resolve(null) }
            .onFailure { promise.reject("MUSE_DISCONNECT_ERROR", it.message) }
    }

    @ReactMethod
    fun startEegStreaming(promise: Promise) {
        streamManager.startTelemetry()
        // Muse 2: EEG + PPG → preset p50
        streamManager.startEegStreaming(includePpg = true)
            .onSuccess {
                Log.d(TAG, "EEG streaming started")
                promise.resolve(null)
            }
            .onFailure { promise.reject("MUSE_EEG_STREAM_ERROR", it.message) }
    }

    @ReactMethod
    fun startPpgStreaming(promise: Promise) {
        streamManager.startPpgStreaming()
            .onSuccess {
                Log.d(TAG, "PPG streaming started")
                promise.resolve(null)
            }
            .onFailure { promise.reject("MUSE_PPG_STREAM_ERROR", it.message) }
    }

    @ReactMethod
    fun stopStreaming(promise: Promise) {
        streamManager.stopStreaming()
        promise.resolve(null)
    }

    private fun sendEvent(eventName: String, params: com.facebook.react.bridge.WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}
