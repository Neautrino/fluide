import type { Ref } from 'react'
import { Composer } from './Composer'
import { Exchange, type Message } from './Turn'

type Props = {
  earlier: Message[][]
  empty: boolean
  loading: boolean
  inputRef: Ref<HTMLTextAreaElement>
  onSend: (text: string) => void
  onReset: () => void
}

export function Conversation({ earlier, empty, loading, inputRef, onSend, onReset }: Props) {
  return (
    <section aria-label="Conversation" className="flex flex-col rounded-lg border border-line bg-surface shadow-1">
      <div className="flex min-h-[63px] flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-5 py-3.5">
        <h3 className="text-[17px] leading-[19px] tracking-[-0.01em]">Conversation</h3>
        <span className="text-[12px] leading-[15px] text-ink-3">Kept in memory and lost on reload</span>
        {!empty && (
          <button
            type="button"
            onClick={onReset}
            disabled={loading}
            className="ml-auto inline-flex h-[34px] items-center gap-[7px] rounded-full border border-line-strong bg-surface px-[14px] text-[12.5px] font-semibold whitespace-nowrap transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-ink-3"
          >
            <svg viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="size-3.5">
              <path d="M8 3v10M3 8h10" />
            </svg>
            New conversation
          </button>
        )}
      </div>

      {empty && (
        <p className="px-6 py-[34px] text-center text-[13px] text-ink-3">
          New conversation. Ask a question below, or pick one of the prompts above.
        </p>
      )}
      {earlier.length > 0 && (
        <div className="flex flex-col gap-4 px-6 py-5">
          {earlier.map((turn) => (
            <Exchange key={turn[0].at} turn={turn} tone="surface-2" pending={false} />
          ))}
        </div>
      )}

      <div className={`px-5 pb-[18px] ${empty || earlier.length > 0 ? 'mt-1' : 'mt-5'}`}>
        <Composer
          label="Ask a follow-up"
          placeholder="Ask a follow-up about your money…"
          variant="plain"
          busy={loading}
          onSend={onSend}
          inputRef={inputRef}
        />
      </div>
      <p className="px-6 pb-4 text-[11.5px] leading-[15px] text-ink-3">Enter to send · Shift + Enter for a new line</p>
    </section>
  )
}
