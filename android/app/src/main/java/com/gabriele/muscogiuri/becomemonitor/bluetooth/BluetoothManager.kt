package com.gabriele.muscogiuri.becomemonitor.bluetooth

import android.Manifest
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * BluetoothManager
 * Gestisce lo stato del Bluetooth, permessi e operazioni Bluetooth
 */
class BluetoothManager(private val context: Context) {

    companion object {
        private const val REQUEST_ENABLE_BT = 1000
        private const val REQUEST_BLUETOOTH_PERMISSIONS = 1001
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
    fun isBluetoothEnabled(): Boolean = bluetoothAdapter?.isEnabled ?: false

    /**
     * Verifica se il Bluetooth è supportato sul dispositivo
     * @return true se il Bluetooth è supportato, false altrimenti
     */
    fun isBluetoothSupported(): Boolean = bluetoothAdapter != null

    /**
     * Ottiene l'indirizzo MAC del Bluetooth adapter
     * @return indirizzo MAC o null se non disponibile
     */
    fun getBluetoothAddress(): String? = try {
        bluetoothAdapter?.address
    } catch (_: SecurityException) {
        null
    }

    /**
     * Ottiene il nome del Bluetooth adapter
     * @return nome dell'adapter o null se non disponibile
     */
    fun getBluetoothName(): String? = try {
        bluetoothAdapter?.name
    } catch (_: SecurityException) {
        null
    }

    /**
     * Verifica se i permessi Bluetooth sono concessi
     * @return true se i permessi sono concessi, false altrimenti
     */
    fun hasBluetoothPermissions(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Android 12+ richiede BLUETOOTH_CONNECT e BLUETOOTH_SCAN
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.BLUETOOTH_CONNECT
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.BLUETOOTH_SCAN
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        } else {
            // Android 11 e precedenti richiedono ACCESS_FINE_LOCATION
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.BLUETOOTH
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.BLUETOOTH_ADMIN
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        }
    }

    /**
     * Richiede i permessi Bluetooth necessari
     * @param activity Activity corrente per mostrare il dialog dei permessi
     */
    fun requestBluetoothPermissions(activity: Activity) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Android 12+
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(
                    Manifest.permission.BLUETOOTH_CONNECT,
                    Manifest.permission.BLUETOOTH_SCAN,
                    Manifest.permission.ACCESS_FINE_LOCATION
                ),
                REQUEST_BLUETOOTH_PERMISSIONS
            )
        } else {
            // Android 11 e precedenti
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.BLUETOOTH,
                    Manifest.permission.BLUETOOTH_ADMIN
                ),
                REQUEST_BLUETOOTH_PERMISSIONS
            )
        }
    }

    /**
     * Richiede di attivare il Bluetooth
     * @param activity Activity corrente per mostrare il dialog
     * @return true se la richiesta è stata inviata, false se il Bluetooth è già attivo
     */
    fun requestEnableBluetooth(activity: Activity): Boolean {
        return when {
            !isBluetoothSupported() -> false
            isBluetoothEnabled() -> true
            else -> {
                val enableBtIntent = Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)
                activity.startActivityForResult(enableBtIntent, REQUEST_ENABLE_BT)
                true
            }
        }
    }

    // openBluetoothSettings rimosso: non supportiamo più lo spegnimento via app

    /**
     * Attiva o disattiva il Bluetooth (richiede permessi speciali)
     * @param enable true per attivare, false per disattivare
     * @return true se l'operazione è riuscita, false altrimenti
     */
    fun setBluetoothEnabled(enable: Boolean): Result<Boolean> {
        return try {
            if (!hasBluetoothPermissions()) {
                return Result.failure(SecurityException("Bluetooth permissions not granted"))
            }
            val adapter = bluetoothAdapter ?: return Result.failure(
                IllegalStateException("Bluetooth adapter not available")
            )
            if (enable) {
                Result.success(adapter.enable())
            } else {
                Result.failure(UnsupportedOperationException("Disable not supported by app"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // Rimosso: metodi alternativi e permessi speciali per lo spegnimento
}

