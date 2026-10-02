import { useCallback, useEffect, useRef, useState } from 'react'
import { AskCard } from '../components/assistant/AskCard'
import { Conversation } from '../components/assistant/Conversation'
import { TrustLine } from '../components/assistant/TrustLine'
import type { Message } from '../components/assistant/Turn'
import {
  deleteAllChatThreads,
  deleteChatThread,
  errorMessage,
  getChatThread,
  listChatThreads,
  sendJson,
  type ChatReply,
  type ChatThreadSummary,
} from '../lib/api'
import { useApp } from '../lib/app-context'

const CHAT_TIMEOUT_MS = 90_000

/** Messages alternate question, answer; the last turn has no answer while one is pending. */
function toTurns(messages: Message[]): Message[][] {
  const turns: Message[][] = []
  for (let i = 0; i < messages.length; i += 2) turns.push(messages.slice(i, i + 2))
  return turns
}

export function Assistant() {
  const { view, pendingQuestion, clearPendingQuestion } = useApp()
  const [threadId, setThreadId] = useState<string>(() => crypto.randomUUID())
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [threads, setThreads] = useState<ChatThreadSummary[] | null>(null)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [opening, setOpening] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const latestRef = useRef<HTMLDivElement>(null)
  const askRef = useRef<HTMLTextAreaElement>(null)
  const followUpRef = useRef<HTMLTextAreaElement>(null)

  const refreshThreads = useCallback(async () => {
    try {
      setThreads(await listChatThreads())
    } catch (e) {
      setThreads((t) => t ?? [])
      setError(`Couldn't load past conversations: ${errorMessage(e)}`)
    }
  }, [])

  const visible = view === 'assistant'
  useEffect(() => {
    if (visible) void refreshThreads()
  }, [visible, refreshThreads])

  // Each new question, answer or opened thread scrolls the panel (first turn) or the newest turn into view.
  useEffect(() => {
    if (messages.length === 0) return
    const target = messages.length <= 2 ? panelRef.current : latestRef.current
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }, [messages.length, threadId])

  const send = async (text: string) => {
    const message = text.trim()
    if (!message || loading) return
    setError(null)
    setHistoryOpen(false)
    setMessages((m) => [...m, { role: 'user', content: message, at: Date.now() }])
    setLoading(true)
    try {
      const data = await sendJson<ChatReply>('POST', '/api/assistant/chat', { message, threadId }, CHAT_TIMEOUT_MS)
      setMessages((m) => [...m, { role: 'assistant', content: data.answer, at: Date.now() }])
      void refreshThreads()
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `I couldn't answer that: ${errorMessage(e)}`, at: Date.now(), failed: true },
      ])
    } finally {
      setLoading(false)
      followUpRef.current?.focus({ preventScroll: true })
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

  const startNew = () => {
    setMessages([])
    setThreadId(crypto.randomUUID())
    setHistoryOpen(true)
  }

  const reset = () => {
    setError(null)
    startNew()
    followUpRef.current?.focus({ preventScroll: true })
  }

  const open = async (id: string) => {
    if (id === threadId && messages.length > 0) {
      setHistoryOpen(false)
      return
    }
    setError(null)
    setOpening(id)
    try {
      const thread = await getChatThread(id)
      setThreadId(thread.id)
      setMessages(thread.messages.map((m) => ({ role: m.role, content: m.content, at: Date.parse(m.at) })))
      setHistoryOpen(false)
    } catch (e) {
      setError(`Couldn't open that conversation: ${errorMessage(e)}`)
      void refreshThreads()
    } finally {
      setOpening(null)
    }
  }

  const remove = async (id: string) => {
    setError(null)
    setDeleting(true)
    try {
      await deleteChatThread(id)
      if (id === threadId) startNew()
    } catch (e) {
      setError(`Couldn't delete that conversation: ${errorMessage(e)}`)
    } finally {
      setDeleting(false)
      void refreshThreads()
    }
  }

  const clearAll = async () => {
    setError(null)
    setDeleting(true)
    try {
      await deleteAllChatThreads()
      startNew()
    } catch (e) {
      setError(`Couldn't clear past conversations: ${errorMessage(e)}`)
    } finally {
      setDeleting(false)
      void refreshThreads()
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {visible && <TrustLine />}
      <AskCard loading={loading} inputRef={askRef} onSend={(t) => void send(t)} />
      <Conversation
        turns={toTurns(messages)}
        loading={loading}
        threads={threads}
        historyOpen={historyOpen}
        history={{
          currentId: threadId,
          opening,
          locked: loading || deleting,
          onOpen: (id) => void open(id),
          onDelete: (id) => void remove(id),
          onClearAll: () => void clearAll(),
        }}
        error={error}
        panelRef={panelRef}
        latestRef={latestRef}
        inputRef={followUpRef}
        onToggleHistory={() => setHistoryOpen((o) => !o)}
        onSend={(t) => void send(t)}
        onReset={reset}
      />
    </div>
  )
}
