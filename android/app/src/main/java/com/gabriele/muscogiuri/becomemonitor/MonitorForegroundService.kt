package com.gabriele.muscogiuri.becomemonitor

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Keeps the process eligible for network + BLE work while the screen is locked.
 * Uses FGS type connectedDevice (required on Android 14+).
 * Notification shows connected device + live HR / HRV / LF / HF.
 */
class MonitorForegroundService : Service() {

    companion object {
        private const val TAG = "MonitorFgs"
        private const val CHANNEL_ID = "become_monitor_streaming"
        private const val NOTIFICATION_ID = 3601

        const val ACTION_START = "com.gabriele.muscogiuri.becomemonitor.action.START_MONITOR_FGS"
        const val ACTION_STOP = "com.gabriele.muscogiuri.becomemonitor.action.STOP_MONITOR_FGS"
        const val ACTION_UPDATE = "com.gabriele.muscogiuri.becomemonitor.action.UPDATE_MONITOR_FGS"

        const val EXTRA_DEVICE_NAME = "deviceName"
        const val EXTRA_HR = "hr"
        const val EXTRA_HRV = "hrv"
        const val EXTRA_LF = "lf"
        const val EXTRA_HF = "hf"

        @Volatile
        private var deviceName: String = "Polar"
        @Volatile
        private var heartRate: Int = 0
        @Volatile
        private var hrv: Int = 0
        @Volatile
        private var lfPower: Int = 0
        @Volatile
        private var hfPower: Int = 0
        @Volatile
        private var running: Boolean = false

        fun start(context: Context, deviceName: String? = null) {
            if (!deviceName.isNullOrBlank()) {
                this.deviceName = deviceName
            }
            val intent = Intent(context, MonitorForegroundService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_DEVICE_NAME, Companion.deviceName)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun update(
            context: Context,
            deviceName: String?,
            hr: Int,
            hrv: Int,
            lf: Int,
            hf: Int
        ) {
            if (!deviceName.isNullOrBlank()) {
                this.deviceName = deviceName
            }
            this.heartRate = hr
            this.hrv = hrv
            this.lfPower = lf
            this.hfPower = hf

            if (!running) return

            val intent = Intent(context, MonitorForegroundService::class.java).apply {
                action = ACTION_UPDATE
                putExtra(EXTRA_DEVICE_NAME, Companion.deviceName)
                putExtra(EXTRA_HR, hr)
                putExtra(EXTRA_HRV, hrv)
                putExtra(EXTRA_LF, lf)
                putExtra(EXTRA_HF, hf)
            }
            context.startService(intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, MonitorForegroundService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }

        fun formatContentText(hr: Int, hrv: Int, lf: Int, hf: Int): String {
            fun v(n: Int) = if (n > 0) n.toString() else "—"
            return "HR ${v(hr)} · HRV ${v(hrv)} · LF ${v(lf)} · HF ${v(hf)}"
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                Log.d(TAG, "Stopping foreground service")
                running = false
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_UPDATE -> {
                applyExtras(intent)
                if (running) {
                    notifyUpdated()
                }
            }
            else -> {
                Log.d(TAG, "Starting foreground service")
                applyExtras(intent)
                ensureChannel()
                val notification = buildNotification()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(
                        NOTIFICATION_ID,
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
                    )
                } else {
                    startForeground(NOTIFICATION_ID, notification)
                }
                running = true
            }
        }
        return START_STICKY
    }

    private fun applyExtras(intent: Intent?) {
        if (intent == null) return
        intent.getStringExtra(EXTRA_DEVICE_NAME)?.takeIf { it.isNotBlank() }?.let {
            deviceName = it
        }
        if (intent.hasExtra(EXTRA_HR)) heartRate = intent.getIntExtra(EXTRA_HR, heartRate)
        if (intent.hasExtra(EXTRA_HRV)) hrv = intent.getIntExtra(EXTRA_HRV, hrv)
        if (intent.hasExtra(EXTRA_LF)) lfPower = intent.getIntExtra(EXTRA_LF, lfPower)
        if (intent.hasExtra(EXTRA_HF)) hfPower = intent.getIntExtra(EXTRA_HF, hfPower)
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java) ?: return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Monitor biometrico",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Mantiene attiva la connessione Polar e lo streaming mentre lo schermo è bloccato"
            setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
    }

    private fun notifyUpdated() {
        val manager = getSystemService(NotificationManager::class.java) ?: return
        manager.notify(NOTIFICATION_ID, buildNotification())
    }

    private fun buildNotification(): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val title = deviceName.ifBlank { "Become Monitor" }
        val body = formatContentText(heartRate, hrv, lfPower, hfPower)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText("$title\n$body"))
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true)
            .build()
    }
}
