package com.gabriele.muscogiuri.becomemonitor.muse

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Build
import android.util.Log
import java.util.concurrent.ConcurrentHashMap

/**
 * Scan + GATT connect for Muse headbands (service 0xfe8d).
 */
class MuseConnectionManager(private val context: Context) {

    companion object {
        private const val TAG = "MuseConnectionManager"
    }

    data class MuseDeviceInfo(
        val deviceId: String,
        val name: String,
        val rssi: Int? = null,
    )

    var onDeviceFound: ((MuseDeviceInfo) -> Unit)? = null
    var onDeviceConnected: ((MuseDeviceInfo) -> Unit)? = null
    var onDeviceDisconnected: ((MuseDeviceInfo) -> Unit)? = null
    var onGattReady: ((BluetoothGatt) -> Unit)? = null
    var onConnectionError: ((String) -> Unit)? = null
    var onCharacteristicChanged: ((java.util.UUID, ByteArray) -> Unit)? = null
    var onDescriptorWrite: ((Int) -> Unit)? = null
    var onCharacteristicWrite: ((Int) -> Unit)? = null

    private val bluetoothManager =
        context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    private val adapter: BluetoothAdapter? get() = bluetoothManager.adapter

    private var scanning = false
    private var gatt: BluetoothGatt? = null
    private var connectedInfo: MuseDeviceInfo? = null
    private val seen = ConcurrentHashMap.newKeySet<String>()
    private var mtuRequested = false
    private var servicesDiscoveryStarted = false

    fun getGatt(): BluetoothGatt? = gatt

    fun isConnected(): Boolean = gatt != null && connectedInfo != null

    @SuppressLint("MissingPermission")
    fun startScan(): Result<Unit> {
        return try {
            val scanner = adapter?.bluetoothLeScanner
                ?: return Result.failure(IllegalStateException("Bluetooth LE scanner unavailable"))
            if (scanning) {
                return Result.success(Unit)
            }
            seen.clear()
            val settings = ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .build()
            // Unfiltered scan; MuseService / name filter applied in callback
            // (some Muse firmwares omit service UUID in advertising).
            scanner.startScan(null, settings, scanCallback)
            scanning = true
            Log.d(TAG, "Muse scan started")
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    @SuppressLint("MissingPermission")
    fun stopScan(): Result<Unit> {
        return try {
            if (scanning) {
                adapter?.bluetoothLeScanner?.stopScan(scanCallback)
                scanning = false
                Log.d(TAG, "Muse scan stopped")
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    @SuppressLint("MissingPermission")
    fun connectToDevice(deviceId: String): Result<Unit> {
        return try {
            stopScan()
            val device = resolveDevice(deviceId)
                ?: return Result.failure(IllegalArgumentException("Device not found: $deviceId"))
            gatt?.close()
            gatt = null
            mtuRequested = false
            servicesDiscoveryStarted = false
            connectedInfo = MuseDeviceInfo(
                deviceId = device.address,
                name = device.name ?: "Muse",
            )
            gatt = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
            } else {
                device.connectGatt(context, false, gattCallback)
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    @SuppressLint("MissingPermission")
    fun disconnect(): Result<Unit> {
        return try {
            gatt?.disconnect()
            gatt?.close()
            gatt = null
            val info = connectedInfo
            connectedInfo = null
            if (info != null) {
                onDeviceDisconnected?.invoke(info)
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    @SuppressLint("MissingPermission")
    private fun resolveDevice(deviceId: String): BluetoothDevice? {
        val normalized = deviceId.trim()
        adapter?.bondedDevices?.firstOrNull {
            it.address.equals(normalized, ignoreCase = true) ||
                it.name?.contains("Muse", ignoreCase = true) == true &&
                it.address.equals(normalized, ignoreCase = true)
        }?.let { return it }
        return try {
            adapter?.getRemoteDevice(normalized)
        } catch (_: Exception) {
            null
        }
    }

    private fun looksLikeMuse(name: String?): Boolean {
        if (name.isNullOrBlank()) return false
        val n = name.lowercase()
        return n.contains("muse")
    }

    private val scanCallback = object : ScanCallback() {
        @SuppressLint("MissingPermission")
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val device = result.device ?: return
            val name = device.name ?: result.scanRecord?.deviceName
            val hasService = result.scanRecord?.serviceUuids?.any {
                it.uuid == MuseProtocol.SERVICE_UUID
            } == true
            if (!hasService && !looksLikeMuse(name)) {
                return
            }
            val address = device.address ?: return
            if (!seen.add(address)) {
                return
            }
            val info = MuseDeviceInfo(
                deviceId = address,
                name = name ?: "Muse",
                rssi = result.rssi,
            )
            Log.d(TAG, "Muse found: ${info.name} (${info.deviceId})")
            onDeviceFound?.invoke(info)
        }

        override fun onScanFailed(errorCode: Int) {
            Log.e(TAG, "Muse scan failed: $errorCode")
            onConnectionError?.invoke("Scan failed: $errorCode")
        }
    }

    private val gattCallback = object : BluetoothGattCallback() {
        @SuppressLint("MissingPermission")
        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                Log.d(TAG, "GATT connected, requesting MTU then services…")
                mtuRequested = false
                servicesDiscoveryStarted = false
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    mtuRequested = g.requestMtu(512)
                    if (!mtuRequested) {
                        startServiceDiscovery(g)
                    } else {
                        // Fallback if onMtuChanged never arrives
                        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                            startServiceDiscovery(g)
                        }, 800L)
                    }
                } else {
                    startServiceDiscovery(g)
                }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                Log.d(TAG, "GATT disconnected status=$status")
                gatt?.close()
                gatt = null
                mtuRequested = false
                servicesDiscoveryStarted = false
                val info = connectedInfo
                connectedInfo = null
                if (info != null) {
                    onDeviceDisconnected?.invoke(info)
                }
            }
        }

        override fun onMtuChanged(g: BluetoothGatt, mtu: Int, status: Int) {
            Log.d(TAG, "MTU changed mtu=$mtu status=$status")
            startServiceDiscovery(g)
        }

        @SuppressLint("MissingPermission")
        private fun startServiceDiscovery(g: BluetoothGatt) {
            if (servicesDiscoveryStarted) return
            servicesDiscoveryStarted = true
            g.discoverServices()
        }

        @SuppressLint("MissingPermission")
        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                onConnectionError?.invoke("Service discovery failed: $status")
                return
            }
            val service = g.getService(MuseProtocol.SERVICE_UUID)
            if (service == null) {
                onConnectionError?.invoke("Muse service 0xfe8d not found")
                return
            }
            gatt = g
            val info = connectedInfo ?: MuseDeviceInfo(
                deviceId = g.device.address,
                name = g.device.name ?: "Muse",
            )
            connectedInfo = info
            Log.d(TAG, "Muse GATT ready: ${info.name}")
            onDeviceConnected?.invoke(info)
            onGattReady?.invoke(g)
        }

        @Deprecated("Deprecated in API 33")
        override fun onCharacteristicChanged(
            g: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic
        ) {
            @Suppress("DEPRECATION")
            val value = characteristic.value ?: return
            onCharacteristicChanged?.invoke(characteristic.uuid, value)
        }

        override fun onCharacteristicChanged(
            g: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray
        ) {
            onCharacteristicChanged?.invoke(characteristic.uuid, value)
        }

        override fun onDescriptorWrite(
            g: BluetoothGatt,
            descriptor: BluetoothGattDescriptor,
            status: Int
        ) {
            onDescriptorWrite?.invoke(status)
        }

        override fun onCharacteristicWrite(
            g: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            status: Int
        ) {
            onCharacteristicWrite?.invoke(status)
        }
    }
}
