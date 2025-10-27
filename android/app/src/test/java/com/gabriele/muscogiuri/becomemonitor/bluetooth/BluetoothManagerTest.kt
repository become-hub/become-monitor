package com.gabriele.muscogiuri.becomemonitor.bluetooth

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mock
import org.mockito.MockitoAnnotations
import org.mockito.junit.MockitoJUnitRunner
import org.mockito.kotlin.*

/**
 * Test unitari per BluetoothManager
 */
@RunWith(MockitoJUnitRunner::class)
class BluetoothManagerTest {

    @Mock
    private lateinit var mockContext: Context

    @Mock
    private lateinit var mockBluetoothManager: BluetoothManager

    @Mock
    private lateinit var mockBluetoothAdapter: BluetoothAdapter

    private lateinit var bluetoothManager: BluetoothManager

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        bluetoothManager = BluetoothManager(mockContext)
    }

    @Test
    fun `test isBluetoothEnabled returns true when Bluetooth is enabled`() {
        // Arrange
        whenever(mockContext.getSystemService(Context.BLUETOOTH_SERVICE))
            .thenReturn(mockBluetoothManager)
        whenever(mockBluetoothManager.adapter).thenReturn(mockBluetoothAdapter)
        whenever(mockBluetoothAdapter.isEnabled).thenReturn(true)

        // Act
        val result = bluetoothManager.isBluetoothEnabled()

        // Assert
        assert(result)
    }

    @Test
    fun `test isBluetoothEnabled returns false when Bluetooth is disabled`() {
        // Arrange
        whenever(mockContext.getSystemService(Context.BLUETOOTH_SERVICE))
            .thenReturn(mockBluetoothManager)
        whenever(mockBluetoothManager.adapter).thenReturn(mockBluetoothAdapter)
        whenever(mockBluetoothAdapter.isEnabled).thenReturn(false)

        // Act
        val result = bluetoothManager.isBluetoothEnabled()

        // Assert
        assert(!result)
    }

    @Test
    fun `test isBluetoothEnabled returns false when adapter is null`() {
        // Arrange
        whenever(mockContext.getSystemService(Context.BLUETOOTH_SERVICE))
            .thenReturn(mockBluetoothManager)
        whenever(mockBluetoothManager.adapter).thenReturn(null)

        // Act
        val result = bluetoothManager.isBluetoothEnabled()

        // Assert
        assert(!result)
    }

    @Test
    fun `test isBluetoothEnabled handles exceptions gracefully`() {
        // Arrange
        whenever(mockContext.getSystemService(Context.BLUETOOTH_SERVICE))
            .thenThrow(RuntimeException("Service unavailable"))

        // Act
        val result = bluetoothManager.isBluetoothEnabled()

        // Assert
        assert(!result)
    }

    @Test
    fun `test isBluetoothSupported returns true when adapter exists`() {
        // Arrange
        whenever(mockContext.getSystemService(Context.BLUETOOTH_SERVICE))
            .thenReturn(mockBluetoothManager)
        whenever(mockBluetoothManager.adapter).thenReturn(mockBluetoothAdapter)

        // Act
        val result = bluetoothManager.isBluetoothSupported()

        // Assert
        assert(result)
    }

    @Test
    fun `test isBluetoothSupported returns false when adapter is null`() {
        // Arrange
        whenever(mockContext.getSystemService(Context.BLUETOOTH_SERVICE))
            .thenReturn(mockBluetoothManager)
        whenever(mockBluetoothManager.adapter).thenReturn(null)

        // Act
        val result = bluetoothManager.isBluetoothSupported()

        // Assert
        assert(!result)
    }

    @Test
    fun `test getBluetoothAddress returns address when available`() {
        // Arrange
        val expectedAddress = "00:11:22:33:44:55"
        whenever(mockContext.getSystemService(Context.BLUETOOTH_SERVICE))
            .thenReturn(mockBluetoothManager)
        whenever(mockBluetoothManager.adapter).thenReturn(mockBluetoothAdapter)
        whenever(mockBluetoothAdapter.address).thenReturn(expectedAddress)

        // Act
        val result = bluetoothManager.getBluetoothAddress()

        // Assert
        assert(result == expectedAddress)
    }

    @Test
    fun `test getBluetoothAddress returns null on security exception`() {
        // Arrange
        whenever(mockContext.getSystemService(Context.BLUETOOTH_SERVICE))
            .thenReturn(mockBluetoothManager)
        whenever(mockBluetoothManager.adapter).thenReturn(mockBluetoothAdapter)
        whenever(mockBluetoothAdapter.address).thenThrow(SecurityException())

        // Act
        val result = bluetoothManager.getBluetoothAddress()

        // Assert
        assert(result == null)
    }

    @Test
    fun `test getBluetoothName returns name when available`() {
        // Arrange
        val expectedName = "TestDevice"
        whenever(mockContext.getSystemService(Context.BLUETOOTH_SERVICE))
            .thenReturn(mockBluetoothManager)
        whenever(mockBluetoothManager.adapter).thenReturn(mockBluetoothAdapter)
        whenever(mockBluetoothAdapter.name).thenReturn(expectedName)

        // Act
        val result = bluetoothManager.getBluetoothName()

        // Assert
        assert(result == expectedName)
    }

    @Test
    fun `test getBluetoothName returns null on security exception`() {
        // Arrange
        whenever(mockContext.getSystemService(Context.BLUETOOTH_SERVICE))
            .thenReturn(mockBluetoothManager)
        whenever(mockBluetoothManager.adapter).thenReturn(mockBluetoothAdapter)
        whenever(mockBluetoothAdapter.name).thenThrow(SecurityException())

        // Act
        val result = bluetoothManager.getBluetoothName()

        // Assert
        assert(result == null)
    }
}

