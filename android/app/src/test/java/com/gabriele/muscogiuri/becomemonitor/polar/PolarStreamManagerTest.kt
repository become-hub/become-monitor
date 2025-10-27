package com.gabriele.muscogiuri.becomemonitor.polar

import com.polar.sdk.api.PolarBleApi
import io.reactivex.rxjava3.core.Observable
import io.reactivex.rxjava3.plugins.RxJavaPlugins
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

/**
 * Test unitari per PolarStreamManager
 */
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

        streamManager = PolarStreamManager(mockApi)
    }

    @After
    fun tearDown() {
        RxJavaPlugins.reset()
        streamManager.cleanup()
    }

    @Test
    fun `test startPpiStreaming emits PPI data`() {
        // Arrange
        val deviceId = "TEST-123"
        val testSettings = mock<com.polar.sdk.api.model.PolarSensorSetting>()
        val testPpiData = mock<com.polar.sdk.api.model.PolarPpiData>()
        val mockSamples = listOf(
            mock<com.polar.sdk.api.model.PolarPpiSample>(),
            mock<com.polar.sdk.api.model.PolarPpiSample>()
        )

        whenever(testPpiData.samples).thenReturn(mockSamples)

        whenever(mockApi.requestStreamSettings(deviceId, PolarBleApi.PolarDeviceDataType.PPI))
            .thenReturn(Observable.just(testSettings))
        whenever(mockApi.startPpiStreaming(deviceId))
            .thenReturn(Observable.just(testPpiData).delay(1, TimeUnit.SECONDS, testScheduler))

        var receivedData: com.polar.sdk.api.model.PolarPpiData? = null
        streamManager.onPpiDataReceived = { _, data ->
            receivedData = data
        }

        // Act
        val result = streamManager.startPpiStreaming(deviceId)
        testScheduler.advanceTimeBy(2, TimeUnit.SECONDS)

        // Assert
        assert(result.isSuccess)
        assert(receivedData != null)
    }

    @Test
    fun `test startPpiStreaming handles PPI not available`() {
        // Arrange
        val deviceId = "TEST-123"
        val testError = RuntimeException("PPI not available")

        whenever(mockApi.requestStreamSettings(deviceId, PolarBleApi.PolarDeviceDataType.PPI))
            .thenReturn(Observable.error(testError))

        var errorReceived: Throwable? = null
        streamManager.onPpiNotAvailable = { error ->
            errorReceived = error
        }

        // Act
        val result = streamManager.startPpiStreaming(deviceId)
        testScheduler.triggerActions()

        // Assert
        assert(result.isSuccess) // Manager returns success but error is reported via callback
        assert(errorReceived != null)
    }

    @Test
    fun `test startPpiStreaming handles stream errors`() {
        // Arrange
        val deviceId = "TEST-123"
        val testSettings = mock<com.polar.sdk.api.model.PolarSensorSetting>()
        val testError = RuntimeException("Stream error")

        whenever(mockApi.requestStreamSettings(deviceId, PolarBleApi.PolarDeviceDataType.PPI))
            .thenReturn(Observable.just(testSettings))
        whenever(mockApi.startPpiStreaming(deviceId))
            .thenReturn(Observable.error(testError))

        var errorReceived: Throwable? = null
        streamManager.onPpiStreamError = { error ->
            errorReceived = error
        }

        // Act
        val result = streamManager.startPpiStreaming(deviceId)
        testScheduler.triggerActions()

        // Assert
        assert(result.isSuccess)
        assert(errorReceived != null)
    }

    @Test
    fun `test stopPpiStreaming disposes subscription`() {
        // Arrange
        val deviceId = "TEST-123"
        val testSettings = mock<com.polar.sdk.api.model.PolarSensorSetting>()
        val testPpiData = mock<com.polar.sdk.api.model.PolarPpiData>()
        whenever(testPpiData.samples).thenReturn(emptyList())

        whenever(mockApi.requestStreamSettings(deviceId, PolarBleApi.PolarDeviceDataType.PPI))
            .thenReturn(Observable.just(testSettings))
        whenever(mockApi.startPpiStreaming(deviceId))
            .thenReturn(Observable.just(testPpiData))

        streamManager.startPpiStreaming(deviceId)

        // Act
        val result = streamManager.stopPpiStreaming()

        // Assert
        assert(result.isSuccess)
    }

    @Test
    fun `test isStreaming returns false initially`() {
        // Act
        val result = streamManager.isStreaming()

        // Assert
        assert(!result)
    }

    @Test
    fun `test cleanup disposes resources`() {
        // Arrange
        val deviceId = "TEST-123"
        val testSettings = mock<com.polar.sdk.api.model.PolarSensorSetting>()
        val testPpiData = mock<com.polar.sdk.api.model.PolarPpiData>()
        whenever(testPpiData.samples).thenReturn(emptyList())

        whenever(mockApi.requestStreamSettings(deviceId, PolarBleApi.PolarDeviceDataType.PPI))
            .thenReturn(Observable.just(testSettings))
        whenever(mockApi.startPpiStreaming(deviceId))
            .thenReturn(Observable.just(testPpiData))

        streamManager.startPpiStreaming(deviceId)

        // Act
        streamManager.cleanup()

        // Assert
        assert(!streamManager.isStreaming())
    }
}

