import { Fragment, type ReactNode } from 'react'
import { Notice } from '../ui/States'
import { Spark } from './Spark'

export type Message = { role: 'user' | 'assistant'; content: string; at: number; failed?: boolean }

const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

type Block = { kind: 'p'; lines: string[] } | { kind: 'ul' | 'ol'; items: string[]; start: number }

const BULLET = /^[-*] +(.*)$/
const NUMBERED = /^(\d+)\. +(.*)$/

/** Paragraphs split on blank lines; runs of `- `/`* ` or `1. ` lines inside them become lists. */
function blocksOf(text: string): Block[] {
  const blocks: Block[] = []
  for (const chunk of text.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/)) {
    let last: Block | undefined
    for (const raw of chunk.split('\n')) {
      const line = raw.trim()
      if (!line) continue
      const bullet = BULLET.exec(line)
      const numbered = bullet ? null : NUMBERED.exec(line)
      const item = bullet?.[1] ?? numbered?.[2]
      const kind = bullet ? 'ul' : numbered ? 'ol' : 'p'
      if (last?.kind !== kind) {
        last = kind === 'p' ? { kind, lines: [] } : { kind, items: [], start: numbered ? Number(numbered[1]) : 1 }
        blocks.push(last)
      }
      if (last.kind === 'p') last.lines.push(line)
      else if (item !== undefined) last.items.push(item)
    }
  }
  return blocks
}

/** `**bold**` only; an unclosed `**` stays literal. Plain strings, so bank text can't become markup. */
function inline(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/).map((part, i) =>
    i % 2 ? (
      <strong key={i} className="font-semibold text-ink">
        {part}
      </strong>
    ) : (
      part
    ),
  )
}

function AnswerText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 text-[14.5px] leading-[1.55] text-ink">
      {blocksOf(text).map((b, i) =>
        b.kind === 'p' ? (
          <p key={i}>
            {b.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(line)}
              </Fragment>
            ))}
          </p>
        ) : b.kind === 'ul' ? (
          <ul key={i} className="flex list-disc flex-col gap-0.5 pl-5">
            {b.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </ul>
        ) : (
          <ol key={i} start={b.start} className="flex list-decimal flex-col gap-0.5 pl-5">
            {b.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </ol>
        ),
      )}
    </div>
  )
}

function Question({ message, tone }: { message: Message; tone: 'surface' | 'surface-2' }) {
  return (
    <div
      className={`max-w-[80%] self-end rounded-[16px_16px_4px_16px] border border-line px-[15px] py-2.5 text-[13.5px] leading-[17px] font-semibold whitespace-pre-wrap text-ink ${
        tone === 'surface' ? 'bg-surface' : 'bg-surface-2'
      }`}
    >
      {message.content}
      <small className="mt-0.5 block text-right text-[10.5px] leading-[13px] font-medium text-ink-3">you · {clock.format(message.at)}</small>
    </div>
  )
}

function AnswerShell({ failed, children }: { failed?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`grid size-[30px] flex-none place-items-center rounded-full border bg-surface ${
          failed ? 'border-broken text-broken' : 'border-line-strong text-ink'
        }`}
      >
        <Spark className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function Answer({ message }: { message: Message }) {
  return (
    <AnswerShell failed={message.failed}>
      {message.failed ? (
        <Notice tone="error">{message.content}</Notice>
      ) : (
        <AnswerText text={message.content} />
      )}
    </AnswerShell>
  )
}

function Thinking() {
  return (
    <AnswerShell>
      <p className="text-[14.5px] leading-[1.55] text-ink-3 italic">
        Reading the ledger<span className="animate-pulse">…</span>
      </p>
    </AnswerShell>
  )
}

/** A question with its answer, or a pending marker while the answer is still on its way. */
export function Exchange({ turn, tone, pending }: { turn: Message[]; tone: 'surface' | 'surface-2'; pending: boolean }) {
  const [question, answer] = turn
  return (
    <div className="flex flex-col gap-4">
      <Question message={question} tone={tone} />
      {answer ? <Answer message={answer} /> : pending && <Thinking />}
    </div>
  )
}
