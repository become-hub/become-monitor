package com.gabriele.muscogiuri.becomemonitor.polar

import com.polar.sdk.api.PolarBleApi
import com.polar.sdk.api.model.PolarFirstTimeUseConfig
import io.reactivex.rxjava3.core.Completable
import io.reactivex.rxjava3.core.Single
import io.reactivex.rxjava3.subjects.CompletableSubject
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Calendar
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/**
 * Gestisce First Time Use (FTU) per Polar 360 / Loop Gen 2 secondo Polar BLE SDK.
 *
 * Building block pubblici (riutilizzabili):
 * - [waitForFtuFeatures], [isFtuDone], [performFirstTimeUse], [restartDevice]
 *
 * Facade: [ensureFirstTimeUse] orchestra i pezzi. Dopo doFirstTimeUse il device
 * deve riavviarsi: emettiamo doRestart e restituiamo performed=true.
 */
class PolarFtuManager(private val api: PolarBleApi) {

    companion object {
        private const val FEATURE_TIMEOUT_SECONDS = 45L

        fun defaultFtuConfig(): PolarFirstTimeUseConfig {
            val birthDate = Calendar.getInstance().apply {
                set(1990, Calendar.JANUARY, 1, 0, 0, 0)
                set(Calendar.MILLISECOND, 0)
            }.time

            // Polar SDK validates with SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'") —
            // fractional seconds (ISO_OFFSET_DATE_TIME) cause "Invalid deviceTime format".
            val deviceTime = ZonedDateTime.now(ZoneOffset.UTC)
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'"))

            return PolarFirstTimeUseConfig(
                // TODO: ricordiamoci di settare questi valori dagli input dell'app Become!
                gender = PolarFirstTimeUseConfig.Gender.MALE,
                birthDate = birthDate,
                height = 175f,
                weight = 70f,
                maxHeartRate = 190,
                vo2Max = 45,
                restingHeartRate = 60,
                trainingBackground = 30,
                deviceTime = deviceTime,
                typicalDay = PolarFirstTimeUseConfig.TypicalDay.MOSTLY_SITTING,
                sleepGoalMinutes = 480
            )
        }
    }

    private val readyFeatures =
        ConcurrentHashMap.newKeySet<Pair<String, PolarBleApi.PolarBleSdkFeature>>()
    private val featureWaiters =
        ConcurrentHashMap<Pair<String, PolarBleApi.PolarBleSdkFeature>, CompletableSubject>()

    fun onFeatureReady(deviceId: String, feature: PolarBleApi.PolarBleSdkFeature) {
        val key = deviceId to feature
        readyFeatures.add(key)
        featureWaiters.remove(key)?.onComplete()
    }

    fun onDeviceDisconnected(deviceId: String) {
        readyFeatures.removeIf { it.first == deviceId }
        featureWaiters.keys
            .filter { it.first == deviceId }
            .forEach { key ->
                featureWaiters.remove(key)?.onError(
                    IllegalStateException("Device disconnected before feature ${key.second} was ready")
                )
            }
    }

    /** Attende FILE_TRANSFER + DEVICE_TIME_SETUP (prerequisiti FTU). */
    fun waitForFtuFeatures(deviceId: String): Completable {
        return waitForFeature(deviceId, PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_FILE_TRANSFER)
            .andThen(
                waitForFeature(
                    deviceId,
                    PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_DEVICE_TIME_SETUP
                )
            )
    }

    fun isFtuDone(deviceId: String): Single<Boolean> {
        return waitForFeature(deviceId, PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_FILE_TRANSFER)
            .andThen(api.isFtuDone(deviceId))
    }

    /** Scrive la config FTU sul device (senza restart). */
    fun performFirstTimeUse(
        deviceId: String,
        config: PolarFirstTimeUseConfig = defaultFtuConfig()
    ): Completable {
        return api.doFirstTimeUse(deviceId, config)
    }

    /**
     * Riavvia il device dopo FTU. Errori ignorati se già disconnesso.
     */
    fun restartDevice(deviceId: String): Completable {
        return api.doRestart(deviceId).onErrorComplete()
    }

    /**
     * Orchestratore: attende feature, esegue FTU+restart se mancante.
     * @return true se FTU è stato appena eseguito (device in restart).
     */
    fun ensureFirstTimeUse(deviceId: String): Single<Boolean> {
        return waitForFtuFeatures(deviceId)
            .andThen(
                Single.defer {
                    api.isFtuDone(deviceId)
                        .flatMap { done ->
                            if (done) {
                                Single.just(false)
                            } else {
                                performFirstTimeUse(deviceId)
                                    .andThen(restartDevice(deviceId))
                                    .andThen(Single.just(true))
                            }
                        }
                }
            )
    }

    private fun waitForFeature(
        deviceId: String,
        feature: PolarBleApi.PolarBleSdkFeature
    ): Completable {
        if (api.isFeatureReady(deviceId, feature) || readyFeatures.contains(deviceId to feature)) {
            return Completable.complete()
        }

        val key = deviceId to feature
        val subject = featureWaiters.getOrPut(key) { CompletableSubject.create() }

        // Race: feature may have become ready between check and waiter registration
        if (api.isFeatureReady(deviceId, feature) || readyFeatures.contains(key)) {
            subject.onComplete()
            featureWaiters.remove(key)
            return Completable.complete()
        }

        return subject
            .timeout(FEATURE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .doOnError {
                featureWaiters.remove(key)
            }
            .doOnComplete {
                featureWaiters.remove(key)
            }
    }

    fun cleanup() {
        readyFeatures.clear()
        featureWaiters.values.forEach { subject ->
            if (!subject.hasComplete() && !subject.hasThrowable()) {
                subject.onError(IllegalStateException("PolarFtuManager cleaned up"))
            }
        }
        featureWaiters.clear()
    }
}
