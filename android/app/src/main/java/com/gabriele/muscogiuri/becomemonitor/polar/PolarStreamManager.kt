package com.gabriele.muscogiuri.becomemonitor.polar

import android.util.Log
import com.polar.sdk.api.PolarBleApi
import com.polar.sdk.api.model.PolarPpiData
import io.reactivex.rxjava3.android.schedulers.AndroidSchedulers
import io.reactivex.rxjava3.core.Completable
import io.reactivex.rxjava3.core.Flowable
import io.reactivex.rxjava3.disposables.Disposable
import io.reactivex.rxjava3.schedulers.Schedulers
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import java.util.concurrent.atomic.AtomicBoolean

/**
 * PolarStreamManager
 * Gestisce lo streaming dei dati PPI (RR intervals) dai dispositivi Polar.
 *
 * Nota: per PPI non va chiamato requestStreamSettings — il SDK Polar
 * risponde sempre PolarOperationNotSupported (HR/PPI non hanno settings).
 * Va usato direttamente startPpiStreaming.
 *
 * [awaitFirstSample] è il building block riusabile per stream futuri (HR, Loop, …).
 */
class PolarStreamManager(private val api: PolarBleApi) {

    companion object {
        private const val TAG = "PolarStreamManager"
        private const val FIRST_SAMPLE_TIMEOUT_SECONDS = 45L
    }

    private var ppiDisposable: Disposable? = null
    private var firstSampleTimeoutDisposable: Disposable? = null

    var onPpiDataReceived: ((String, PolarPpiData) -> Unit)? = null
    var onPpiStreamError: ((Throwable) -> Unit)? = null

    /**
     * Sottoscrive [source], completa al primo campione (o errore/timeout).
     * La subscription resta attiva dopo il complete.
     *
     * @param retainDisposable chiamato con il Disposable dello stream (per stop/cleanup)
     * @param retainTimeoutDisposable chiamato con il Disposable del timer first-sample
     */
    internal fun <T : Any> awaitFirstSample(
        source: Flowable<T>,
        onData: (T) -> Unit,
        onError: (Throwable) -> Unit,
        retainDisposable: (Disposable) -> Unit,
        retainTimeoutDisposable: (Disposable) -> Unit,
        timeoutSeconds: Long = FIRST_SAMPLE_TIMEOUT_SECONDS,
        timeoutMessage: String = "Nessun campione entro ${timeoutSeconds}s"
    ): Completable {
        return Completable.create { emitter ->
            try {
                val settled = AtomicBoolean(false)
                var timeoutDisposable: Disposable? = null

                fun completeOnce() {
                    if (settled.compareAndSet(false, true) && !emitter.isDisposed) {
                        timeoutDisposable?.dispose()
                        emitter.onComplete()
                    }
                }

                fun errorOnce(error: Throwable) {
                    if (settled.compareAndSet(false, true) && !emitter.isDisposed) {
                        timeoutDisposable?.dispose()
                        emitter.onError(error)
                    }
                }

                val streamDisposable = source
                    .subscribeOn(Schedulers.io())
                    .observeOn(AndroidSchedulers.mainThread())
                    .subscribe({ data ->
                        onData(data)
                        completeOnce()
                    }, { error ->
                        onError(error)
                        errorOnce(error)
                    })
                retainDisposable(streamDisposable)

                timeoutDisposable = Completable.timer(timeoutSeconds, TimeUnit.SECONDS)
                    .subscribe({
                        streamDisposable.dispose()
                        errorOnce(TimeoutException(timeoutMessage))
                    }, { /* ignore */ })
                retainTimeoutDisposable(timeoutDisposable!!)
            } catch (e: Exception) {
                if (!emitter.isDisposed) {
                    emitter.onError(e)
                }
            }
        }
    }

    /**
     * Avvia lo streaming PPI. Completa al **primo campione** (o errore/timeout),
     * così il chiamante sa se il device sta davvero misurando.
     * La subscription resta attiva dopo il complete.
     */
    fun startPpiStreaming(deviceId: String): Completable {
        if (ppiDisposable?.isDisposed == false) {
            ppiDisposable?.dispose()
        }
        firstSampleTimeoutDisposable?.dispose()

        Log.d(TAG, "📊 Starting PPI stream for $deviceId...")

        return awaitFirstSample(
            source = api.startPpiStreaming(deviceId),
            onData = { ppiData ->
                Log.d(TAG, "📊 PPI Data: ${ppiData.samples.size} samples")
                onPpiDataReceived?.invoke(deviceId, ppiData)
            },
            onError = { error ->
                Log.e(
                    TAG,
                    "❌ PPI stream error: ${error.javaClass.simpleName}: ${error.message}"
                )
                onPpiStreamError?.invoke(error)
            },
            retainDisposable = { ppiDisposable = it },
            retainTimeoutDisposable = { firstSampleTimeoutDisposable = it },
            timeoutMessage = "Nessun campione PPI entro ${FIRST_SAMPLE_TIMEOUT_SECONDS}s"
        )
    }

    fun stopPpiStreaming(): Result<Unit> {
        return try {
            firstSampleTimeoutDisposable?.dispose()
            firstSampleTimeoutDisposable = null
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
        firstSampleTimeoutDisposable?.dispose()
        firstSampleTimeoutDisposable = null
        ppiDisposable?.dispose()
        ppiDisposable = null
    }
}
