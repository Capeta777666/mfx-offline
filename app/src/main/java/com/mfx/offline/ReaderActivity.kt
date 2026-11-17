package com.mfx.offline

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.appbar.MaterialToolbar
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayInputStream

/**
 * Modo leitura: pesquisa e abre os artigos da biblioteca offline direto,
 * sem usar a IA (gasta bem menos bateria).
 */
class ReaderActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_PATH = "path"
        private const val HOST = "zim.local"
    }

    private lateinit var web: WebView
    private lateinit var results: RecyclerView
    private lateinit var emptyText: TextView
    private val hits = mutableListOf<ZimHit>()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_reader)
        findViewById<View>(R.id.root).applySystemInsets()

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        toolbar.subtitle = ZimLibrary.title
        toolbar.setNavigationOnClickListener { onBackPressedDispatcher.onBackPressed() }

        web = findViewById(R.id.web)
        results = findViewById(R.id.results)
        emptyText = findViewById(R.id.emptyText)
        val search = findViewById<EditText>(R.id.search)

        web.settings.javaScriptEnabled = true
        web.settings.blockNetworkLoads = false
        web.settings.builtInZoomControls = true
        web.settings.displayZoomControls = false
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val url = request.url
                if (url.host != HOST) {
                    // Sem internet: bloqueia qualquer coisa de fora
                    return WebResourceResponse("text/plain", "utf-8", ByteArrayInputStream(ByteArray(0)))
                }
                val path = Uri.decode(url.encodedPath?.removePrefix("/") ?: "")
                val item = ZimLibrary.item(path) ?: return WebResourceResponse(
                    "text/html", "utf-8", 404, "Not Found", emptyMap(),
                    ByteArrayInputStream("<p>Página não encontrada na biblioteca.</p>".toByteArray())
                )
                val mime = item.mimetype.substringBefore(';').trim().ifEmpty { "application/octet-stream" }
                val charset = if (mime.startsWith("text/") || mime.contains("javascript")) "utf-8" else null
                return WebResourceResponse(mime, charset, ByteArrayInputStream(item.data.data))
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return request.url.host != HOST
            }
        }

        results.layoutManager = LinearLayoutManager(this)
        results.adapter = ResultsAdapter()

        search.setOnEditorActionListener { v, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                runSearch(v.text.toString())
                getSystemService(InputMethodManager::class.java)?.hideSoftInputFromWindow(v.windowToken, 0)
                true
            } else false
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    web.visibility == View.VISIBLE && web.canGoBack() -> web.goBack()
                    web.visibility == View.VISIBLE && hits.isNotEmpty() -> showResults()
                    else -> finish()
                }
            }
        })

        val path = intent.getStringExtra(EXTRA_PATH) ?: ZimLibrary.mainPath()
        if (path != null) openArticle(path) else showResults()
    }

    private fun runSearch(text: String) {
        if (text.isBlank()) return
        lifecycleScope.launch {
            val found = withContext(Dispatchers.IO) {
                ZimLibrary.search(text, 30).ifEmpty { ZimLibrary.search(Rag.stripAccents(text), 30) }
            }
            hits.clear()
            hits += found
            results.adapter?.notifyDataSetChanged()
            showResults()
        }
    }

    private fun showResults() {
        web.visibility = View.GONE
        results.visibility = if (hits.isEmpty()) View.GONE else View.VISIBLE
        emptyText.visibility = if (hits.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun openArticle(path: String) {
        results.visibility = View.GONE
        emptyText.visibility = View.GONE
        web.visibility = View.VISIBLE
        val encoded = path.split('/').joinToString("/") { Uri.encode(it) }
        web.loadUrl("https://$HOST/$encoded")
    }

    private inner class ResultsAdapter : RecyclerView.Adapter<ResultHolder>() {

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
            ResultHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_result, parent, false))

        override fun getItemCount() = hits.size

        override fun onBindViewHolder(holder: ResultHolder, position: Int) {
            val h = hits[position]
            holder.title.text = h.title
            holder.snippet.text = h.snippet
            holder.snippet.visibility = if (h.snippet.isBlank()) View.GONE else View.VISIBLE
            holder.itemView.setOnClickListener { openArticle(h.path) }
        }
    }
}

internal class ResultHolder(v: View) : RecyclerView.ViewHolder(v) {
    val title: TextView = v.findViewById(R.id.resultTitle)
    val snippet: TextView = v.findViewById(R.id.resultSnippet)
}
