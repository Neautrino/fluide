import type { CashFlow } from '../../lib/api'
import { Segmented } from '../ui/Segmented'
import { risingCategory } from './model'

/** Only questions the assistant's tools can answer: merchants, categories, and income against spending. */
function questionsFor(flow: CashFlow): string[] {
  const riser = risingCategory(flow)
  const questions: string[] = []
  if (flow.merchants.length > 0) questions.push('Biggest merchants this month')
  if (riser) questions.push(`How much did I spend on ${riser.label} this month?`)
  else if (flow.categories.length > 0) questions.push('What did I spend the most on this month?')
  if (flow.totals.moneyIn > 0 || flow.totals.moneyOut > 0) questions.push('How much did I earn vs spend this month?')
  return questions
}

export function PromptChips({
  flow,
  currencies,
  currency,
  onCurrency,
  ask,
}: {
  flow: CashFlow | undefined
  currencies: string[]
  currency: string | null
  onCurrency: (currency: string) => void
  ask: (question: string) => void
}) {
  const questions = flow ? questionsFor(flow) : []
  const switcher = currencies.length > 1 && currency !== null
  if (!switcher && questions.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {switcher && (
        <div className="[&_button:focus-visible]:-outline-offset-2 [&_button[aria-pressed=true]:focus-visible]:outline-surface">
          <Segmented label="Currency" value={currency} options={currencies.map((c) => ({ value: c, label: c }))} onChange={onCurrency} />
        </div>
      )}
      <div className="ml-auto flex flex-wrap justify-end gap-1.5">
        {questions.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => ask(q)}
            className="rounded-full border border-line bg-surface px-[11px] py-[5px] text-[12px] text-ink-2 hover:border-line-strong hover:text-ink max-[1300px]:px-[9px] max-[1300px]:py-1 max-[1300px]:text-[11.5px]"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
