package com.mfx.offline

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import java.io.File

/**
 * Baixa o modelo de IA direto pelo app (precisa de internet só nessa hora).
 * Usa o gerenciador de downloads do Android: continua mesmo com o app fechado.
 */
object ModelDownloader {

    const val FILE_NAME = "Qwen2.5-1.5B-Instruct-Q4_K_M.gguf"
    private const val URL =
        "https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/$FILE_NAME"

    data class Status(val state: Int, val percent: Int, val reason: Int)

    private fun dm(context: Context) = context.getSystemService(DownloadManager::class.java)

    fun target(context: Context): File =
        File(context.getExternalFilesDir("modelos"), FILE_NAME)

    fun start(context: Context): Long {
        target(context).delete()
        val request = DownloadManager.Request(Uri.parse(URL))
            .setTitle("MFX Offline: modelo de IA")
            .setDescription("Qwen2.5 1.5B (cerca de 1 GB)")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalFilesDir(context, "modelos", FILE_NAME)
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)
        return dm(context).enqueue(request)
    }

    fun status(context: Context, id: Long): Status? {
        dm(context).query(DownloadManager.Query().setFilterById(id))?.use { c ->
            if (!c.moveToFirst()) return null
            val state = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            val done = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
            val total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
            val reason = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
            val pct = if (total > 0) (done * 100 / total).toInt() else -1
            return Status(state, pct, reason)
        }
        return null
    }

    fun cancel(context: Context, id: Long) {
        runCatching { dm(context).remove(id) }
    }
}
