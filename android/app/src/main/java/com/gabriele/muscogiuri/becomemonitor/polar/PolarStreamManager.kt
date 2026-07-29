package com.gabriele.muscogiuri.becomemonitor.polar

import android.util.Log
import com.polar.sdk.api.PolarBleApi
import com.polar.sdk.api.model.PolarEcgData
import com.polar.sdk.api.model.PolarHrData
import com.polar.sdk.api.model.PolarPpiData
import com.polar.sdk.api.model.PolarTemperatureData
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
 * Gestisce lo streaming PPI (360/Loop), HR+RR (H10) ed ECG (H10).
 *
 * Nota: per PPI non va chiamato requestStreamSettings — il SDK Polar
 * risponde sempre PolarOperationNotSupported (HR/PPI non hanno settings).
 * Va usato direttamente startPpiStreaming.
 *
 * [awaitFirstSample] è il building block riusabile per stream futuri.
 */
class PolarStreamManager(private val api: PolarBleApi) {

    companion object {
        private const val TAG = "PolarStreamManager"
        private const val FIRST_SAMPLE_TIMEOUT_SECONDS = 45L
    }

    private var ppiDisposable: Disposable? = null
    private var ppiFirstSampleTimeoutDisposable: Disposable? = null
    private var hrDisposable: Disposable? = null
    private var hrFirstSampleTimeoutDisposable: Disposable? = null
    private var ecgDisposable: Disposable? = null
    private var ecgFirstSampleTimeoutDisposable: Disposable? = null
    private var skinTemperatureDisposable: Disposable? = null
    private var skinTemperatureFirstSampleTimeoutDisposable: Disposable? = null

    var onPpiDataReceived: ((String, PolarPpiData) -> Unit)? = null
    var onPpiStreamError: ((Throwable) -> Unit)? = null
    var onHrDataReceived: ((String, PolarHrData) -> Unit)? = null
    var onHrStreamError: ((Throwable) -> Unit)? = null
    var onEcgDataReceived: ((String, PolarEcgData) -> Unit)? = null
    var onEcgStreamError: ((Throwable) -> Unit)? = null
    var onSkinTemperatureDataReceived: ((String, PolarTemperatureData) -> Unit)? =
        null
    var onSkinTemperatureStreamError: ((Throwable) -> Unit)? = null

    /**
     * Sottoscrive [source], completa al primo campione (o errore/timeout).
     * La subscription resta attiva dopo il complete.
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

    fun startPpiStreaming(deviceId: String): Completable {
        if (ppiDisposable?.isDisposed == false) {
            ppiDisposable?.dispose()
        }
        ppiFirstSampleTimeoutDisposable?.dispose()

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
            retainTimeoutDisposable = { ppiFirstSampleTimeoutDisposable = it },
            timeoutMessage = "Nessun campione PPI entro ${FIRST_SAMPLE_TIMEOUT_SECONDS}s"
        )
    }

    fun startHrStreaming(deviceId: String): Completable {
        if (hrDisposable?.isDisposed == false) {
            hrDisposable?.dispose()
        }
        hrFirstSampleTimeoutDisposable?.dispose()

        Log.d(TAG, "💓 Starting HR stream for $deviceId...")

        return awaitFirstSample(
            source = api.startHrStreaming(deviceId),
            onData = { hrData ->
                Log.d(TAG, "💓 HR Data: ${hrData.samples.size} samples")
                onHrDataReceived?.invoke(deviceId, hrData)
            },
            onError = { error ->
                Log.e(
                    TAG,
                    "❌ HR stream error: ${error.javaClass.simpleName}: ${error.message}"
                )
                onHrStreamError?.invoke(error)
            },
            retainDisposable = { hrDisposable = it },
            retainTimeoutDisposable = { hrFirstSampleTimeoutDisposable = it },
            timeoutMessage = "Nessun campione HR entro ${FIRST_SAMPLE_TIMEOUT_SECONDS}s"
        )
    }

    fun startEcgStreaming(deviceId: String): Completable {
        if (ecgDisposable?.isDisposed == false) {
            ecgDisposable?.dispose()
        }
        ecgFirstSampleTimeoutDisposable?.dispose()

        Log.d(TAG, "📈 Starting ECG stream for $deviceId...")

        return api.requestStreamSettings(deviceId, PolarBleApi.PolarDeviceDataType.ECG)
            .flatMapCompletable { settings ->
                awaitFirstSample(
                    source = api.startEcgStreaming(deviceId, settings.maxSettings()),
                    onData = { ecgData ->
                        Log.d(TAG, "📈 ECG Data: ${ecgData.samples.size} samples")
                        onEcgDataReceived?.invoke(deviceId, ecgData)
                    },
                    onError = { error ->
                        Log.e(
                            TAG,
                            "❌ ECG stream error: ${error.javaClass.simpleName}: ${error.message}"
                        )
                        onEcgStreamError?.invoke(error)
                    },
                    retainDisposable = { ecgDisposable = it },
                    retainTimeoutDisposable = { ecgFirstSampleTimeoutDisposable = it },
                    timeoutMessage = "Nessun campione ECG entro ${FIRST_SAMPLE_TIMEOUT_SECONDS}s"
                )
            }
    }

    fun startSkinTemperatureStreaming(deviceId: String): Completable {
        if (skinTemperatureDisposable?.isDisposed == false) {
            skinTemperatureDisposable?.dispose()
        }
        skinTemperatureFirstSampleTimeoutDisposable?.dispose()

        Log.d(TAG, "🌡️ Starting Skin Temperature stream for $deviceId...")

        return api.requestStreamSettings(
            deviceId,
            PolarBleApi.PolarDeviceDataType.SKIN_TEMPERATURE
        )
            .flatMapCompletable { settings ->
                awaitFirstSample(
                    source = api.startSkinTemperatureStreaming(
                        deviceId,
                        settings.maxSettings()
                    ),
                    onData = { temperatureData ->
                        val sampleCount = temperatureData.samples.size
                        Log.d(
                            TAG,
                            "🌡️ Skin Temperature Data: $sampleCount samples"
                        )
                        onSkinTemperatureDataReceived?.invoke(
                            deviceId,
                            temperatureData
                        )
                    },
                    onError = { error ->
                        Log.e(
                            TAG,
                            "❌ Skin Temperature stream error: ${error.javaClass.simpleName}: ${error.message}"
                        )
                        onSkinTemperatureStreamError?.invoke(error)
                    },
                    retainDisposable = { skinTemperatureDisposable = it },
                    retainTimeoutDisposable = {
                        skinTemperatureFirstSampleTimeoutDisposable = it
                    },
                    timeoutMessage = "Nessun campione Skin Temperature entro ${FIRST_SAMPLE_TIMEOUT_SECONDS}s"
                )
            }
    }

    fun stopPpiStreaming(): Result<Unit> {
        return try {
            ppiFirstSampleTimeoutDisposable?.dispose()
            ppiFirstSampleTimeoutDisposable = null
            ppiDisposable?.dispose()
            ppiDisposable = null
            Log.d(TAG, "PPI streaming stopped")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop PPI streaming: ${e.message}")
            Result.failure(e)
        }
    }

    fun stopHrStreaming(): Result<Unit> {
        return try {
            hrFirstSampleTimeoutDisposable?.dispose()
            hrFirstSampleTimeoutDisposable = null
            hrDisposable?.dispose()
            hrDisposable = null
            Log.d(TAG, "HR streaming stopped")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop HR streaming: ${e.message}")
            Result.failure(e)
        }
    }

    fun stopEcgStreaming(): Result<Unit> {
        return try {
            ecgFirstSampleTimeoutDisposable?.dispose()
            ecgFirstSampleTimeoutDisposable = null
            ecgDisposable?.dispose()
            ecgDisposable = null
            Log.d(TAG, "ECG streaming stopped")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop ECG streaming: ${e.message}")
            Result.failure(e)
        }
    }

    fun isPpiStreaming(): Boolean = ppiDisposable?.isDisposed == false
    fun isHrStreaming(): Boolean = hrDisposable?.isDisposed == false
    fun isEcgStreaming(): Boolean = ecgDisposable?.isDisposed == false

    fun isSkinTemperatureStreaming(): Boolean =
        skinTemperatureDisposable?.isDisposed == false

    fun isStreaming(): Boolean =
        isPpiStreaming() || isHrStreaming() || isEcgStreaming() || isSkinTemperatureStreaming()

    fun cleanup() {
        ppiFirstSampleTimeoutDisposable?.dispose()
        ppiFirstSampleTimeoutDisposable = null
        ppiDisposable?.dispose()
        ppiDisposable = null
        hrFirstSampleTimeoutDisposable?.dispose()
        hrFirstSampleTimeoutDisposable = null
        hrDisposable?.dispose()
        hrDisposable = null
        ecgFirstSampleTimeoutDisposable?.dispose()
        ecgFirstSampleTimeoutDisposable = null
        ecgDisposable?.dispose()
        ecgDisposable = null

        skinTemperatureFirstSampleTimeoutDisposable?.dispose()
        skinTemperatureFirstSampleTimeoutDisposable = null
        skinTemperatureDisposable?.dispose()
        skinTemperatureDisposable = null
    }

    fun stopSkinTemperatureStreaming(): Result<Unit> {
        return try {
            skinTemperatureFirstSampleTimeoutDisposable?.dispose()
            skinTemperatureFirstSampleTimeoutDisposable = null
            skinTemperatureDisposable?.dispose()
            skinTemperatureDisposable = null
            Log.d(TAG, "Skin Temperature streaming stopped")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop Skin Temperature streaming: ${e.message}")
            Result.failure(e)
        }
    }
}
