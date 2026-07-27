package com.gabriele.muscogiuri.becomemonitor.polar

import com.polar.sdk.api.PolarBleApi
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

        observer.assertComplete()
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
}
