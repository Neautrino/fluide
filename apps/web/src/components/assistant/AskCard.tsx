import type { Ref } from 'react'
import { Composer } from './Composer'

const PROMPTS = [
  { question: 'Biggest merchants this month', tag: 'top merchants', tile: 'bg-tile-1', chip: 'text-tile-1' },
  { question: 'Did I earn more than I spent this month?', tag: 'income vs expense', tile: 'bg-tile-2', chip: 'text-tile-2' },
  { question: 'What are my account balances?', tag: 'balances', tile: 'bg-tile-3', chip: 'text-tile-3' },
]

const CAN_LOOK_AT = ['Spending by category', 'Top merchants', 'Income vs expense', 'Account balances', 'Individual transactions']

type Props = {
  loading: boolean
  inputRef: Ref<HTMLTextAreaElement>
  onSend: (text: string) => void
}

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
          <p className="mt-1.5 text-[13.5px] leading-[17px] opacity-70">Answers come from your ledger.</p>
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
          {PROMPTS.map((p) => (
            <button
              key={p.question}
              type="button"
              disabled={loading}
              onClick={() => onSend(p.question)}
              className={`flex w-full items-center gap-3 rounded-sm border border-tile-ink px-3.5 py-3 text-left text-tile-ink hover:brightness-[.97] disabled:cursor-not-allowed disabled:opacity-60 ${p.tile}`}
            >
              <span className="flex-1 text-[13.5px] leading-[1.3] font-semibold">{p.question}</span>
              <span
                className={`rounded-[9px] border border-tile-ink bg-tile-ink px-2 py-0.5 font-mono text-[10.5px] leading-4 font-semibold tracking-[.02em] whitespace-nowrap ${p.chip}`}
              >
                {p.tag}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-1.5 text-[12px] leading-[1.45] opacity-70">
          <p>Figures come from read-only ledger queries.</p>
          <p>Answers can take a little while.</p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4 border-t border-line-strong bg-surface-2 px-6 pt-[22px] pb-[18px] md:border-t-0 md:border-l">
        <div className="flex flex-col gap-3">
          <h3 className="text-[19px] leading-tight text-ink">Answers appear in the conversation below</h3>
          <p className="max-w-prose text-[13.5px] leading-[1.55] text-ink-2">
            Ask in plain words. The assistant can look at these parts of your ledger:
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {CAN_LOOK_AT.map((c) => (
              <li key={c} className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11.5px] text-ink-2">
                {c}
              </li>
            ))}
          </ul>
          <p className="max-w-prose text-[12px] leading-[1.45] text-ink-3">
            Spending, merchants, income and transactions can be limited to this week, this month, the last 30 days, this year or all time.
          </p>
        </div>
      </div>
    </section>
  )
}
