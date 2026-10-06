import type { Ref } from 'react'
import { Composer } from './Composer'
import { SampleAnswer } from './SampleAnswer'

const TILES = [
  { question: 'Why is Shopping up 38% this month?', tag: 'example →', tile: 'bg-tile-1' },
  { question: 'Show the 4 items waiting for review', tag: 'from review queue', tile: 'bg-tile-2' },
  { question: 'Biggest merchants this month', tag: 'from ledger', tile: 'bg-tile-3' },
]

type Props = {
  loading: boolean
  inputRef: Ref<HTMLTextAreaElement>
  onSend: (text: string) => void
}

/** The right pane always shows the sample answer; real answers go to the Conversation panel. */
export function AskCard({ loading, inputRef, onSend }: Props) {
  return (
    <section
      aria-label="Ask about your money"
      className="grid overflow-hidden rounded-lg border border-line shadow-1 md:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]"
    >
      <div className="flex min-w-0 flex-col gap-[18px] bg-surface-inverse px-6 pt-[26px] pb-5 text-ink-inverse">
        <div>
          <h2 className="text-[32px] leading-[1.02] font-extrabold tracking-[-0.03em] min-[1360px]:text-[38px]">
            Ask about
            <br />
            your money
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-[17px] opacity-[.68]">Answers come from your ledger.</p>
        </div>
        <Composer
          label="Ask about your money"
          placeholder="Ask about your money…"
          variant="inverse"
          busy={loading}
          onSend={onSend}
          inputRef={inputRef}
        />
        <div className="flex flex-col gap-2.5">
          {TILES.map((t, i) => (
            <button
              key={t.question}
              type="button"
              disabled={loading}
              onClick={() => onSend(t.question)}
              className={`flex w-full items-center gap-3 rounded-sm border border-tile-ink px-3.5 py-3 text-left text-tile-ink hover:brightness-[.97] disabled:cursor-not-allowed disabled:opacity-60 ${t.tile} ${
                i === 0 ? 'shadow-[0_0_0_2px_var(--ink-inverse)]' : ''
              }`}
            >
              <span className="flex-1 text-[13.5px] leading-[1.3] font-semibold">{t.question}</span>
              <span
                className={`rounded-[9px] border px-2 py-0.5 font-mono text-[10.5px] leading-4 font-semibold tracking-[.02em] whitespace-nowrap ${
                  i === 0 ? 'border-tile-ink bg-tile-ink text-tile-1' : 'border-tile-ink/45'
                }`}
              >
                {t.tag}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-auto flex gap-2 text-[12px] leading-[1.45] opacity-70">
          <span
            aria-hidden
            className="mt-0.5 size-3 flex-none rounded-[3px] border border-ink-inverse bg-[repeating-linear-gradient(135deg,transparent_0_2px,var(--ink-inverse)_2px_3px)]"
          />
          Figures still waiting for review are called out in every answer.
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-4 border-t border-line bg-surface-2 px-6 pt-[22px] pb-[18px] md:border-t-0 md:border-l">
        <SampleAnswer />
      </div>
    </section>
  )
}
