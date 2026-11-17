package com.mfx.offline

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import java.io.File
import java.io.IOException

/**
 * Copia o arquivo do modelo (.gguf) escolhido pelo usuário para dentro do app,
 * porque o motor de IA precisa de um caminho de arquivo direto.
 */
object ModelManager {

    fun modelsDir(context: Context) = File(context.filesDir, "modelos").apply { mkdirs() }

    fun displayName(context: Context, uri: Uri): String {
        context.contentResolver.query(uri, null, null, null, null)?.use { c ->
            val idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (idx >= 0 && c.moveToFirst()) return c.getString(idx)
        }
        return uri.lastPathSegment?.substringAfterLast('/') ?: "modelo.gguf"
    }

    private fun size(context: Context, uri: Uri): Long {
        context.contentResolver.query(uri, null, null, null, null)?.use { c ->
            val idx = c.getColumnIndex(OpenableColumns.SIZE)
            if (idx >= 0 && c.moveToFirst() && !c.isNull(idx)) return c.getLong(idx)
        }
        return -1L
    }

    /** Copia o modelo e devolve o caminho final. [onProgress] recebe de 0 a 100. */
    fun import(context: Context, uri: Uri, onProgress: (Int) -> Unit): String {
        val name = displayName(context, uri)
        if (!name.lowercase().endsWith(".gguf")) {
            throw IOException("O arquivo precisa terminar em .gguf (você escolheu: $name)")
        }
        val total = size(context, uri)
        val dir = modelsDir(context)
        if (total > 0 && dir.usableSpace < total + 200L * 1024 * 1024) {
            throw IOException("Pouco espaço livre no celular para copiar o modelo.")
        }

        val tmp = File(dir, "$name.parcial")
        context.contentResolver.openInputStream(uri).use { input ->
            requireNotNull(input) { "Não consegui abrir o arquivo." }
            tmp.outputStream().use { out ->
                val buf = ByteArray(1024 * 1024)
                var copied = 0L
                var lastPct = -1
                while (true) {
                    val n = input.read(buf)
                    if (n < 0) break
                    out.write(buf, 0, n)
                    copied += n
                    if (total > 0) {
                        val pct = (copied * 100 / total).toInt()
                        if (pct != lastPct) { lastPct = pct; onProgress(pct) }
                    }
                }
            }
        }

        // Apaga modelos antigos para não lotar a memória do celular
        dir.listFiles()?.forEach { if (it.name != tmp.name) it.delete() }
        val final = File(dir, name)
        if (!tmp.renameTo(final)) throw IOException("Falha ao salvar o modelo.")
        return final.absolutePath
    }
}
