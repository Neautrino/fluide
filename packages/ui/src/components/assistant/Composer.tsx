import { useState, type Ref } from 'react'
import { Spinner } from '../ui/Button'
import { Spark } from './Spark'

type Props = {
  label: string
  placeholder: string
  variant: 'inverse' | 'plain'
  busy: boolean
  onSend: (text: string) => void
  inputRef: Ref<HTMLTextAreaElement>
}

const SHELL = {
  inverse: 'border-ink-inverse/45 pl-4 text-ink-inverse',
  plain: 'border-line bg-surface pl-[18px] text-ink focus-within:border-line-strong',
}

const FIELD = {
  inverse: 'text-[15px] placeholder:text-ink-inverse/55',
  plain: 'text-[14px] placeholder:text-ink-3',
}

const SUBMIT = {
  inverse: 'bg-ink-inverse text-surface-inverse',
  plain: 'bg-surface-inverse text-ink-inverse',
}

export function Composer({ label, placeholder, variant, busy, onSend, inputRef }: Props) {
  const [text, setText] = useState('')

  const submit = () => {
    if (!text.trim() || busy) return
    onSend(text)
    setText('')
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className={`flex min-h-[50px] items-center gap-2.5 rounded-[25px] border pr-1.5 ${SHELL[variant]}`}
    >
      <Spark className={`size-[17px] flex-none ${variant === 'inverse' ? 'text-ink-inverse' : 'text-ink-2'}`} />
      <textarea
        ref={inputRef}
        rows={1}
        value={text}
        aria-label={label}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            submit()
          }
        }}
        className={`field-sizing-content max-h-32 min-w-0 flex-1 resize-none bg-transparent py-3 leading-6 outline-none ${FIELD[variant]}`}
      />
      {variant === 'plain' && (
        <kbd className="hidden rounded-md border border-line px-1.5 py-[3px] font-mono text-[10.5px] font-semibold text-ink-3 sm:block">Enter</kbd>
      )}
      <button
        type="submit"
        disabled={!text.trim() || busy}
        aria-busy={busy || undefined}
        className={`inline-flex h-[38px] flex-none items-center gap-2 rounded-full px-[18px] text-[12.5px] font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 ${SUBMIT[variant]}`}
      >
        {busy && <Spinner />}
        {busy ? 'Asking…' : 'Ask'}
      </button>
    </form>
  )
}
