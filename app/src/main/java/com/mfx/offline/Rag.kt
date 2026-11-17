package com.mfx.offline

import java.text.Normalizer

/**
 * RAG: busca trechos na biblioteca offline e monta a pergunta para a IA
 * responder com base neles (e inventar menos).
 */
object Rag {

    const val SYSTEM_PROMPT =
        "Você é o MFX Offline, um assistente que funciona sem internet. " +
        "Responda sempre em português do Brasil, de forma curta, clara e prática. " +
        "Quando receber trechos de referência, baseie a resposta neles. " +
        "Se não souber ou os trechos não ajudarem, diga que não tem certeza. " +
        "Em assuntos de saúde ou perigo, dê orientações seguras e recomende procurar ajuda profissional assim que possível."

    private val STOPWORDS = setOf(
        "a", "o", "as", "os", "um", "uma", "uns", "umas", "de", "do", "da", "dos", "das",
        "em", "no", "na", "nos", "nas", "por", "para", "pra", "pro", "com", "sem", "e", "ou",
        "que", "qual", "quais", "como", "quando", "onde", "porque", "por que", "quem", "quanto",
        "é", "ser", "são", "foi", "está", "estou", "tá", "ta", "tem", "ter", "faz", "fazer",
        "eu", "me", "meu", "minha", "você", "voce", "se", "isso", "isto", "esse", "essa", "este",
        "esta", "ao", "aos", "à", "às", "mais", "muito", "muita", "posso", "pode", "devo", "deve",
        "consigo", "consegue", "sobre", "algum", "alguma", "the", "of", "to", "how", "what", "is"
    )

    /** Tira palavras vazias da pergunta, deixando só as palavras-chave. */
    fun keywords(question: String): String {
        val words = question.lowercase()
            .replace(Regex("[^\\p{L}\\p{N}\\s-]"), " ")
            .split(Regex("\\s+"))
            .filter { it.length > 1 && it !in STOPWORDS }
        return words.take(8).joinToString(" ")
    }

    fun stripAccents(s: String): String =
        Normalizer.normalize(s, Normalizer.Form.NFD).replace(Regex("\\p{Mn}+"), "")

    data class Prepared(val prompt: String, val sources: List<Source>)

    /**
     * Monta o texto enviado à IA. Busca até [maxArticles] artigos e
     * usa no máximo [charsPerArticle] caracteres de cada (modelo pequeno, contexto curto).
     */
    fun prepare(
        question: String,
        useLibrary: Boolean,
        maxArticles: Int = 2,
        charsPerArticle: Int = 900,
    ): Prepared {
        if (!useLibrary || !ZimLibrary.isOpen) return Prepared(question, emptyList())

        val kw = keywords(question).ifBlank { question }
        var hits = ZimLibrary.search(kw, maxArticles + 2)
        if (hits.isEmpty()) hits = ZimLibrary.search(stripAccents(kw), maxArticles + 2)
        if (hits.isEmpty()) return Prepared(question, emptyList())

        val used = mutableListOf<Source>()
        val sb = StringBuilder()
        for (h in hits) {
            if (used.size >= maxArticles) break
            val text = ZimLibrary.articleText(h.path, charsPerArticle)
            if (text.isBlank()) continue
            used += Source(h.title, h.path)
            sb.append("[").append(used.size).append("] ").append(h.title).append(":\n")
                .append(text).append("\n\n")
        }
        if (used.isEmpty()) return Prepared(question, emptyList())

        val prompt = buildString {
            append("Trechos de referência da biblioteca offline:\n\n")
            append(sb)
            append("Usando os trechos acima quando forem úteis, responda de forma curta e prática.\n")
            append("Pergunta: ").append(question)
        }
        return Prepared(prompt, used)
    }
}
