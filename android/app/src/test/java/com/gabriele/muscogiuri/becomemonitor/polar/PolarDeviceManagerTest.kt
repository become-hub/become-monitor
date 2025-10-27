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
 * Test unitari per PolarDeviceManager
 */
@RunWith(MockitoJUnitRunner::class)
class PolarDeviceManagerTest {

    @Mock
    private lateinit var mockApi: PolarBleApi

    private lateinit var deviceManager: PolarDeviceManager
    private lateinit var testScheduler: TestScheduler

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        testScheduler = TestScheduler()
        RxJavaPlugins.setComputationSchedulerHandler { testScheduler }
        RxJavaPlugins.setIoSchedulerHandler { testScheduler }
        RxJavaPlugins.setNewThreadSchedulerHandler { testScheduler }

        deviceManager = PolarDeviceManager(mockApi)
    }

    @After
    fun tearDown() {
        RxJavaPlugins.reset()
        deviceManager.cleanup()
    }

    @Test
    fun `test startScan success`() {
        // Arrange
        val mockDeviceInfo = mock<com.polar.sdk.api.model.PolarDeviceInfo>()
        whenever(mockDeviceInfo.deviceId).thenReturn("TEST-123")
        whenever(mockDeviceInfo.name).thenReturn("Polar H10")
        whenever(mockDeviceInfo.rssi).thenReturn(-60)

        whenever(mockApi.searchForDevice())
            .thenReturn(Observable.just(mockDeviceInfo).delay(1, TimeUnit.SECONDS, testScheduler))

        var foundDevice: com.polar.sdk.api.model.PolarDeviceInfo? = null
        deviceManager.onDeviceFound = { device ->
            foundDevice = device
        }

        // Act
        val result = deviceManager.startScan()
        testScheduler.advanceTimeBy(2, TimeUnit.SECONDS)

        // Assert
        assert(result.isSuccess)
        assert(foundDevice != null)
        assert(foundDevice?.deviceId == "TEST-123")
    }

    @Test
    fun `test startScan handles scan errors`() {
        // Arrange
        val testError = RuntimeException("Scan failed")
        whenever(mockApi.searchForDevice())
            .thenReturn(Observable.error(testError))

        var errorReceived: Throwable? = null
        deviceManager.onScanError = { error ->
            errorReceived = error
        }

        // Act
        val result = deviceManager.startScan()
        testScheduler.triggerActions()

        // Assert
        assert(result.isSuccess) // Manager doesn't fail, just logs
        assert(errorReceived != null)
    }

    @Test
    fun `test stopScan disposes subscription`() {
        // Arrange
        val mockDeviceInfo = mock<com.polar.sdk.api.model.PolarDeviceInfo>()
        whenever(mockApi.searchForDevice())
            .thenReturn(Observable.just(mockDeviceInfo))

        deviceManager.startScan()

        // Act
        val result = deviceManager.stopScan()

        // Assert
        assert(result.isSuccess)
    }

    @Test
    fun `test connectToDevice calls API`() {
        // Arrange
        val deviceId = "TEST-123"
        doNothing().whenever(mockApi).connectToDevice(deviceId)

        // Act
        val result = deviceManager.connectToDevice(deviceId)

        // Assert
        assert(result.isSuccess)
        verify(mockApi).connectToDevice(deviceId)
    }

    @Test
    fun `test connectToDevice handles errors`() {
        // Arrange
        val deviceId = "TEST-123"
        val testError = RuntimeException("Connection failed")
        doThrow(testError).whenever(mockApi).connectToDevice(deviceId)

        // Act
        val result = deviceManager.connectToDevice(deviceId)

        // Assert
        assert(result.isFailure)
    }

    @Test
    fun `test disconnectFromDevice calls API`() {
        // Arrange
        val deviceId = "TEST-123"
        doNothing().whenever(mockApi).disconnectFromDevice(deviceId)

        // Act
        val result = deviceManager.disconnectFromDevice(deviceId)

        // Assert
        assert(result.isSuccess)
        verify(mockApi).disconnectFromDevice(deviceId)
    }

    @Test
    fun `test disconnectFromDevice handles errors`() {
        // Arrange
        val deviceId = "TEST-123"
        val testError = RuntimeException("Disconnect failed")
        doThrow(testError).whenever(mockApi).disconnectFromDevice(deviceId)

        // Act
        val result = deviceManager.disconnectFromDevice(deviceId)

        // Assert
        assert(result.isFailure)
    }

    @Test
    fun `test isDeviceConnected returns false initially`() {
        // Act
        val result = deviceManager.isDeviceConnected()

        // Assert
        assert(!result)
    }

    @Test
    fun `test getConnectedDeviceId returns null initially`() {
        // Act
        val result = deviceManager.getConnectedDeviceId()

        // Assert
        assert(result == null)
    }

    @Test
    fun `test cleanup disposes resources`() {
        // Arrange
        val testDeviceInfo = PolarDeviceInfo(
            deviceId = "TEST-123",
            address = "00:11:22:33:44:55",
            rssi = -60,
            name = "Polar H10",
            deviceType = "H10"
        )

        whenever(mockApi.searchForDevice())
            .thenReturn(Observable.just(testDeviceInfo))

        deviceManager.startScan()

        // Act
        deviceManager.cleanup()

        // Assert
        assert(!deviceManager.isDeviceConnected())
    }
}

