package com.mfx.offline

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class ChatAdapter(
    private val messages: List<ChatMessage>,
    private val onSourceClick: (Source) -> Unit,
    private val onLongClick: (ChatMessage) -> Unit,
) : RecyclerView.Adapter<ChatAdapter.Holder>() {

    class Holder(view: View) : RecyclerView.ViewHolder(view) {
        val text: TextView = view.findViewById(R.id.messageText)
        val sources: LinearLayout? = view.findViewById(R.id.sourcesBox)
    }

    override fun getItemViewType(position: Int) = if (messages[position].fromUser) 0 else 1

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
        val layout = if (viewType == 0) R.layout.item_message_user else R.layout.item_message_ai
        return Holder(LayoutInflater.from(parent.context).inflate(layout, parent, false))
    }

    override fun getItemCount() = messages.size

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val m = messages[position]
        holder.text.text = if (m.pending && m.text.isEmpty()) "…" else m.text
        holder.text.alpha = if (m.pending && m.text.isEmpty()) 0.6f else 1f
        holder.itemView.setOnLongClickListener { onLongClick(m); true }

        val box = holder.sources ?: return
        box.removeAllViews()
        if (m.sources.isEmpty()) {
            box.visibility = View.GONE
            return
        }
        box.visibility = View.VISIBLE
        val ctx = holder.itemView.context
        m.sources.forEachIndexed { i, s ->
            val tv = LayoutInflater.from(ctx).inflate(R.layout.item_source, box, false) as TextView
            tv.text = ctx.getString(R.string.source_label, i + 1, s.title)
            tv.setOnClickListener { onSourceClick(s) }
            box.addView(tv)
        }
    }
}
