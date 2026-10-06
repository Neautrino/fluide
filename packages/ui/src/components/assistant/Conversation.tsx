import type { Ref } from 'react'
import { plural } from '../overview/model'
import { Notice } from '../ui/States'
import { Composer } from './Composer'
import { HistoryList, type HistoryProps } from './HistoryList'
import { Exchange, type Message } from './Turn'

type Props = {
  turns: Message[][]
  loading: boolean
  /** Saved conversations; null until the first load finishes. */
  threads: HistoryProps['threads'] | null
  historyOpen: boolean
  history: Omit<HistoryProps, 'threads'>
  error: string | null
  panelRef: Ref<HTMLElement>
  latestRef: Ref<HTMLDivElement>
  inputRef: Ref<HTMLTextAreaElement>
  onToggleHistory: () => void
  onSend: (text: string) => void
  onReset: () => void
}

const STRIP =
  "flex min-w-0 items-center gap-2.5 font-mono text-[11.5px] leading-[15px] font-medium whitespace-nowrap text-ink-3 after:min-w-5 after:flex-1 after:border-t after:border-line after:content-['']"

export function Conversation({
  turns,
  loading,
  threads,
  historyOpen,
  history,
  error,
  panelRef,
  latestRef,
  inputRef,
  onToggleHistory,
  onSend,
  onReset,
}: Props) {
  const saved = threads?.length ?? 0
  const showList = historyOpen && saved > 0
  return (
    <section ref={panelRef} aria-label="Conversation" className="flex scroll-mt-20 flex-col rounded-lg border border-line bg-surface shadow-1">
      <div className="flex min-h-[63px] flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3.5 py-3 sm:px-5 sm:py-3.5">
        <h3 className="text-[17px] leading-[19px] tracking-[-0.01em]">Conversation</h3>
        <span className="text-[12px] leading-[15px] text-ink-3">Kept 30 days, encrypted on this server</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-label="History"
            title="History"
            aria-pressed={historyOpen}
            onClick={onToggleHistory}
            className="relative grid size-[34px] place-items-center rounded-full border border-line-strong bg-surface text-ink transition-colors hover:bg-surface-2 aria-pressed:bg-surface-2"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.6 8.6A5.5 5.5 0 1 0 4.2 4.1" />
              <path d="M2.3 2.2v2.9h2.9" />
              <path d="M8 5.2V8l2 1.4" />
            </svg>
            {saved > 0 && (
              <span className="absolute -top-1.5 -right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-[9px] border-2 border-surface bg-surface-inverse px-[5px] text-[10px] leading-none font-bold text-ink-inverse tabular-nums">
                {saved}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={loading}
            className="inline-flex h-[34px] items-center gap-[7px] rounded-full border border-line-strong bg-surface px-[14px] text-[12.5px] font-semibold whitespace-nowrap transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-ink-3"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M8 3v10M3 8h10" />
            </svg>
            New conversation
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3.5 pt-4 sm:px-6">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {showList && threads && (
        <div className="px-3.5 pt-4 pb-1 sm:px-6 sm:pt-5">
          <HistoryList threads={threads} {...history} />
        </div>
      )}

      {turns.length > 0 ? (
        <div className="flex flex-col gap-4 px-3.5 py-4 sm:px-6 sm:py-5">
          <p className={STRIP}>
            This conversation · {plural(turns.length, 'question')}
          </p>
          {turns.map((turn, i) => {
            const latest = i === turns.length - 1
            return (
              <div key={i} ref={latest ? latestRef : undefined} className="scroll-mt-20">
                <Exchange turn={turn} tone="surface-2" pending={latest && loading} />
              </div>
            )
          })}
        </div>
      ) : (
        !showList && (
          <p className="px-6 py-[34px] text-center text-[13px] text-ink-3">
            {threads === null
              ? 'Loading past conversations…'
              : 'New conversation. Ask a question below, or pick one of the prompts above.'}
          </p>
        )
      )}

      <div className={`px-3 pb-3.5 sm:px-5 sm:pb-[18px] ${turns.length > 0 || !showList ? 'mt-1' : 'mt-5'}`}>
        <Composer
          label="Ask a follow-up"
          placeholder="Ask a follow-up about your money…"
          variant="plain"
          busy={loading}
          onSend={onSend}
          inputRef={inputRef}
        />
      </div>
      <p className="px-3.5 pb-4 text-[11.5px] leading-[15px] text-ink-3 sm:px-6">Enter to send · Shift + Enter for a new line</p>
    </section>
  )
}
