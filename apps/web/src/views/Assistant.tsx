import { useEffect, useRef, useState } from 'react'
import { AskCard } from '../components/assistant/AskCard'
import { Conversation } from '../components/assistant/Conversation'
import { TrustLine } from '../components/assistant/TrustLine'
import type { Message } from '../components/assistant/Turn'
import { errorMessage, sendJson } from '../lib/api'
import { useApp } from '../lib/app-context'

const CHAT_TIMEOUT_MS = 90_000

/** Messages alternate question, answer; the last turn has no answer while one is pending. */
function toTurns(messages: Message[]): Message[][] {
  const turns: Message[][] = []
  for (let i = 0; i < messages.length; i += 2) turns.push(messages.slice(i, i + 2))
  return turns
}

/** threadId lives only in component state, never localStorage/sessionStorage:
 * a chat must not survive a reload. App keeps this mounted while hidden. */
export function Assistant() {
  const { view, pendingQuestion, clearPendingQuestion } = useApp()
  const [threadId, setThreadId] = useState(() => crypto.randomUUID())
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const askRef = useRef<HTMLTextAreaElement>(null)
  const followUpRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (messages.length > 0) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages.length, loading])

  const send = async (text: string, focusRef = askRef) => {
    const message = text.trim()
    if (!message || loading) return
    setMessages((m) => [...m, { role: 'user', content: message, at: Date.now() }])
    setLoading(true)
    try {
      const data = await sendJson<{ answer: string }>('POST', '/api/assistant/chat', { message, threadId }, CHAT_TIMEOUT_MS)
      setMessages((m) => [...m, { role: 'assistant', content: data.answer, at: Date.now() }])
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `I couldn't answer that: ${errorMessage(e)}`, at: Date.now(), failed: true },
      ])
    } finally {
      setLoading(false)
      focusRef.current?.focus()
    }
  }

  const handledRef = useRef<string | null>(null)
  useEffect(() => {
    if (!pendingQuestion) {
      handledRef.current = null
      return
    }
    if (loading || pendingQuestion === handledRef.current) return
    handledRef.current = pendingQuestion
    clearPendingQuestion()
    void send(pendingQuestion)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion, loading])

  const reset = () => {
    setMessages([])
    setThreadId(crypto.randomUUID())
    askRef.current?.focus()
  }

  const turns = toTurns(messages)
  const latest = turns.at(-1) ?? null

  return (
    <div className="flex flex-col gap-5">
      {view === 'assistant' && <TrustLine />}
      <AskCard latest={latest} loading={loading} endRef={endRef} inputRef={askRef} onSend={(t) => void send(t)} />
      <Conversation
        earlier={turns.slice(0, -1)}
        empty={messages.length === 0}
        loading={loading}
        inputRef={followUpRef}
        onSend={(t) => void send(t, followUpRef)}
        onReset={reset}
      />
    </div>
  )
}
