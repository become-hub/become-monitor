package com.gabriele.muscogiuri.becomemonitor.muse

import java.util.UUID

/**
 * Muse BLE protocol constants + packet decode (community protocol / muse-js).
 * Service 0xfe8d — no official Interaxon SDK.
 */
object MuseProtocol {
    val SERVICE_UUID: UUID = uuidFromShort(0xfe8d)

    val CONTROL_UUID: UUID = UUID.fromString("273e0001-4c4d-454d-96be-f03bac821358")
    val TELEMETRY_UUID: UUID = UUID.fromString("273e000b-4c4d-454d-96be-f03bac821358")

    val EEG_UUIDS: List<UUID> = listOf(
        UUID.fromString("273e0003-4c4d-454d-96be-f03bac821358"), // TP9
        UUID.fromString("273e0004-4c4d-454d-96be-f03bac821358"), // AF7
        UUID.fromString("273e0005-4c4d-454d-96be-f03bac821358"), // AF8
        UUID.fromString("273e0006-4c4d-454d-96be-f03bac821358"), // TP10
    )

    val PPG_UUIDS: List<UUID> = listOf(
        UUID.fromString("273e000f-4c4d-454d-96be-f03bac821358"), // ambient
        UUID.fromString("273e0010-4c4d-454d-96be-f03bac821358"), // infrared
        UUID.fromString("273e0011-4c4d-454d-96be-f03bac821358"), // red
    )

    val CHANNEL_NAMES = listOf("TP9", "AF7", "AF8", "TP10")
    val PPG_CHANNEL_NAMES = listOf("ambient", "infrared", "red")

    const val EEG_FREQUENCY_HZ = 256
    const val PPG_FREQUENCY_HZ = 64

    private val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

    fun clientConfigUuid(): UUID = CCCD_UUID

    fun encodeCommand(cmd: String): ByteArray {
        val payload = ("X$cmd\n").toByteArray(Charsets.US_ASCII)
        payload[0] = (payload.size - 1).toByte()
        return payload
    }

    fun decodeUnsigned12BitData(samples: ByteArray): IntArray {
        val out = ArrayList<Int>()
        var i = 0
        while (i < samples.size) {
            if (i % 3 == 0) {
                if (i + 1 >= samples.size) break
                val a = samples[i].toInt() and 0xff
                val b = samples[i + 1].toInt() and 0xff
                out.add((a shl 4) or (b shr 4))
            } else {
                if (i + 1 >= samples.size) break
                val a = samples[i].toInt() and 0xff
                val b = samples[i + 1].toInt() and 0xff
                out.add(((a and 0x0f) shl 8) or b)
                i++
            }
            i++
        }
        return out.toIntArray()
    }

    fun decodeEEGSamples(payload: ByteArray): DoubleArray {
        // muse-js: skip 2-byte index, then 12-bit samples
        if (payload.size < 4) return DoubleArray(0)
        val raw = payload.copyOfRange(2, payload.size)
        return decodeUnsigned12BitData(raw)
            .map { 0.48828125 * (it - 0x800) }
            .toDoubleArray()
    }

    fun decodeUnsigned24BitData(samples: ByteArray): IntArray {
        val out = ArrayList<Int>()
        var i = 0
        while (i + 2 < samples.size) {
            val v = ((samples[i].toInt() and 0xff) shl 16) or
                ((samples[i + 1].toInt() and 0xff) shl 8) or
                (samples[i + 2].toInt() and 0xff)
            out.add(v)
            i += 3
        }
        return out.toIntArray()
    }

    fun decodePPGSamples(payload: ByteArray): IntArray {
        if (payload.size < 5) return IntArray(0)
        val raw = payload.copyOfRange(2, payload.size)
        return decodeUnsigned24BitData(raw)
    }

    fun decodeTelemetryBatteryPercent(payload: ByteArray): Double {
        if (payload.size < 4) return 0.0
        val level = ((payload[2].toInt() and 0xff) shl 8) or (payload[3].toInt() and 0xff)
        return level / 512.0
    }

    private fun uuidFromShort(short: Int): UUID {
        val s = String.format("%08x-0000-1000-8000-00805f9b34fb", short)
        return UUID.fromString(s)
    }
}
