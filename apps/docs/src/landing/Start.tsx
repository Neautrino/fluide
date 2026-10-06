import { useEffect, useRef, useState } from 'react'
import { Reveal, useRevealScope } from '../motion/reveal'
import { HashLink } from '../site/HashLink'
import { DISPLAY, GITHUB, pill } from '../site/ds'
import './Start.css'

/** What the terminal shows (the README's commands). */
const TYPED = `$ git clone \\
  https://github.com/Neautrino/fluide.git
$ cd fluide && docker compose up -d --build
# then open http://localhost:8080`

/** What Copy puts on the clipboard: the three install commands, not the last 'open' line. */
const COPY = 'git clone https://github.com/Neautrino/fluide.git\ncd fluide\ndocker compose up -d --build'

/** Text beside a line-drawn terminal standing on a baseline, over the hero's light. */
export function Start() {
  const reveal = useRevealScope<HTMLElement>()
  return (
    <section
      {...reveal}
      id="start"
      aria-labelledby="start-t"
      className="ga-lit relative isolate overflow-hidden border-t border-line px-6 py-28 text-ink max-[560px]:px-5 max-[560px]:py-20"
    >
      <div className="mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-16 max-[1000px]:grid-cols-[minmax(0,1fr)] max-[1000px]:gap-10">
        <div>
          <Reveal kind="words">
            <h2
              id="start-t"
              className={`${DISPLAY} max-w-[8.5em] text-[clamp(36px,4.2vw,64px)] leading-[0.98] text-ink`}
            >
              Clone it and connect one bank.
            </h2>
          </Reveal>
          <Reveal kind="line">
            <p className="mt-[18px] max-w-[30em] text-[17px] leading-[1.55] text-ink-2">
              <code className={CODE}>git clone</code> the repo, <code className={CODE}>docker compose up</code>, then
              add your Plaid keys in Settings.
            </p>
          </Reveal>
          <Reveal kind="link">
            <div className="mt-6 flex flex-wrap gap-3">
              <HashLink to="/docs" hash="install" className={`${pill('solid', 'lg')} ${FOCUS}`}>
                Read the install guide
              </HashLink>
              <a className={`${pill('outline', 'lg')} ${FOCUS}`} href={GITHUB}>
                Source on GitHub
              </a>
            </div>
          </Reveal>
          <Reveal kind="link">
            <p className="mt-[18px] font-mono text-[11.5px] leading-[normal] font-medium tracking-[0.08em] text-ink-3 uppercase">
              Docker Engine 28.3.3+ · your own Plaid keys
            </p>
          </Reveal>
        </div>
        <Reveal kind="block">
          <div className="relative px-7 max-[560px]:px-3.5">
            <div className="relative z-[1] border-[1.5px] border-b-0 border-line-strong bg-surface">
              <div className="grid h-10 grid-cols-[1fr_auto_1fr] items-center border-b-[1.5px] border-line-strong pr-2 pl-3">
                <span className="flex gap-[5px]" aria-hidden="true">
                  <i className="size-2.5 border border-ink-3" />
                  <i className="size-2.5 border border-ink-3" />
                  <i className="size-2.5 border border-ink-3" />
                </span>
                <span className="font-mono text-[13px] font-medium text-ink-3">fluide</span>
                <StartCopy />
              </div>
              <StartTerminal />
            </div>
            <div className="ga-ground relative mx-[-14px] h-0 border-t-[1.5px] border-line-strong" />
          </div>
        </Reveal>
      </div>
    </section>
  )
}

const CODE = 'font-mono text-[0.9em] leading-[normal] font-medium text-ink'
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** Copy button in the title bar: copies the install commands, says 'Copied' for 1.5s. */
function StartCopy() {
  const [ok, setOk] = useState(false)
  const timer = useRef<number>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = () => {
    if (!navigator.clipboard) return
    navigator.clipboard.writeText(COPY).then(
      () => {
        setOk(true)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setOk(false), 1500)
      },
      () => {},
    )
  }
  return (
    <button
      type="button"
      aria-label="Copy install commands"
      onClick={copy}
      className={`h-[26px] cursor-pointer justify-self-end rounded-sm border px-2.5 font-sans text-[11.5px] font-bold ${FOCUS} ${
        ok ? 'border-positive bg-positive-wash text-positive' : 'border-line-strong bg-surface text-ink'
      }`}
    >
      {ok ? 'Copied' : 'Copy'}
    </button>
  )
}

/**
 * The terminal body. The prerendered HTML carries the full commands (crawlers, no JS, screen readers);
 * when entrances run (html.rv-on) CSS hides them visually and shows the typed copy plus a caret instead,
 * which types 26ms a character, 320ms after a line break, once half the terminal is in view.
 */
function StartTerminal() {
  const ref = useRef<HTMLPreElement>(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    const pre = ref.current
    if (!pre || !document.documentElement.classList.contains('rv-on')) return
    let timer = 0
    const io = new IntersectionObserver(
      (es) => {
        if (!es[0].isIntersecting) return
        io.disconnect()
        let i = 0
        const tick = () => {
          i++
          setN(i)
          if (i < TYPED.length) timer = window.setTimeout(tick, TYPED[i - 1] === '\n' ? 320 : 26)
        }
        tick()
      },
      { threshold: 0.5 },
    )
    io.observe(pre)
    return () => {
      io.disconnect()
      window.clearTimeout(timer)
    }
  }, [])
  return (
    <pre
      ref={ref}
      className="m-0 min-h-[176px] px-5 pt-5 pb-6 font-mono text-sm leading-[1.9] font-medium whitespace-pre-wrap text-ink max-[560px]:text-xs"
    >
      <span className="ga-full">{TYPED}</span>
      <span className="ga-typed" aria-hidden="true">
        {TYPED.slice(0, n)}
      </span>
      <span className="ga-caret" aria-hidden="true" />
    </pre>
  )
}
