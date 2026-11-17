package com.mfx.offline

import android.content.BroadcastReceiver
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.BatteryManager
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.arm.aichat.AiChat
import com.arm.aichat.InferenceEngine
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.materialswitch.MaterialSwitch
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

class MainActivity : AppCompatActivity() {

    private lateinit var prefs: Prefs
    private lateinit var toolbar: MaterialToolbar
    private lateinit var list: RecyclerView
    private lateinit var input: EditText
    private lateinit var sendButton: ImageButton
    private lateinit var statusText: TextView
    private lateinit var librarySwitch: MaterialSwitch

    private val messages = mutableListOf<ChatMessage>()
    private lateinit var adapter: ChatAdapter

    private val engine: InferenceEngine by lazy { AiChat.getInferenceEngine(applicationContext) }
    private var modelReady = false
    private var busyLoading = false
    private var genJob: Job? = null
    private var batteryPct = -1

    private val pickModel = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) importModel(uri)
    }

    private val pickZim = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) openZim(uri, remember = true)
    }

    private val batteryReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
            if (level >= 0 && scale > 0) {
                batteryPct = level * 100 / scale
                updateSubtitle()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        findViewById<android.view.View>(R.id.root).applySystemInsets()
        prefs = Prefs(this)

        toolbar = findViewById(R.id.toolbar)
        setSupportActionBar(toolbar)
        list = findViewById(R.id.messages)
        input = findViewById(R.id.input)
        sendButton = findViewById(R.id.sendButton)
        statusText = findViewById(R.id.statusText)
        librarySwitch = findViewById(R.id.librarySwitch)

        messages += ChatStore.load(filesDir)
        adapter = ChatAdapter(messages, this::openSource, this::copyMessage)
        list.layoutManager = LinearLayoutManager(this).apply { stackFromEnd = true }
        list.adapter = adapter

        librarySwitch.isChecked = prefs.useLibrary
        librarySwitch.setOnCheckedChangeListener { _, checked ->
            prefs.useLibrary = checked
            if (checked && !ZimLibrary.isOpen) {
                toast(getString(R.string.no_library_yet))
            }
        }

        sendButton.setOnClickListener {
            if (genJob?.isActive == true) stopGeneration() else send()
        }
        input.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEND) { send(); true } else false
        }

        if (messages.isEmpty()) showWelcome()
        restoreState()
    }

    override fun onResume() {
        super.onResume()
        ContextCompat.registerReceiver(
            this, batteryReceiver,
            IntentFilter(Intent.ACTION_BATTERY_CHANGED),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
    }

    override fun onPause() {
        super.onPause()
        runCatching { unregisterReceiver(batteryReceiver) }
        ChatStore.save(filesDir, messages)
    }

    // ---------- Inicialização ----------

    private fun restoreState() {
        val zim = prefs.zimUri
        if (zim != null && !ZimLibrary.isOpen) openZim(Uri.parse(zim), remember = false)

        val path = prefs.modelPath
        if (path != null && File(path).exists()) {
            loadModel(path)
        } else {
            setStatus(getString(R.string.status_no_model))
        }
    }

    private fun showWelcome() {
        messages += ChatMessage(false, getString(R.string.welcome))
        adapter.notifyDataSetChanged()
    }

    // ---------- Modelo de IA ----------

    private fun importModel(uri: Uri) {
        if (busyLoading) return
        busyLoading = true
        lifecycleScope.launch {
            try {
                val path = withContext(Dispatchers.IO) {
                    ModelManager.import(this@MainActivity, uri) { pct ->
                        runOnUiThread { setStatus(getString(R.string.status_copying, pct)) }
                    }
                }
                prefs.modelPath = path
                busyLoading = false
                loadModel(path)
            } catch (e: Exception) {
                busyLoading = false
                setStatus(getString(R.string.status_error, e.message ?: "erro"))
            }
        }
    }

    private fun loadModel(path: String) {
        if (busyLoading) return
        busyLoading = true
        modelReady = false
        setStatus(getString(R.string.status_loading_model))
        lifecycleScope.launch {
            try {
                withContext(Dispatchers.IO) {
                    // Espera o motor nativo terminar de iniciar
                    engine.state.first {
                        it !is InferenceEngine.State.Uninitialized &&
                            it !is InferenceEngine.State.Initializing
                    }
                    val st = engine.state.value
                    if (st is InferenceEngine.State.ModelReady || st is InferenceEngine.State.Error) {
                        engine.cleanUp()
                    }
                    engine.loadModel(path)
                    engine.setSystemPrompt(Rag.SYSTEM_PROMPT)
                }
                modelReady = true
                setStatus(getString(R.string.status_ready, File(path).name))
            } catch (e: Throwable) {
                modelReady = false
                runCatching { withContext(Dispatchers.IO) { engine.cleanUp() } }
                setStatus(getString(R.string.status_model_error, e.message ?: e.javaClass.simpleName))
            } finally {
                busyLoading = false
            }
        }
    }

    // ---------- Biblioteca offline (.zim) ----------

    private fun openZim(uri: Uri, remember: Boolean) {
        lifecycleScope.launch {
            try {
                if (remember) {
                    runCatching {
                        contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                }
                withContext(Dispatchers.IO) { ZimLibrary.open(this@MainActivity, uri) }
                if (remember) {
                    prefs.zimUri = uri.toString()
                    prefs.useLibrary = true
                    librarySwitch.isChecked = true
                    toast(getString(R.string.library_opened, ZimLibrary.title))
                }
                updateSubtitle()
            } catch (e: Exception) {
                if (remember) toast(getString(R.string.status_error, e.message ?: "erro"))
                else prefs.zimUri = null
            }
        }
    }

    private fun openSource(s: Source) {
        startActivity(Intent(this, ReaderActivity::class.java).putExtra(ReaderActivity.EXTRA_PATH, s.path))
    }

    // ---------- Conversa ----------

    private fun send() {
        val question = input.text.toString().trim()
        if (question.isEmpty()) return
        if (!modelReady) {
            toast(getString(if (busyLoading) R.string.wait_loading else R.string.status_no_model))
            return
        }
        input.setText("")

        messages += ChatMessage(true, question)
        val answer = ChatMessage(false, "", pending = true)
        messages += answer
        adapter.notifyItemRangeInserted(messages.size - 2, 2)
        scrollToEnd()
        setSending(true)

        val useLib = prefs.useLibrary && ZimLibrary.isOpen
        genJob = lifecycleScope.launch {
            val sb = StringBuilder()
            try {
                if (useLib) setStatus(getString(R.string.status_searching))
                val prepared = withContext(Dispatchers.IO) { Rag.prepare(question, useLib) }
                answer.sources = prepared.sources
                setStatus(getString(R.string.status_thinking))
                notifyMessage(answer)

                engine.sendUserPrompt(prepared.prompt, prefs.maxTokens).collect { token ->
                    sb.append(token)
                    answer.text = sb.toString()
                    notifyMessage(answer)
                }
                setStatus(getString(R.string.status_done))
            } catch (e: CancellationException) {
                setStatus(getString(R.string.status_stopped))
            } catch (e: Throwable) {
                setStatus(getString(R.string.status_error, e.message ?: e.javaClass.simpleName))
                if (sb.isEmpty()) answer.text = getString(R.string.answer_failed)
            } finally {
                answer.pending = false
                if (answer.text.isBlank()) answer.text = getString(R.string.answer_empty)
                answer.text = answer.text.trim()
                notifyMessage(answer)
                setSending(false)
                ChatStore.save(filesDir, messages)
            }
        }
    }

    private fun stopGeneration() {
        genJob?.cancel()
    }

    private fun newConversation() {
        stopGeneration()
        messages.clear()
        ChatStore.clear(filesDir)
        adapter.notifyDataSetChanged()
        showWelcome()
        // Recarrega o modelo para a IA "esquecer" a conversa anterior
        prefs.modelPath?.let { path ->
            lifecycleScope.launch {
                genJob?.join()
                if (File(path).exists()) loadModel(path)
            }
        }
    }

    private fun notifyMessage(m: ChatMessage) {
        val i = messages.indexOf(m)
        if (i >= 0) {
            adapter.notifyItemChanged(i)
            if (i == messages.size - 1) scrollToEnd()
        }
    }

    private fun scrollToEnd() {
        if (messages.isNotEmpty()) list.scrollToPosition(messages.size - 1)
    }

    private fun copyMessage(m: ChatMessage) {
        val cm = getSystemService(ClipboardManager::class.java)
        cm.setPrimaryClip(ClipData.newPlainText("MFX Offline", m.text))
        toast(getString(R.string.copied))
    }

    private fun setSending(sending: Boolean) {
        sendButton.setImageResource(if (sending) R.drawable.ic_stop else R.drawable.ic_send)
        sendButton.contentDescription = getString(if (sending) R.string.stop else R.string.send)
    }

    // ---------- Menu ----------

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        when (item.itemId) {
            R.id.action_read -> {
                if (ZimLibrary.isOpen) startActivity(Intent(this, ReaderActivity::class.java))
                else toast(getString(R.string.no_library_yet))
            }
            R.id.action_new_chat -> newConversation()
            R.id.action_model -> pickModel.launch(arrayOf("*/*"))
            R.id.action_library -> pickZim.launch(arrayOf("*/*"))
            R.id.action_length -> chooseLength()
            R.id.action_help -> showHelp()
            else -> return super.onOptionsItemSelected(item)
        }
        return true
    }

    private fun chooseLength() {
        val values = intArrayOf(192, 384, 768)
        val current = values.indexOf(prefs.maxTokens).coerceAtLeast(0)
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.menu_length)
            .setSingleChoiceItems(R.array.length_options, current) { d, which ->
                prefs.maxTokens = values[which]
                d.dismiss()
            }
            .show()
    }

    private fun showHelp() {
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.menu_help)
            .setMessage(R.string.help_text)
            .setPositiveButton(android.R.string.ok, null)
            .show()
    }

    // ---------- Status ----------

    private var lastStatus = ""

    private fun setStatus(text: String) {
        lastStatus = text
        statusText.text = text
    }

    private fun updateSubtitle() {
        val parts = mutableListOf<String>()
        if (batteryPct >= 0) parts += getString(R.string.battery, batteryPct)
        if (ZimLibrary.isOpen) parts += ZimLibrary.title
        toolbar.subtitle = parts.joinToString(" · ")
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
}
