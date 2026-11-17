package com.mfx.offline

import android.content.Context

/** Configurações salvas do app. */
class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("mfx_offline", Context.MODE_PRIVATE)

    var modelPath: String?
        get() = sp.getString("model_path", null)
        set(v) = sp.edit().putString("model_path", v).apply()

    var zimUri: String?
        get() = sp.getString("zim_uri", null)
        set(v) = sp.edit().putString("zim_uri", v).apply()

    /** Download do modelo em andamento (-1 = nenhum). */
    var downloadId: Long
        get() = sp.getLong("download_id", -1L)
        set(v) = sp.edit().putLong("download_id", v).apply()

    var useLibrary: Boolean
        get() = sp.getBoolean("use_library", true)
        set(v) = sp.edit().putBoolean("use_library", v).apply()

    /** Tamanho máximo da resposta, em tokens (menor = mais rápido e gasta menos bateria). */
    var maxTokens: Int
        get() = sp.getInt("max_tokens", 384)
        set(v) = sp.edit().putInt("max_tokens", v).apply()
}
