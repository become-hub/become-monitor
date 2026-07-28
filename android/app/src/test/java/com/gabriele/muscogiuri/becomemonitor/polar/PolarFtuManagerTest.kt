package com.gabriele.muscogiuri.becomemonitor.polar

import com.polar.sdk.api.PolarBleApi
import com.polar.sdk.api.model.PolarFirstTimeUseConfig
import io.reactivex.rxjava3.core.Completable
import io.reactivex.rxjava3.core.Single
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

@RunWith(MockitoJUnitRunner::class)
class PolarFtuManagerTest {

    @Mock
    private lateinit var mockApi: PolarBleApi

    private lateinit var ftuManager: PolarFtuManager
    private lateinit var testScheduler: TestScheduler

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        testScheduler = TestScheduler()
        RxJavaPlugins.setComputationSchedulerHandler { testScheduler }
        RxJavaPlugins.setIoSchedulerHandler { testScheduler }
        RxJavaPlugins.setNewThreadSchedulerHandler { testScheduler }

        ftuManager = PolarFtuManager(mockApi)
    }

    @After
    fun tearDown() {
        RxJavaPlugins.reset()
        ftuManager.cleanup()
    }

    @Test
    fun `ensureFirstTimeUse skips doFirstTimeUse when already done`() {
        val deviceId = "E462542B"
        whenever(
            mockApi.isFeatureReady(
                deviceId,
                PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_FILE_TRANSFER
            )
        ).thenReturn(true)
        whenever(
            mockApi.isFeatureReady(
                deviceId,
                PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_DEVICE_TIME_SETUP
            )
        ).thenReturn(true)
        whenever(mockApi.isFtuDone(deviceId)).thenReturn(Single.just(true))

        val testObserver = ftuManager.ensureFirstTimeUse(deviceId).test()
        testObserver.assertComplete()
        testObserver.assertNoErrors()
        testObserver.assertValue(false)

        verify(mockApi, never()).doFirstTimeUse(any(), any())
        verify(mockApi, never()).doRestart(any())
    }

    @Test
    fun `ensureFirstTimeUse calls doFirstTimeUse when not done`() {
        val deviceId = "E462542B"
        whenever(
            mockApi.isFeatureReady(
                deviceId,
                PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_FILE_TRANSFER
            )
        ).thenReturn(true)
        whenever(
            mockApi.isFeatureReady(
                deviceId,
                PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_DEVICE_TIME_SETUP
            )
        ).thenReturn(true)
        whenever(mockApi.isFtuDone(deviceId)).thenReturn(Single.just(false))
        whenever(mockApi.doFirstTimeUse(eq(deviceId), any())).thenReturn(Completable.complete())
        whenever(mockApi.doRestart(deviceId)).thenReturn(Completable.complete())

        val testObserver = ftuManager.ensureFirstTimeUse(deviceId).test()
        testObserver.assertComplete()
        testObserver.assertNoErrors()
        testObserver.assertValue(true)

        verify(mockApi).doFirstTimeUse(eq(deviceId), any<PolarFirstTimeUseConfig>())
        verify(mockApi).doRestart(deviceId)
    }

    @Test
    fun `ensureFirstTimeUse waits for feature ready callback`() {
        val deviceId = "E462542B"
        whenever(
            mockApi.isFeatureReady(
                deviceId,
                PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_FILE_TRANSFER
            )
        ).thenReturn(false)
        whenever(
            mockApi.isFeatureReady(
                deviceId,
                PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_DEVICE_TIME_SETUP
            )
        ).thenReturn(false)
        whenever(mockApi.isFtuDone(deviceId)).thenReturn(Single.just(true))

        val testObserver = ftuManager.ensureFirstTimeUse(deviceId).test()
        testObserver.assertNotComplete()

        ftuManager.onFeatureReady(
            deviceId,
            PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_FILE_TRANSFER
        )
        ftuManager.onFeatureReady(
            deviceId,
            PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_DEVICE_TIME_SETUP
        )

        testObserver.assertComplete()
        testObserver.assertNoErrors()
        testObserver.assertValue(false)
    }

    @Test
    fun `ensureFirstTimeUse times out when feature never ready`() {
        val deviceId = "E462542B"
        whenever(
            mockApi.isFeatureReady(
                deviceId,
                PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_FILE_TRANSFER
            )
        ).thenReturn(false)
        whenever(
            mockApi.isFeatureReady(
                deviceId,
                PolarBleApi.PolarBleSdkFeature.FEATURE_POLAR_DEVICE_TIME_SETUP
            )
        ).thenReturn(false)

        val testObserver = ftuManager.ensureFirstTimeUse(deviceId).test()
        testScheduler.advanceTimeBy(46, TimeUnit.SECONDS)

        testObserver.assertError { true }
    }

    @Test
    fun `defaultFtuConfig has valid ranges`() {
        val config = PolarFtuManager.defaultFtuConfig()
        assert(config.height in 90f..240f)
        assert(config.weight in 15f..300f)
        assert(config.maxHeartRate in 100..240)
        assert(config.restingHeartRate in 20..120)
        assert(config.vo2Max in 10..95)
        assert(config.sleepGoalMinutes in 300..660)
    }

    @Test
    fun `defaultFtuConfig deviceTime matches Polar SDK SimpleDateFormat`() {
        val config = PolarFtuManager.defaultFtuConfig()
        assert(config.deviceTime.matches(Regex("""\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"""))) {
            "deviceTime must be yyyy-MM-dd'T'HH:mm:ss'Z', got: ${config.deviceTime}"
        }
    }
}
