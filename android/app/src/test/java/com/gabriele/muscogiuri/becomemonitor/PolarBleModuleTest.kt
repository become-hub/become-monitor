package com.gabriele.muscogiuri.becomemonitor

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.gabriele.muscogiuri.becomemonitor.bluetooth.BluetoothManager
import com.gabriele.muscogiuri.becomemonitor.polar.PolarDeviceManager
import com.gabriele.muscogiuri.becomemonitor.polar.PolarFtuManager
import com.gabriele.muscogiuri.becomemonitor.polar.PolarStreamManager
import io.reactivex.rxjava3.android.plugins.RxAndroidPlugins
import io.reactivex.rxjava3.core.Completable
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
    private lateinit var mockFtuManager: PolarFtuManager

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
        RxAndroidPlugins.setInitMainThreadSchedulerHandler { Schedulers.trampoline() }
        RxAndroidPlugins.setMainThreadSchedulerHandler { Schedulers.trampoline() }

        polarBleModule = PolarBleModule(
            mockReactContext,
            mockBluetoothManager,
            mockDeviceManager,
            mockStreamManager,
            mockFtuManager
        )
    }

    @After
    fun tearDown() {
        RxJavaPlugins.reset()
        RxAndroidPlugins.reset()
    }

    @Test
    fun `test module name is correct`() {
        assert(polarBleModule.name == "PolarBleModule")
    }

    @Test
    fun `test checkBluetoothState calls BluetoothManager`() {
        whenever(mockBluetoothManager.isBluetoothEnabled()).thenReturn(true)

        polarBleModule.checkBluetoothState(mockPromise)

        verify(mockPromise).resolve(true)
    }

    @Test
    fun `test checkBluetoothState handles errors`() {
        whenever(mockBluetoothManager.isBluetoothEnabled())
            .thenThrow(RuntimeException("Bluetooth check failed"))

        polarBleModule.checkBluetoothState(mockPromise)

        verify(mockPromise).reject(eq("BLUETOOTH_CHECK_ERROR"), any<String>())
    }

    @Test
    fun `test startScan calls DeviceManager`() {
        whenever(mockDeviceManager.startScan()).thenReturn(Result.success(Unit))

        polarBleModule.startScan(mockPromise)

        verify(mockPromise).resolve(null)
    }

    @Test
    fun `test stopScan calls DeviceManager`() {
        whenever(mockDeviceManager.stopScan()).thenReturn(Result.success(Unit))

        polarBleModule.stopScan(mockPromise)

        verify(mockPromise).resolve(null)
    }

    @Test
    fun `test connectToDevice calls DeviceManager`() {
        val deviceId = "TEST-123"
        whenever(mockDeviceManager.connectToDevice(deviceId)).thenReturn(Result.success(Unit))

        polarBleModule.connectToDevice(deviceId, mockPromise)

        verify(mockPromise).resolve(null)
    }

    @Test
    fun `test disconnectFromDevice calls DeviceManager`() {
        val deviceId = "TEST-123"
        whenever(mockDeviceManager.disconnectFromDevice(deviceId)).thenReturn(Result.success(Unit))

        polarBleModule.disconnectFromDevice(deviceId, mockPromise)

        verify(mockPromise).resolve(null)
    }

    @Test
    fun `test startPpiStreaming calls StreamManager`() {
        val deviceId = "TEST-123"
        whenever(mockStreamManager.startPpiStreaming(deviceId)).thenReturn(Completable.complete())

        polarBleModule.startPpiStreaming(deviceId, mockPromise)
        testScheduler.triggerActions()

        verify(mockPromise).resolve(null)
    }

    @Test
    fun `test stopPpiStreaming calls StreamManager`() {
        whenever(mockStreamManager.stopPpiStreaming()).thenReturn(Result.success(Unit))

        polarBleModule.stopPpiStreaming(mockPromise)

        verify(mockPromise).resolve(null)
    }

    @Test
    fun `test onCatalystInstanceDestroy cleans up resources`() {
        doNothing().whenever(mockDeviceManager).cleanup()
        doNothing().whenever(mockStreamManager).cleanup()
        doNothing().whenever(mockFtuManager).cleanup()

        polarBleModule.onCatalystInstanceDestroy()

        verify(mockDeviceManager).cleanup()
        verify(mockStreamManager).cleanup()
        verify(mockFtuManager).cleanup()
    }
}
