import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/Typography'
import { errorMessage, sendJson } from '../lib/api'
import { useApp } from '../lib/app-context'

type Message = { role: 'user' | 'assistant'; content: string; failed?: boolean }

const SUGGESTIONS = [
  'What were my biggest expenses this month?',
  'How much did I spend on food and drink this year?',
  'Who are my top merchants over the last 30 days?',
  'Did I earn more than I spent this month?',
  'What are my account balances?',
]

const CHAT_TIMEOUT_MS = 90_000

/** threadId lives only in component state, never localStorage/sessionStorage:
 * a chat must not survive a reload. App keeps this mounted while hidden. */
export function Assistant() {
  const { pendingQuestion, clearPendingQuestion } = useApp()
  const [threadId, setThreadId] = useState(() => crypto.randomUUID())
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (messages.length > 0) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, loading])

  const send = async (text: string) => {
    const message = text.trim()
    if (!message || loading) return
    setMessages((m) => [...m, { role: 'user', content: message }])
    setInput('')
    setLoading(true)
    try {
      const data = await sendJson<{ answer: string }>('POST', '/api/assistant/chat', { message, threadId }, CHAT_TIMEOUT_MS)
      setMessages((m) => [...m, { role: 'assistant', content: data.answer }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `I couldn't answer that: ${errorMessage(e)}`, failed: true }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handledRef = useRef<string | null>(null)
  useEffect(() => {
    if (pendingQuestion && pendingQuestion !== handledRef.current) {
      handledRef.current = pendingQuestion
      const q = pendingQuestion
      clearPendingQuestion()
      void send(q)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion])

  const reset = () => {
    setMessages([])
    setThreadId(crypto.randomUUID())
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Ask your ledger"
        title="Assistant"
        lede="Plain-English questions, answered from your own transactions. The conversation is forgotten when you reload."
        actions={
          messages.length > 0 && (
            <Button onClick={reset} disabled={loading}>
              New conversation
            </Button>
          )
        }
      />

      <section aria-label="Conversation" className="flex min-h-[52svh] flex-col">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-4">
            <p className="eyebrow">Try asking</p>
            <ul className="flex flex-col border-t border-line">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => send(s)}
                    className="group flex w-full items-center justify-between gap-4 border-b border-line py-3.5 text-left font-display text-[19px] text-ink-2 transition-colors hover:text-ink"
                  >
                    {s}
                    <span aria-hidden className="text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent">
                      →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="flex flex-col gap-7" aria-live="polite">
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <li key={i} className="flex flex-col items-end gap-1.5">
                  <span className="eyebrow">You</span>
                  <p className="max-w-[85%] rounded-[3px] bg-surface-2 px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-ink">
                    {m.content}
                  </p>
                </li>
              ) : (
                <li key={i} className="flex max-w-[92%] flex-col gap-1.5">
                  <span className="eyebrow text-accent">Fluide</span>
                  <p
                    className={`border-l-2 pl-4 font-display text-[18px] leading-[1.6] whitespace-pre-wrap ${
                      m.failed ? 'border-broken text-broken' : 'border-accent text-ink'
                    }`}
                  >
                    {m.content}
                  </p>
                </li>
              ),
            )}
            {loading && (
              <li className="flex flex-col gap-1.5" role="status">
                <span className="eyebrow text-accent">Fluide</span>
                <p className="border-l-2 border-line-strong pl-4 font-display text-[18px] text-ink-3 italic">
                  Reading the ledger<span className="animate-pulse">…</span>
                </p>
              </li>
            )}
          </ol>
        )}
        <div ref={endRef} />
      </section>

      <form
        className="sticky bottom-0 -mx-5 border-t border-ink bg-canvas/95 px-5 py-4 md:mx-0 md:px-0"
        onSubmit={(e) => {
          e.preventDefault()
          void send(input)
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          Ask a question about your money
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="chat-input"
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void send(input)
              }
            }}
            placeholder="Ask about your money…"
            className="max-h-40 min-h-10 flex-1 resize-none rounded-[3px] border border-line-strong bg-surface px-3 py-[7px] text-[15px] leading-6 text-ink placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-accent outline-none"
          />
          <Button type="submit" variant="primary" busy={loading} disabled={!input.trim()}>
            {loading ? 'Asking…' : 'Ask'}
          </Button>
        </div>
        <p className="mt-2 text-[12px] text-ink-3">Enter to send · Shift + Enter for a new line. Answers can take up to half a minute.</p>
      </form>
    </div>
  )
}
