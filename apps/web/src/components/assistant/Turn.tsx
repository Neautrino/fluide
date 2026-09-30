import type { ReactNode } from 'react'
import { Notice } from '../ui/States'
import { Spark } from './Spark'

export type Message = { role: 'user' | 'assistant'; content: string; at: number; failed?: boolean }

const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

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
        <p className="text-[14.5px] leading-[1.55] whitespace-pre-wrap text-ink">{message.content}</p>
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
