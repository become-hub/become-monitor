package com.gabriele.muscogiuri.becomemonitor.polar

import com.polar.sdk.api.PolarBleApi
import com.polar.sdk.api.model.PolarOfflineRecordingData
import com.polar.sdk.api.model.PolarOfflineRecordingEntry
import com.polar.sdk.api.model.PolarPpiData
import io.reactivex.rxjava3.core.Completable
import io.reactivex.rxjava3.core.Flowable
import io.reactivex.rxjava3.core.Single
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mock
import org.mockito.MockitoAnnotations
import org.mockito.junit.MockitoJUnitRunner
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Calendar
import java.util.Date

@RunWith(MockitoJUnitRunner::class)
class PolarOfflineRecordingManagerTest {

    @Mock
    private lateinit var mockApi: PolarBleApi

    private lateinit var manager: PolarOfflineRecordingManager

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        manager = PolarOfflineRecordingManager(mockApi)
    }

    @Test
    fun `startPpiOfflineRecording calls api with PPI`() {
        whenever(
            mockApi.startOfflineRecording(
                eq("DEV-1"),
                eq(PolarBleApi.PolarDeviceDataType.PPI),
                anyOrNull(),
                anyOrNull()
            )
        ).thenReturn(Completable.complete())

        manager.startPpiOfflineRecording("DEV-1").test().assertComplete()

        verify(mockApi).startOfflineRecording(
            "DEV-1",
            PolarBleApi.PolarDeviceDataType.PPI,
            null,
            null
        )
    }

    @Test
    fun `stopPpiOfflineRecording completes when api succeeds`() {
        whenever(
            mockApi.stopOfflineRecording("DEV-1", PolarBleApi.PolarDeviceDataType.PPI)
        ).thenReturn(Completable.complete())

        manager.stopPpiOfflineRecording("DEV-1").test().assertComplete()
    }

    @Test
    fun `stopPpiOfflineRecording soft-completes on error`() {
        whenever(
            mockApi.stopOfflineRecording("DEV-1", PolarBleApi.PolarDeviceDataType.PPI)
        ).thenReturn(Completable.error(RuntimeException("not recording")))

        manager.stopPpiOfflineRecording("DEV-1").test().assertComplete()
    }

    @Test
    fun `fetchLatestPpiRecord returns mapped samples`() {
        val entry = PolarOfflineRecordingEntry(
            "/PPI/rec1",
            100L,
            Date(1_700_000_000_000L),
            PolarBleApi.PolarDeviceDataType.PPI
        )
        val sample = org.mockito.kotlin.mock<PolarPpiData.PolarPpiSample>()
        whenever(sample.ppi).thenReturn(800)
        whenever(sample.hr).thenReturn(75)
        whenever(sample.errorEstimate).thenReturn(5)
        whenever(sample.blockerBit).thenReturn(false)
        val ppiData = PolarPpiData(listOf(sample))
        val calendar = Calendar.getInstance().apply { time = entry.date }
        val recording = PolarOfflineRecordingData.PpiOfflineRecording(ppiData, calendar)

        whenever(mockApi.listOfflineRecordings("DEV-1"))
            .thenReturn(Flowable.just(entry))
        whenever(mockApi.getOfflineRecord(eq("DEV-1"), eq(entry), anyOrNull()))
            .thenReturn(Single.just(recording))

        val observer = manager.fetchLatestPpiRecord("DEV-1").test()
        observer.assertValue { track ->
            track.path == "/PPI/rec1" &&
                track.samples.size == 1 &&
                track.samples[0].ppiMs == 800 &&
                track.samples[0].hr == 75
        }
        verify(mockApi, never()).removeOfflineRecord(any(), any())
    }

    @Test
    fun `fetchLatestPpiRecord errors when empty`() {
        whenever(mockApi.listOfflineRecordings("DEV-1"))
            .thenReturn(Flowable.empty())

        manager.fetchLatestPpiRecord("DEV-1").test()
            .assertError(IllegalStateException::class.java)
    }
}
