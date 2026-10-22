package com.gabriele.muscogiuri.becomemonitor.polar

import com.polar.sdk.api.PolarBleApi
import com.polar.sdk.api.model.PolarHrData
import com.polar.sdk.api.model.PolarPpiData
import io.reactivex.rxjava3.android.plugins.RxAndroidPlugins
import io.reactivex.rxjava3.core.Flowable
import io.reactivex.rxjava3.plugins.RxJavaPlugins
import io.reactivex.rxjava3.schedulers.Schedulers
import io.reactivex.rxjava3.schedulers.TestScheduler
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mock
import org.mockito.MockitoAnnotations
import org.mockito.junit.MockitoJUnitRunner
import org.mockito.kotlin.*
import java.util.concurrent.TimeUnit

@RunWith(MockitoJUnitRunner::class)
class PolarStreamManagerTest {

    @Mock
    private lateinit var mockApi: PolarBleApi

    private lateinit var streamManager: PolarStreamManager
    private lateinit var testScheduler: TestScheduler

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        testScheduler = TestScheduler()
        RxJavaPlugins.setComputationSchedulerHandler { testScheduler }
        RxJavaPlugins.setIoSchedulerHandler { testScheduler }
        RxJavaPlugins.setNewThreadSchedulerHandler { testScheduler }
        RxAndroidPlugins.setInitMainThreadSchedulerHandler { Schedulers.trampoline() }
        RxAndroidPlugins.setMainThreadSchedulerHandler { Schedulers.trampoline() }

        streamManager = PolarStreamManager(mockApi)
    }

    @After
    fun tearDown() {
        RxJavaPlugins.reset()
        RxAndroidPlugins.reset()
        streamManager.cleanup()
    }

    @Test
    fun `test startPpiStreaming emits PPI data`() {
        val deviceId = "TEST-123"
        val testPpiData = mock<PolarPpiData>()
        val mockSamples = listOf(
            mock<PolarPpiData.PolarPpiSample>(),
            mock<PolarPpiData.PolarPpiSample>()
        )
        whenever(testPpiData.samples).thenReturn(mockSamples)
        whenever(mockApi.startPpiStreaming(deviceId))
            .thenReturn(Flowable.just(testPpiData).delay(1, TimeUnit.SECONDS, testScheduler))

        var receivedData: PolarPpiData? = null
        streamManager.onPpiDataReceived = { _, data ->
            receivedData = data
        }

        val observer = streamManager.startPpiStreaming(deviceId).test()
        testScheduler.advanceTimeBy(2, TimeUnit.SECONDS)

        observer.assertComplete()
        assert(receivedData != null)
        verify(mockApi).startPpiStreaming(deviceId)
        verify(mockApi, never()).requestStreamSettings(any(), any())
    }

    @Test
    fun `test startPpiStreaming handles stream errors`() {
        val deviceId = "TEST-123"
        val testError = RuntimeException("Stream error")
        whenever(mockApi.startPpiStreaming(deviceId))
            .thenReturn(Flowable.error(testError))

        var errorReceived: Throwable? = null
        streamManager.onPpiStreamError = { error ->
            errorReceived = error
        }

        val observer = streamManager.startPpiStreaming(deviceId).test()
        testScheduler.triggerActions()

        observer.assertError { true }
        assert(errorReceived != null)
    }

    @Test
    fun `test stopPpiStreaming disposes subscription`() {
        val deviceId = "TEST-123"
        val testPpiData = mock<PolarPpiData>()
        whenever(testPpiData.samples).thenReturn(emptyList())
        whenever(mockApi.startPpiStreaming(deviceId))
            .thenReturn(Flowable.just(testPpiData))

        streamManager.startPpiStreaming(deviceId).test()
        testScheduler.triggerActions()

        val result = streamManager.stopPpiStreaming()
        assert(result.isSuccess)
    }

    @Test
    fun `test isStreaming returns false initially`() {
        assert(!streamManager.isStreaming())
    }

    @Test
    fun `test startHrStreaming emits HR data`() {
        val deviceId = "TEST-H10"
        val hrSample = PolarHrData.PolarHrSample(72, 72, 0, listOf(820), true, true, true)
        val testHrData = PolarHrData(listOf(hrSample))
        whenever(mockApi.startHrStreaming(deviceId))
            .thenReturn(Flowable.just(testHrData).delay(1, TimeUnit.SECONDS, testScheduler))

        var receivedDeviceId: String? = null
        streamManager.onHrDataReceived = { id, data ->
            receivedDeviceId = id
            assert(data.samples.isNotEmpty())
        }

        val observer = streamManager.startHrStreaming(deviceId).test()
        testScheduler.advanceTimeBy(2, TimeUnit.SECONDS)

        observer.assertComplete()
        assert(receivedDeviceId == deviceId)
        verify(mockApi).startHrStreaming(deviceId)
    }

    @Test
    fun `test cleanup disposes resources`() {
        val deviceId = "TEST-123"
        val testPpiData = mock<PolarPpiData>()
        whenever(testPpiData.samples).thenReturn(emptyList())
        whenever(mockApi.startPpiStreaming(deviceId))
            .thenReturn(Flowable.just(testPpiData))

        streamManager.startPpiStreaming(deviceId).test()
        testScheduler.triggerActions()
        streamManager.cleanup()

        assert(!streamManager.isStreaming())
    }

    @Test
    fun `reference HR stream uses its own slot and callback`() {
        val reference = "H10-REF"
        val primary = "360-1"
        val hrSample = PolarHrData.PolarHrSample(66, 66, 0, listOf(910), true, true, true)
        whenever(mockApi.startHrStreaming(reference))
            .thenReturn(
                // A live HR stream never completes.
                Flowable.just(PolarHrData(listOf(hrSample)))
                    .delay(1, TimeUnit.SECONDS, testScheduler)
                    .concatWith(Flowable.never())
            )

        var referenceId: String? = null
        var primaryCalls = 0
        streamManager.onReferenceHrDataReceived = { id, _ -> referenceId = id }
        streamManager.onHrDataReceived = { _, _ -> primaryCalls += 1 }

        val observer = streamManager.startReferenceHrStreaming(reference).test()
        testScheduler.advanceTimeBy(2, TimeUnit.SECONDS)

        observer.assertComplete()
        assert(referenceId == reference)
        assert(primaryCalls == 0)
        assert(streamManager.isReferenceHrStreaming())
        // Reference streaming is invisible to the primary-stream checks.
        assert(!streamManager.isHrStreaming())
        assert(!streamManager.isStreaming())
        verify(mockApi, never()).startHrStreaming(primary)
    }

    @Test
    fun `starting reference HR does not dispose the primary HR stream`() {
        val sample = PolarHrData.PolarHrSample(70, 70, 0, emptyList(), false, true, true)
        // Live HR streams never complete.
        whenever(mockApi.startHrStreaming("PRIMARY"))
            .thenReturn(Flowable.just(PolarHrData(listOf(sample))).concatWith(Flowable.never()))
        whenever(mockApi.startHrStreaming("H10-REF"))
            .thenReturn(Flowable.just(PolarHrData(listOf(sample))).concatWith(Flowable.never()))

        streamManager.startHrStreaming("PRIMARY").test()
        testScheduler.triggerActions()
        streamManager.startReferenceHrStreaming("H10-REF").test()
        testScheduler.triggerActions()

        assert(streamManager.isHrStreaming())
        assert(streamManager.isReferenceHrStreaming())

        streamManager.stopReferenceHrStreaming()
        assert(streamManager.isHrStreaming())
        assert(!streamManager.isReferenceHrStreaming())
    }

    @Test
    fun `reference HR stream errors use the reference error callback`() {
        whenever(mockApi.startHrStreaming("H10-REF"))
            .thenReturn(Flowable.error(RuntimeException("boom")))

        var referenceError: Throwable? = null
        var primaryError: Throwable? = null
        streamManager.onReferenceHrStreamError = { referenceError = it }
        streamManager.onHrStreamError = { primaryError = it }

        streamManager.startReferenceHrStreaming("H10-REF").test()
        testScheduler.triggerActions()

        assert(referenceError != null)
        assert(primaryError == null)
    }
}
