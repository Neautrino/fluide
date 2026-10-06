import { useEffect, useRef, useState } from 'react'
import type { ChatThreadSummary } from '../../types'
import { timeAgo } from '../../lib/connection-health'
import { plural } from '../overview/model'
import { Spinner } from '../ui/Button'

export type HistoryProps = {
  threads: ChatThreadSummary[]
  currentId: string
  /** The thread being loaded, if any. */
  opening: string | null
  /** A reply is pending or a delete is running: rows can't be opened or deleted. */
  locked: boolean
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onClearAll: () => void
  /** Pins the "updated 2h ago" stamps; defaults to the real clock. */
  now?: number
}

function ClearAll({ count, locked, onConfirm }: { count: number; locked: boolean; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const keepRef = useRef<HTMLButtonElement>(null)
  const clearRef = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)

  useEffect(() => {
    if (confirming) keepRef.current?.focus()
    else if (restoreFocus.current) {
      restoreFocus.current = false
      clearRef.current?.focus()
    }
  }, [confirming])

  const keep = () => {
    restoreFocus.current = true
    setConfirming(false)
  }

  const link = 'underline underline-offset-2 hover:text-ink disabled:cursor-not-allowed disabled:no-underline'

  return confirming ? (
    <p
      role="group"
      aria-label="Confirm deleting all conversations"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          keep()
        }
      }}
      className="px-0.5 pt-2.5 font-mono text-[11.5px] leading-[1.5] text-ink-3"
    >
      Delete all {plural(count, 'conversation')}? ·{' '}
      <button type="button" disabled={locked} onClick={onConfirm} className={`font-semibold text-broken ${link}`}>
        delete all
      </button>{' '}
      ·{' '}
      <button ref={keepRef} type="button" onClick={keep} className={`text-ink-2 ${link}`}>
        keep
      </button>
    </p>
  ) : (
    <p className="px-0.5 pt-2.5 font-mono text-[11.5px] leading-[1.5] text-ink-3">
      {plural(count, 'conversation')} kept ·{' '}
      <button ref={clearRef} type="button" disabled={locked} onClick={() => setConfirming(true)} className={`text-ink-2 ${link}`}>
        clear all
      </button>
    </p>
  )
}

/** Saved conversations, newest first; the index counts up from the oldest like the kit's history list. */
export function HistoryList({ threads, currentId, opening, locked, onOpen, onDelete, onClearAll, now }: HistoryProps) {
  const [mounted] = useState(Date.now)
  const at = now ?? mounted
  return (
    <div>
      <ol
        aria-label="Past conversations"
        className="flex flex-col rounded-lg border border-line bg-surface px-4 py-1 shadow-1"
      >
        {threads.map((t, i) => {
          const current = t.id === currentId
          return (
            <li
              key={t.id}
              className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-start gap-2.5 border-t border-line py-[11px] first:border-t-0"
            >
              <span className="pt-0.5 font-mono text-[12px] leading-[19px] font-semibold text-ink-3">
                {String(threads.length - i).padStart(2, '0')}
              </span>
              <button
                type="button"
                disabled={locked || opening !== null}
                aria-current={current || undefined}
                aria-busy={opening === t.id || undefined}
                onClick={() => onOpen(t.id)}
                className="group flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-left disabled:cursor-not-allowed"
              >
                <b className="min-w-0 text-[13.5px] leading-[19px] font-semibold text-ink [overflow-wrap:anywhere] group-hover:underline group-hover:underline-offset-2 group-disabled:no-underline">
                  {t.title}
                </b>
                <span className="order-last basis-full font-mono text-[11px] leading-[15px] text-ink-3 sm:order-none sm:basis-auto">
                  {plural(t.questions, 'question')}
                </span>
                {current && (
                  <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-[11px] leading-[14px] font-semibold whitespace-nowrap text-ink-2">
                    open
                  </span>
                )}
                <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11.5px] leading-[19px] whitespace-nowrap text-ink-3">
                  {opening === t.id && <Spinner className="size-3" />}
                  {timeAgo(t.updatedAt, at)}
                </span>
              </button>
              <button
                type="button"
                disabled={locked}
                onClick={() => onDelete(t.id)}
                className="grid size-5 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
              >
                <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
                </svg>
                <span className="sr-only">Delete “{t.title}”</span>
              </button>
            </li>
          )
        })}
      </ol>
      <ClearAll count={threads.length} locked={locked} onConfirm={onClearAll} />
    </div>
  )
}
