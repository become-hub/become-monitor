package com.gabriele.muscogiuri.becomemonitor.polar

import com.polar.sdk.api.PolarBleApi
import com.polar.sdk.api.PolarBleApiCallback
import com.polar.sdk.api.model.PolarHrData
import com.polar.sdk.api.model.PolarDeviceInfo
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
        RxAndroidPlugins.setInitMainThreadSchedulerHandler { Schedulers.trampoline() }
        RxAndroidPlugins.setMainThreadSchedulerHandler { Schedulers.trampoline() }

        deviceManager = PolarDeviceManager(mockApi)
    }

    @After
    fun tearDown() {
        RxJavaPlugins.reset()
        RxAndroidPlugins.reset()
        deviceManager.cleanup()
    }

    @Test
    fun `test startScan success`() {
        // Arrange
        val mockDeviceInfo = mock<PolarDeviceInfo>()
        whenever(mockDeviceInfo.deviceId).thenReturn("TEST-123")
        whenever(mockDeviceInfo.name).thenReturn("Polar H10")

        whenever(mockApi.searchForDevice())
            .thenReturn(Flowable.just(mockDeviceInfo).delay(1, TimeUnit.SECONDS, testScheduler))

        var foundDevice: PolarDeviceInfo? = null
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
            .thenReturn(Flowable.error(testError))

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
        val mockDeviceInfo = mock<PolarDeviceInfo>()
        whenever(mockApi.searchForDevice())
            .thenReturn(Flowable.just(mockDeviceInfo))

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
        val testDeviceInfo = mock<PolarDeviceInfo>()
        whenever(mockApi.searchForDevice())
            .thenReturn(Flowable.just(testDeviceInfo))

        deviceManager.startScan()

        // Act
        deviceManager.cleanup()

        // Assert
        assert(!deviceManager.isDeviceConnected())
    }

    // --- Reference device (H10 next to a 360/Loop) ---

    private fun apiCallback(): PolarBleApiCallback {
        val captor = argumentCaptor<PolarBleApiCallback>()
        verify(mockApi).setApiCallback(captor.capture())
        return captor.firstValue
    }

    private fun deviceInfo(id: String, @Suppress("UNUSED_PARAMETER") name: String): PolarDeviceInfo {
        val info = mock<PolarDeviceInfo>()
        whenever(info.deviceId).thenReturn(id)
        return info
    }

    @Test
    fun `reference connect is routed to reference callback and leaves primary state untouched`() {
        val callback = apiCallback()
        var primaryConnected = 0
        var referenceConnected = 0
        deviceManager.onDeviceConnected = { primaryConnected += 1 }
        deviceManager.onReferenceDeviceConnected = { referenceConnected += 1 }

        deviceManager.connectReferenceDevice("H10-1")
        callback.deviceConnected(deviceInfo("H10-1", "Polar H10 1"))

        assert(referenceConnected == 1)
        assert(primaryConnected == 0)
        assert(deviceManager.getConnectedDeviceId() == null)
    }

    @Test
    fun `reference disconnect does not drop the primary device`() {
        val callback = apiCallback()
        var primaryDisconnected = 0
        var referenceDisconnected = 0
        deviceManager.onDeviceDisconnected = { primaryDisconnected += 1 }
        deviceManager.onReferenceDeviceDisconnected = { referenceDisconnected += 1 }

        callback.deviceConnected(deviceInfo("360-1", "Polar 360 1"))
        deviceManager.connectReferenceDevice("H10-1")
        callback.deviceConnected(deviceInfo("H10-1", "Polar H10 1"))
        callback.deviceDisconnected(deviceInfo("H10-1", "Polar H10 1"))

        assert(referenceDisconnected == 1)
        assert(primaryDisconnected == 0)
        assert(deviceManager.getConnectedDeviceId() == "360-1")
    }

    @Test
    fun `late disconnect after disconnectReferenceDevice is still routed to reference`() {
        val callback = apiCallback()
        var primaryDisconnected = 0
        var referenceDisconnected = 0
        deviceManager.onDeviceDisconnected = { primaryDisconnected += 1 }
        deviceManager.onReferenceDeviceDisconnected = { referenceDisconnected += 1 }

        callback.deviceConnected(deviceInfo("360-1", "Polar 360 1"))
        deviceManager.connectReferenceDevice("H10-1")
        deviceManager.disconnectReferenceDevice()
        // The SDK reports the disconnect asynchronously, after our call returned.
        callback.deviceDisconnected(deviceInfo("H10-1", "Polar H10 1"))

        assert(referenceDisconnected == 1)
        assert(primaryDisconnected == 0)
        assert(deviceManager.getConnectedDeviceId() == "360-1")
    }

    @Test
    fun `HR notification from the reference device never reaches the primary callback`() {
        val callback = apiCallback()
        val received = mutableListOf<String>()
        deviceManager.onHeartRateReceived = { id, _ -> received += id }
        val sample = PolarHrData.PolarHrSample(72, 72, 0, listOf(820), true, true, true)

        deviceManager.connectReferenceDevice("H10-1")
        callback.hrNotificationReceived("H10-1", sample)
        callback.hrNotificationReceived("360-1", sample)

        assert(received == listOf("360-1"))
    }

    @Test
    fun `reference connect rejects the primary device id`() {
        val callback = apiCallback()
        callback.deviceConnected(deviceInfo("360-1", "Polar 360 1"))

        val result = deviceManager.connectReferenceDevice("360-1")

        assert(result.isFailure)
        verify(mockApi, never()).connectToDevice("360-1")
    }

    @Test
    fun `connecting a former reference device as primary routes it back to primary`() {
        val callback = apiCallback()
        var primaryConnected = 0
        deviceManager.onDeviceConnected = { primaryConnected += 1 }

        deviceManager.connectReferenceDevice("H10-1")
        deviceManager.connectToDevice("H10-1")
        callback.deviceConnected(deviceInfo("H10-1", "Polar H10 1"))

        assert(primaryConnected == 1)
        assert(deviceManager.getConnectedDeviceId() == "H10-1")
    }
}
