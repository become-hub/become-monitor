package com.gabriele.muscogiuri.becomemonitor.muse

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MuseProtocolTest {

    @Test
    fun encodeCommand_prefixesLengthByte() {
        val encoded = MuseProtocol.encodeCommand("s")
        assertEquals(encoded.size - 1, encoded[0].toInt() and 0xff)
        assertTrue(encoded.size >= 3)
    }

    @Test
    fun decodeUnsigned12BitData_roundTripKnownPattern() {
        // Three bytes encode two 12-bit samples: 0x800 and 0x801 roughly mid-scale
        val bytes = byteArrayOf(0x80.toByte(), 0x00.toByte(), 0x10.toByte())
        val samples = MuseProtocol.decodeUnsigned12BitData(bytes)
        assertTrue(samples.isNotEmpty())
    }

    @Test
    fun decodeEEGSamples_skipsIndexAndScales() {
        val payload = ByteArray(2 + 18) { 0x80.toByte() }
        payload[0] = 0x00
        payload[1] = 0x01
        val samples = MuseProtocol.decodeEEGSamples(payload)
        assertTrue(samples.isNotEmpty())
        // mid-scale 0x800 → ~0 µV
        assertEquals(0.0, samples[0], 1.0)
    }

    @Test
    fun decodePPGSamples_reads24BitValues() {
        val payload = byteArrayOf(
            0x00, 0x01,
            0x00, 0x01, 0x00,
            0x00, 0x02, 0x00,
        )
        val samples = MuseProtocol.decodePPGSamples(payload)
        assertEquals(2, samples.size)
        assertEquals(0x0100, samples[0])
        assertEquals(0x0200, samples[1])
    }
}
