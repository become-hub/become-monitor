package com.gabriele.muscogiuri.becomemonitor

import android.content.Context
import com.facebook.react.bridge.*
import com.gabriele.muscogiuri.becomemonitor.bluetooth.BluetoothManager
import com.gabriele.muscogiuri.becomemonitor.polar.PolarDeviceManager
import com.gabriele.muscogiuri.becomemonitor.polar.PolarStreamManager
import com.polar.sdk.api.PolarBleApi
import com.polar.sdk.api.PolarBleApiDefaultImpl
import com.polar.sdk.api.model.PolarDeviceInfo
import io.reactivex.rxjava3.core.Observable
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
 * Test di integrazione per PolarBleModule
 * Verifica che tutti i manager funzionino insieme correttamente
 */
@RunWith(MockitoJUnitRunner::class)
class PolarBleModuleTest {

    @Mock
    private lateinit var mockReactContext: ReactApplicationContext

    @Mock
    private lateinit var mockContext: Context

    @Mock
    private lateinit var mockBluetoothManager: BluetoothManager

    @Mock
    private lateinit var mockDeviceManager: PolarDeviceManager

    @Mock
    private lateinit var mockStreamManager: PolarStreamManager

    @Mock
    private lateinit var mockPromise: Promise

    private lateinit var polarBleModule: PolarBleModule
    private lateinit var testScheduler: TestScheduler

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        testScheduler = TestScheduler()
        RxJavaPlugins.setComputationSchedulerHandler { testScheduler }
        RxJavaPlugins.setIoSchedulerHandler { testScheduler }
        RxJavaPlugins.setNewThreadSchedulerHandler { testScheduler }

        whenever(mockReactContext.applicationContext).thenReturn(mockContext)

        // Mock reflection per creare PolarBleModule
        polarBleModule = PolarBleModule(mockReactContext)
    }

    @After
    fun tearDown() {
        RxJavaPlugins.reset()
    }

    @Test
    fun `test module name is correct`() {
        // Act
        val moduleName = polarBleModule.name

        // Assert
        assert(moduleName == "PolarBleModule")
    }

    @Test
    fun `test checkBluetoothState calls BluetoothManager`() {
        // Arrange
        whenever(mockBluetoothManager.isBluetoothEnabled()).thenReturn(true)

        // Act
        polarBleModule.checkBluetoothState(mockPromise)

        // Assert
        verify(mockPromise).resolve(true)
    }

    @Test
    fun `test checkBluetoothState handles errors`() {
        // Arrange
        val testError = RuntimeException("Bluetooth check failed")
        whenever(mockBluetoothManager.isBluetoothEnabled()).thenThrow(testError)

        // Act
        polarBleModule.checkBluetoothState(mockPromise)

        // Assert
        verify(mockPromise).reject(eq("BLUETOOTH_CHECK_ERROR"), any())
    }

    @Test
    fun `test startScan calls DeviceManager`() {
        // Arrange
        whenever(mockDeviceManager.startScan()).thenReturn(Result.success(Unit))

        // Act
        polarBleModule.startScan(mockPromise)

        // Assert
        verify(mockPromise).resolve(null)
    }

    @Test
    fun `test stopScan calls DeviceManager`() {
        // Arrange
        whenever(mockDeviceManager.stopScan()).thenReturn(Result.success(Unit))

        // Act
        polarBleModule.stopScan(mockPromise)

        // Assert
        verify(mockPromise).resolve(null)
    }

    @Test
    fun `test connectToDevice calls DeviceManager`() {
        // Arrange
        val deviceId = "TEST-123"
        whenever(mockDeviceManager.connectToDevice(deviceId)).thenReturn(Result.success(Unit))

        // Act
        polarBleModule.connectToDevice(deviceId, mockPromise)

        // Assert
        verify(mockPromise).resolve(null)
    }

    @Test
    fun `test disconnectFromDevice calls DeviceManager`() {
        // Arrange
        val deviceId = "TEST-123"
        whenever(mockDeviceManager.disconnectFromDevice(deviceId)).thenReturn(Result.success(Unit))

        // Act
        polarBleModule.disconnectFromDevice(deviceId, mockPromise)

        // Assert
        verify(mockPromise).resolve(null)
    }

    @Test
    fun `test startPpiStreaming calls StreamManager`() {
        // Arrange
        val deviceId = "TEST-123"
        whenever(mockStreamManager.startPpiStreaming(deviceId)).thenReturn(Result.success(Unit))

        // Act
        polarBleModule.startPpiStreaming(deviceId, mockPromise)

        // Assert
        verify(mockPromise).resolve(null)
    }

    @Test
    fun `test stopPpiStreaming calls StreamManager`() {
        // Arrange
        whenever(mockStreamManager.stopPpiStreaming()).thenReturn(Result.success(Unit))

        // Act
        polarBleModule.stopPpiStreaming(mockPromise)

        // Assert
        verify(mockPromise).resolve(null)
    }

    @Test
    fun `test onCatalystInstanceDestroy cleans up resources`() {
        // Arrange
        doNothing().whenever(mockDeviceManager).cleanup()
        doNothing().whenever(mockStreamManager).cleanup()

        // Act
        polarBleModule.onCatalystInstanceDestroy()

        // Assert
        verify(mockDeviceManager).cleanup()
        verify(mockStreamManager).cleanup()
    }
}

