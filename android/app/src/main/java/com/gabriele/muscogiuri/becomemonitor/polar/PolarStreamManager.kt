package com.gabriele.muscogiuri.becomemonitor.polar

import android.util.Log
import com.polar.sdk.api.PolarBleApi
import com.polar.sdk.api.model.PolarPpiData
import io.reactivex.rxjava3.android.schedulers.AndroidSchedulers
import io.reactivex.rxjava3.disposables.Disposable
import io.reactivex.rxjava3.schedulers.Schedulers

/**
 * PolarStreamManager
 * Gestisce lo streaming dei dati PPI (RR intervals) dai dispositivi Polar
 */
class PolarStreamManager(private val api: PolarBleApi) {

    companion object {
        private const val TAG = "PolarStreamManager"
    }

    private var ppiDisposable: Disposable? = null

    // Callbacks
    var onPpiDataReceived: ((String, PolarPpiData) -> Unit)? = null
    var onPpiStreamError: ((Throwable) -> Unit)? = null
    var onPpiNotAvailable: ((Throwable) -> Unit)? = null

    /**
     * Avvia lo streaming dei dati PPI
     */
    fun startPpiStreaming(deviceId: String): Result<Unit> {
        return try {
            if (ppiDisposable?.isDisposed == false) {
                ppiDisposable?.dispose()
            }

            Log.d(TAG, "📊 Starting PPI stream for $deviceId...")

            // Prima verifica se PPI è disponibile
            api.requestStreamSettings(deviceId, PolarBleApi.PolarDeviceDataType.PPI)
                .observeOn(AndroidSchedulers.mainThread())
                .subscribe({ settings ->
                    Log.d(TAG, "✅ PPI available with settings: $settings")

                    // Avvia lo streaming
                    ppiDisposable = api.startPpiStreaming(deviceId)
                        .observeOn(AndroidSchedulers.mainThread())
                        .subscribe({ ppiData ->
                            Log.d(TAG, "📊 PPI Data: ${ppiData.samples.size} samples")
                            onPpiDataReceived?.invoke(deviceId, ppiData)
                        }, { error ->
                            Log.e(TAG, "❌ PPI stream error: ${error.message}")
                            onPpiStreamError?.invoke(error)
                        })
                }, { error ->
                    Log.e(TAG, "❌ PPI not available: ${error.message}")
                    onPpiNotAvailable?.invoke(error)
                })

            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "❌ PPI stream exception: ${e.message}")
            Result.failure(e)
        }
    }

    /**
     * Ferma lo streaming PPI
     */
    fun stopPpiStreaming(): Result<Unit> {
        return try {
            ppiDisposable?.dispose()
            ppiDisposable = null
            Log.d(TAG, "PPI streaming stopped")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop PPI streaming: ${e.message}")
            Result.failure(e)
        }
    }

    /**
     * Verifica se lo streaming è attivo
     */
    fun isStreaming(): Boolean = ppiDisposable?.isDisposed == false

    /**
     * Cleanup delle risorse
     */
    fun cleanup() {
        ppiDisposable?.dispose()
        ppiDisposable = null
    }
}

