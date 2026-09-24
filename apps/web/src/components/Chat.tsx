import { useRef, useState } from 'react'

/** SOURCE OF TRUTH: the S1-7 chat panel.
 * WHAT: calls POST /api/chat with a threadId generated once per mount.
 * WHY: threadId lives only in this component's state, never persisted to
 * localStorage/sessionStorage -- memory works within an open chat, but
 * nothing is recoverable after closing/reloading, per the user's rule.
 * WHERE: owns the message list + input only. Aggregation and the agent
 * loop live server-side (chat/agent.ts).
 */

type Message = { role: 'user' | 'assistant'; content: string }

export function Chat() {
  const threadIdRef = useRef(crypto.randomUUID())
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  const send = async () => {
    const message = input.trim()
    if (!message || status === 'loading') return
    setMessages((m) => [...m, { role: 'user', content: message }])
    setInput('')
    setStatus('loading')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, threadId: threadIdRef.current }),
      })
      if (!res.ok) throw new Error('chat request failed')
      const data = await res.json()
      setMessages((m) => [...m, { role: 'assistant', content: data.answer }])
      setStatus('idle')
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Something went wrong — try again.' }])
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
        Ask about your money
      </h2>

      <div className="flex flex-col gap-3">
        {messages.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Try "what are my biggest expenses this month" or "how much did I spend on groceries".
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className="max-w-[85%] rounded-xl px-4 py-2.5 text-sm"
              style={
                m.role === 'user'
                  ? { background: 'var(--accent-soft)', color: 'var(--text-primary)', alignSelf: 'flex-end' }
                  : {
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      alignSelf: 'flex-start',
                      border: '1px solid var(--border-subtle)',
                    }
              }
            >
              {m.content}
            </div>
          ))
        )}
        {status === 'loading' && (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Thinking…
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          className="flex-1 rounded-lg px-4 py-2.5 text-sm outline-none"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-standard)', color: 'var(--text-primary)' }}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}
        >
          Send
        </button>
      </form>
    </div>
  )
}
