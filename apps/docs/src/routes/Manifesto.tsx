import { LogoMark } from '@repo/ui/brand'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { DISPLAY, pill } from '../site/ds'
import { SectionTag } from '../site/SectionTag'

/* The rules Fluide is built on (r4/manifesto/), copy verbatim, in the DS01 skin of the landing. */

const RULES: { title: string; body: ReactNode; limits?: true }[] = [
  {
    title: 'Read-only, forever.',
    body: (
      <>
        <p>
          Fluide reads your bank accounts and never moves money. It asks Plaid for one product, your transactions, and there is no code
          in it that can pay, transfer or change anything at your bank.
        </p>
        <p>Payments aren't on a roadmap. They are out of scope for good.</p>
      </>
    ),
  },
  {
    title: 'Your computer, not ours.',
    body: (
      <>
        <p>
          There is no Fluide server holding your data. Fluide runs on your own computer, answers only there, and keeps the key that unlocks
          your bank access in its own place beside your ledger.
        </p>
        <p>There is no account with us to make, and none to close.</p>
      </>
    ),
  },
  {
    title: 'Never guess quietly.',
    body: (
      <>
        <p>
          When Fluide isn't sure, it asks. A category suggestion below the line waits for you in Review instead of being filed, and the
          Assistant is told to say when an answer leans on transactions still waiting for review.
        </p>
        <p>We would rather show you a question than a confident mistake.</p>
      </>
    ),
  },
  {
    title: 'A ledger, not a list.',
    body: (
      <>
        <p>
          Every transaction is double-entry: both sides add to zero, and the database refuses anything that doesn't. Money rows can't be
          edited or deleted; a correction is a new entry.
        </p>
        <p>Overview, Cash flow, Review and the Assistant all read the same rows, so they can't disagree.</p>
      </>
    ),
  },
  {
    title: 'Show the work.',
    body: (
      <>
        <p>
          Every category change is written to a log with what made it, a rule, a model or you, and how sure it was. The Assistant can only
          answer through six read-only queries on your ledger.
        </p>
        <p>If Fluide tells you something, you can check it.</p>
      </>
    ),
  },
  {
    title: 'AI is a tool you choose.',
    body: (
      <>
        <p>Bring your own model, or run one on your computer. Without one, your rules do the sorting and nothing is sent to any model.</p>
        <p>A model can only ask your ledger read-only questions. It can't change a row.</p>
      </>
    ),
  },
  {
    title: "Say what isn't there.",
    limits: true,
    body: (
      <>
        <p>
          There is no login yet, so Fluide stays on the computer it runs on. It works with US banks through Plaid, and nothing else yet.
          Your bank access, keys and chats are encrypted; for the rest of the ledger, turn on your computer's disk encryption.
        </p>
        <p>You should know that before you install it, not after.</p>
      </>
    ),
  },
]

export function Manifesto() {
  return (
    <main className="bg-surface">
      <section aria-labelledby="mf-t" className="relative isolate overflow-hidden px-6 pt-[176px] pb-24 text-center max-[560px]:px-5 max-[560px]:pt-[132px] max-[560px]:pb-16">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(38%_60%_at_20%_20%,rgba(206,209,244,.75),transparent_70%),radial-gradient(40%_60%_at_82%_30%,rgba(250,205,184,.6),transparent_70%),linear-gradient(180deg,var(--canvas),var(--surface)_80%)]"
        />
        <SectionTag numbered={false} className="mb-7">
          Manifesto
        </SectionTag>
        <h1 id="mf-t" className={`${DISPLAY} mx-auto max-w-[13em] text-[clamp(40px,5.4vw,84px)] leading-[.98] text-balance text-ink`}>
          Your money, read.{' '}
          <em className="rounded-md bg-tile-3 px-[.14em] pb-[.04em] text-tile-ink not-italic shadow-[inset_0_0_0_1px_var(--line-strong)] [box-decoration-break:clone]">
            Never moved.
          </em>
        </h1>
        <p className="mx-auto mt-7 max-w-[32em] text-[19px] leading-[1.55] text-pretty text-ink-2 max-[560px]:text-[17px]">
          Fluide is built on a few rules we don't bend. They decide what it does and, more often, what it refuses to do.
        </p>
      </section>

      <ol className="mx-auto max-w-[1080px] px-6 pt-6 pb-10">
        {RULES.map((rule, i) => (
          <li
            key={rule.title}
            className={`grid grid-cols-[72px_minmax(0,1fr)_minmax(0,1.25fr)] items-start gap-8 max-[900px]:grid-cols-1 max-[900px]:gap-3 ${
              rule.limits
                ? 'mt-2 rounded-xl border border-line-strong bg-warning-wash px-8 py-10 max-[900px]:px-[22px] max-[900px]:py-7'
                : 'border-t border-line py-12 max-[900px]:py-9'
            }`}
          >
            <span
              className={`font-mono text-[13px] leading-[44px] font-medium tracking-[0.04em] max-[900px]:leading-[1.4] ${rule.limits ? 'text-warning' : 'text-ink-3'}`}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <h2 className={`${DISPLAY} text-[clamp(26px,2.6vw,36px)] leading-[1.05] tracking-[-0.03em] text-ink`}>{rule.title}</h2>
            <div className="text-lg leading-[1.6] text-pretty text-ink-2 max-[560px]:text-[16.5px] [&>p+p]:mt-3.5">{rule.body}</div>
          </li>
        ))}
      </ol>

      <section
        aria-labelledby="mf-end-t"
        className="mx-auto flex max-w-[1080px] flex-col items-center border-t border-line px-6 pt-12 pb-[140px] text-center"
      >
        <LogoMark className="size-14 text-ink" />
        <h2 id="mf-end-t" className={`${DISPLAY} mt-6 text-[clamp(30px,3.3vw,50px)] leading-none text-ink`}>
          That's the whole deal.
        </h2>
        <div className="mt-[30px] flex items-center gap-[26px] max-[560px]:flex-col max-[560px]:gap-4">
          <Link to="/docs" hash="install" className={pill('solid', 'lg')}>
            Self-host it
          </Link>
          <Link to="/docs" className={pill('outline', 'lg')}>
            Read the docs
          </Link>
        </div>
      </section>
    </main>
  )
}
