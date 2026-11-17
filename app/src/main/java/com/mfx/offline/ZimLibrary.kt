package com.mfx.offline

import android.content.Context
import android.net.Uri
import android.os.ParcelFileDescriptor
import org.jsoup.Jsoup
import org.kiwix.libzim.Archive
import org.kiwix.libzim.Item
import org.kiwix.libzim.Query
import org.kiwix.libzim.Searcher
import org.kiwix.libzim.SuggestionSearcher

data class ZimHit(val title: String, val path: String, val snippet: String)

/**
 * Biblioteca offline: abre um arquivo .zim do Kiwix (Wikipédia, WikiMed etc.),
 * pesquisa artigos e extrai o texto para a IA usar como base.
 */
object ZimLibrary {

    private var pfd: ParcelFileDescriptor? = null
    @Volatile private var archive: Archive? = null
    private var searcher: Searcher? = null
    private var suggester: SuggestionSearcher? = null

    var title: String = ""
        private set

    val isOpen: Boolean get() = archive != null

    /** Abre o .zim escolhido pelo usuário (sem copiar, lendo direto do armazenamento). */
    @Synchronized
    fun open(context: Context, uri: Uri) {
        close()
        val fd = context.contentResolver.openFileDescriptor(uri, "r")
            ?: throw IllegalStateException("Não consegui abrir o arquivo .zim")
        val arc = try {
            Archive(fd.fileDescriptor)
        } catch (e: Throwable) {
            fd.close()
            throw IllegalStateException("Esse arquivo não parece ser um .zim válido do Kiwix.", e)
        }
        pfd = fd
        archive = arc
        searcher = if (arc.hasFulltextIndex()) runCatching { Searcher(arc) }.getOrNull() else null
        suggester = if (arc.hasTitleIndex()) runCatching { SuggestionSearcher(arc) }.getOrNull() else null
        title = runCatching { arc.getMetadata("Title") }.getOrNull()?.takeIf { it.isNotBlank() }
            ?: ModelManager.displayName(context, uri)
    }

    @Synchronized
    fun close() {
        archive = null
        searcher = null
        suggester = null
        runCatching { pfd?.close() }
        pfd = null
        title = ""
    }

    /** Pesquisa artigos. Usa busca no texto completo e, se não houver, busca por título. */
    @Synchronized
    fun search(text: String, max: Int = 8): List<ZimHit> {
        if (archive == null || text.isBlank()) return emptyList()
        val hits = mutableListOf<ZimHit>()

        searcher?.let { s ->
            runCatching {
                val results = s.search(Query(text)).getResults(0, max)
                while (results.hasNext() && hits.size < max) {
                    val hitTitle = results.title
                    val hitPath = results.path
                    val snippet = results.snippet ?: ""
                    hits += ZimHit(hitTitle, hitPath, cleanSnippet(snippet))
                    results.next()
                }
            }
        }

        if (hits.isEmpty()) {
            suggester?.let { s ->
                runCatching {
                    val results = s.suggest(text).getResults(0, max)
                    while (results.hasNext() && hits.size < max) {
                        val item = results.next()
                        val snippet = if (item.hasSnippet()) item.snippet else ""
                        hits += ZimHit(item.title, item.path, cleanSnippet(snippet))
                    }
                }
            }
        }
        return hits.distinctBy { it.path }
    }

    private fun cleanSnippet(s: String) = Jsoup.parse(s).text()

    /** Busca um item (página, imagem, css) pelo caminho dentro do .zim. */
    fun item(path: String): Item? {
        val arc = archive ?: return null
        return runCatching { arc.getEntryByPath(path).getItem(true) }.getOrNull()
    }

    fun mainPath(): String? {
        val arc = archive ?: return null
        return runCatching { arc.mainEntry.getItem(true).path }.getOrNull()
    }

    /** Extrai o texto limpo de um artigo, cortado em [maxChars] caracteres. */
    fun articleText(path: String, maxChars: Int): String {
        val item = item(path) ?: return ""
        if (!item.mimetype.startsWith("text/html")) return ""
        val html = String(item.data.data, Charsets.UTF_8)
        val doc = Jsoup.parse(html)
        doc.select("script, style, table, sup, .navbox, .infobox, .reference, .mw-editsection, figure").remove()
        val sb = StringBuilder()
        for (el in doc.select("p, li, h2, h3")) {
            val t = el.text().trim()
            if (t.length < 3) continue
            sb.append(t).append('\n')
            if (sb.length >= maxChars) break
        }
        return sb.toString().take(maxChars).trim()
    }
}
