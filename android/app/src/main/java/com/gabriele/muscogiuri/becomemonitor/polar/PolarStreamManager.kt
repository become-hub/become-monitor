package com.gabriele.muscogiuri.becomemonitor.polar

import android.util.Log
import com.polar.sdk.api.PolarBleApi
import com.polar.sdk.api.model.PolarPpiData
import io.reactivex.rxjava3.android.schedulers.AndroidSchedulers
import io.reactivex.rxjava3.core.Completable
import io.reactivex.rxjava3.disposables.Disposable
import io.reactivex.rxjava3.schedulers.Schedulers

/**
 * PolarStreamManager
 * Gestisce lo streaming dei dati PPI (RR intervals) dai dispositivi Polar.
 *
 * Nota: per PPI non va chiamato requestStreamSettings — il SDK Polar
 * risponde sempre PolarOperationNotSupported (HR/PPI non hanno settings).
 * Va usato direttamente startPpiStreaming.
 */
class PolarStreamManager(private val api: PolarBleApi) {

    companion object {
        private const val TAG = "PolarStreamManager"
    }

    private var ppiDisposable: Disposable? = null

    var onPpiDataReceived: ((String, PolarPpiData) -> Unit)? = null
    var onPpiStreamError: ((Throwable) -> Unit)? = null

    /**
     * Avvia lo streaming PPI. Completa quando la subscription è attiva;
     * errori di stream successivi arrivano via onPpiStreamError.
     */
    fun startPpiStreaming(deviceId: String): Completable {
        return Completable.create { emitter ->
            try {
                if (ppiDisposable?.isDisposed == false) {
                    ppiDisposable?.dispose()
                }

                Log.d(TAG, "📊 Starting PPI stream for $deviceId...")

                ppiDisposable = api.startPpiStreaming(deviceId)
                    .subscribeOn(Schedulers.io())
                    .observeOn(AndroidSchedulers.mainThread())
                    .subscribe({ ppiData ->
                        Log.d(TAG, "📊 PPI Data: ${ppiData.samples.size} samples")
                        onPpiDataReceived?.invoke(deviceId, ppiData)
                    }, { error ->
                        Log.e(TAG, "❌ PPI stream error: ${error.javaClass.simpleName}: ${error.message}")
                        onPpiStreamError?.invoke(error)
                    })

                if (!emitter.isDisposed) {
                    emitter.onComplete()
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ PPI stream exception: ${e.message}")
                if (!emitter.isDisposed) {
                    emitter.onError(e)
                }
            }
        }
    }

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

    fun isStreaming(): Boolean = ppiDisposable?.isDisposed == false

    fun cleanup() {
        ppiDisposable?.dispose()
        ppiDisposable = null
    }
}
