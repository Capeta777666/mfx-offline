package com.mfx.offline

import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class Source(val title: String, val path: String)

class ChatMessage(
    val fromUser: Boolean,
    var text: String,
    var sources: List<Source> = emptyList(),
    var pending: Boolean = false,
)

/** Guarda a última conversa num arquivo simples no celular. */
object ChatStore {
    private fun file(dir: File) = File(dir, "conversa.json")

    fun save(dir: File, messages: List<ChatMessage>) {
        runCatching {
            val arr = JSONArray()
            messages.filter { !it.pending }.forEach { m ->
                val src = JSONArray()
                m.sources.forEach { s -> src.put(JSONObject().put("t", s.title).put("p", s.path)) }
                arr.put(JSONObject().put("u", m.fromUser).put("x", m.text).put("s", src))
            }
            file(dir).writeText(arr.toString())
        }
    }

    fun load(dir: File): MutableList<ChatMessage> {
        val out = mutableListOf<ChatMessage>()
        runCatching {
            val f = file(dir)
            if (!f.exists()) return out
            val arr = JSONArray(f.readText())
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val src = o.optJSONArray("s") ?: JSONArray()
                val sources = (0 until src.length()).map {
                    val s = src.getJSONObject(it)
                    Source(s.getString("t"), s.getString("p"))
                }
                out += ChatMessage(o.getBoolean("u"), o.getString("x"), sources)
            }
        }
        return out
    }

    fun clear(dir: File) {
        file(dir).delete()
    }
}
