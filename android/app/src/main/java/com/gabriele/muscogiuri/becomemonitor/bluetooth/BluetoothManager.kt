package com.gabriele.muscogiuri.becomemonitor.bluetooth

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.util.Log

/**
 * BluetoothManager
 * Gestisce lo stato del Bluetooth e le operazioni Bluetooth di base
 */
class BluetoothManager(private val context: Context) {

    companion object {
        private const val TAG = "BluetoothManager"
    }

    private val bluetoothManager: BluetoothManager by lazy {
        context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    }

    private val bluetoothAdapter: BluetoothAdapter?
        get() = bluetoothManager.adapter

    /**
     * Verifica se il Bluetooth è acceso
     * @return true se il Bluetooth è acceso, false altrimenti
     */
    fun isBluetoothEnabled(): Boolean {
        return try {
            val enabled = bluetoothAdapter?.isEnabled ?: false
            Log.d(TAG, "Bluetooth state: $enabled")
            enabled
        } catch (e: Exception) {
            Log.e(TAG, "Error checking Bluetooth state: ${e.message}")
            false
        }
    }

    /**
     * Verifica se il Bluetooth è supportato sul dispositivo
     * @return true se il Bluetooth è supportato, false altrimenti
     */
    fun isBluetoothSupported(): Boolean {
        return try {
            val supported = bluetoothAdapter != null
            Log.d(TAG, "Bluetooth supported: $supported")
            supported
        } catch (e: Exception) {
            Log.e(TAG, "Error checking Bluetooth support: ${e.message}")
            false
        }
    }

    /**
     * Ottiene l'indirizzo MAC del Bluetooth adapter
     * @return indirizzo MAC o null se non disponibile
     */
    fun getBluetoothAddress(): String? {
        return try {
            bluetoothAdapter?.address
        } catch (e: SecurityException) {
            Log.e(TAG, "Permission denied for Bluetooth address")
            null
        }
    }

    /**
     * Ottiene il nome del Bluetooth adapter
     * @return nome dell'adapter o null se non disponibile
     */
    fun getBluetoothName(): String? {
        return try {
            bluetoothAdapter?.name
        } catch (e: SecurityException) {
            Log.e(TAG, "Permission denied for Bluetooth name")
            null
        }
    }
}

