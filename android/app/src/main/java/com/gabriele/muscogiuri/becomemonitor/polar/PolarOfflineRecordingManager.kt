package com.gabriele.muscogiuri.becomemonitor.polar

import android.util.Log
import com.polar.sdk.api.PolarBleApi
import com.polar.sdk.api.model.PolarOfflineRecordingData
import com.polar.sdk.api.model.PolarOfflineRecordingEntry
import com.polar.sdk.api.model.PolarPpiData
import io.reactivex.rxjava3.core.Completable
import io.reactivex.rxjava3.core.Single
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * Offline PPI recording on Polar 360 / Loop Gen 2 (FEATURE_POLAR_OFFLINE_RECORDING).
 * Raw pulse-to-pulse intervals on device memory; fetch at session end.
 */
class PolarOfflineRecordingManager(private val api: PolarBleApi) {

    companion object {
        private const val TAG = "PolarOfflineRecMgr"
        private val ISO_FORMAT = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
    }

    data class OfflinePpiSample(
        val ppiMs: Int,
        val hr: Int,
        val errorEstimate: Int,
        val blockerBit: Boolean,
        val t: String?,
        val timestampNs: Long?,
    )

    data class OfflinePpiTrack(
        val path: String,
        val size: Long,
        val startedAt: String?,
        val samples: List<OfflinePpiSample>,
        val entry: PolarOfflineRecordingEntry,
    )

    fun startPpiOfflineRecording(deviceId: String): Completable {
        Log.d(TAG, "startPpiOfflineRecording $deviceId")
        return api.startOfflineRecording(
            deviceId,
            PolarBleApi.PolarDeviceDataType.PPI,
            null,
            null
        ).doOnComplete {
            Log.d(TAG, "PPI offline recording started for $deviceId")
        }.doOnError { error ->
            Log.e(TAG, "startPpiOfflineRecording failed: ${error.message}")
        }
    }

    fun stopPpiOfflineRecording(deviceId: String): Completable {
        Log.d(TAG, "stopPpiOfflineRecording $deviceId")
        return api.stopOfflineRecording(deviceId, PolarBleApi.PolarDeviceDataType.PPI)
            .doOnComplete {
                Log.d(TAG, "PPI offline recording stopped for $deviceId")
            }
            .onErrorComplete { error ->
                // Already stopped / nothing recording — treat as success for flush path
                Log.w(TAG, "stopPpiOfflineRecording soft-fail: ${error.message}")
                true
            }
    }

    fun fetchLatestPpiRecord(deviceId: String): Single<OfflinePpiTrack> {
        Log.d(TAG, "fetchLatestPpiRecord $deviceId")
        return api.listOfflineRecordings(deviceId)
            .filter { it.type == PolarBleApi.PolarDeviceDataType.PPI }
            .toList()
            .flatMap { entries ->
                if (entries.isEmpty()) {
                    Single.error(IllegalStateException("No PPI offline recordings on device"))
                } else {
                    val latest = entries.maxByOrNull { it.date.time }
                        ?: entries.last()
                    api.getOfflineRecord(deviceId, latest, null)
                        .map { data -> toTrack(latest, data) }
                }
            }
    }

    fun removeRecord(deviceId: String, entry: PolarOfflineRecordingEntry): Completable {
        Log.d(TAG, "removeOfflineRecord ${entry.path}")
        return api.removeOfflineRecord(deviceId, entry)
    }

    fun removeRecordByPath(deviceId: String, path: String): Completable {
        return api.listOfflineRecordings(deviceId)
            .filter { it.path == path }
            .firstOrError()
            .flatMapCompletable { entry -> removeRecord(deviceId, entry) }
    }

    private fun toTrack(
        entry: PolarOfflineRecordingEntry,
        data: PolarOfflineRecordingData
    ): OfflinePpiTrack {
        val ppiData: PolarPpiData? = when (data) {
            is PolarOfflineRecordingData.PpiOfflineRecording -> data.data
            else -> null
        }
        val startedAt = try {
            data.startTime?.time?.let { ISO_FORMAT.format(it) }
                ?: entry.date?.let { ISO_FORMAT.format(it) }
        } catch (_: Exception) {
            entry.date?.let { ISO_FORMAT.format(it) }
        }

        val samples = ppiData?.samples?.map { sample ->
            OfflinePpiSample(
                ppiMs = sample.ppi,
                hr = sample.hr,
                errorEstimate = sample.errorEstimate,
                blockerBit = sample.blockerBit,
                t = null,
                timestampNs = null,
            )
        } ?: emptyList()

        return OfflinePpiTrack(
            path = entry.path,
            size = entry.size,
            startedAt = startedAt,
            samples = samples,
            entry = entry,
        )
    }
}
