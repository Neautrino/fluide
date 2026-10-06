import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { AppWindowDemo, type View } from '../app-preview/AppWindowDemo'
import { SectionTag } from '../site/SectionTag'
import { DISPLAY } from '../site/ds'
import { Reveal, useRevealScope } from '../motion/reveal'
import './Views.css'

const TABS: { view: View; title: string; text: string }[] = [
  { view: 'overview', title: 'Overview', text: 'Cash on hand, what you own and owe, spend by month and where it went, on one page.' },
  {
    view: 'transactions',
    title: 'Transactions',
    text: "Every account in one list, grouped by day and searchable, with each row's category and where it came from.",
  },
  { view: 'accounts', title: 'Accounts', text: 'What you have and owe, account by account, as each bank last reported it.' },
  { view: 'cashflow', title: 'Cash flow', text: 'Money in and out this month against your typical month, by category and by merchant.' },
  {
    view: 'review',
    title: 'Review',
    text: "The transactions Fluide wasn't sure about, with its suggestion and its reason. Approve one and a rule is saved.",
  },
  { view: 'assistant', title: 'Assistant', text: 'Ask in plain words. Answers come from read-only queries on your ledger.' },
]

const SWAP_MS = 180

/** One app window cycling through the views: the active tab's progress line runs for --pd-dur, then the
    next view shows. Paused while under 30% on screen, while the pointer is on the window and while keyboard
    focus is in the tab list. Reduced motion hides the line, so nothing advances on its own. */
export function Views() {
  const reveal = useRevealScope<HTMLElement>()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const swapTimer = useRef(0)
  const [current, setCurrent] = useState(0)
  /* bumps on every selection so the active progress line restarts, even on the same tab */
  const [run, setRun] = useState(0)
  const [shown, setShown] = useState<View>('overview')
  const [swapping, setSwapping] = useState(false)
  const [visible, setVisible] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [focused, setFocused] = useState(false)

  const select = (i: number, focus = false) => {
    const next = (i + TABS.length) % TABS.length
    setCurrent(next)
    setRun((r) => r + 1)
    if (focus) tabRefs.current[next]?.focus()
    window.clearTimeout(swapTimer.current)
    setSwapping(true)
    swapTimer.current = window.setTimeout(() => {
      setShown(TABS[next].view)
      setSwapping(false)
    }, SWAP_MS)
  }

  useEffect(() => () => window.clearTimeout(swapTimer.current), [])

  useEffect(() => {
    const root = reveal.ref.current
    if (!root) return
    const io = new IntersectionObserver((entries) => setVisible(entries[0].isIntersecting), { threshold: 0.3 })
    io.observe(root)
    return () => io.disconnect()
  }, [reveal.ref])

  const onKey = (e: KeyboardEvent) => {
    const k = e.key
    if (k === 'ArrowDown' || k === 'ArrowRight') select(current + 1, true)
    else if (k === 'ArrowUp' || k === 'ArrowLeft') select(current - 1, true)
    else if (k === 'Home') select(0, true)
    else if (k === 'End') select(TABS.length - 1, true)
    else return
    e.preventDefault()
  }

  const paused = !visible || hovering || focused

  return (
    <section
      {...reveal}
      id="views"
      aria-labelledby="pd-title"
      data-paused={paused ? '' : undefined}
      className="relative z-1 bg-canvas px-6 pt-10 pb-[140px] text-ink max-[1000px]:px-0 max-[1000px]:pt-6 max-[1000px]:pb-24"
    >
      <div className="mx-auto max-w-[1180px]">
        <Reveal kind="link">
          <SectionTag className="max-[1000px]:mx-5">Product</SectionTag>
        </Reveal>
        <Reveal kind="words">
          <h2 id="pd-title" className={`${DISPLAY} mt-[26px] text-[clamp(30px,3.3vw,50px)] leading-none text-ink max-[1000px]:mx-5`}>
            Every view reads the same ledger.
          </h2>
        </Reveal>
        <Reveal kind="line">
          <p className="mt-4 max-w-[34em] text-[18px] leading-normal text-ink-2 max-[1000px]:mx-5">
            Overview, Transactions, Accounts, Cash flow, Review and Assistant all read the same rows in your own ledger.
          </p>
        </Reveal>
        <Reveal kind="block">
          <div className="mt-16 grid grid-cols-[290px_minmax(0,1fr)] items-start gap-12 max-[1000px]:mt-10 max-[1000px]:grid-cols-[minmax(0,1fr)] max-[1000px]:gap-6">
            <div
              role="tablist"
              aria-label="App views"
              aria-orientation="vertical"
              onFocus={(e) => {
                /* keyboard focus only: a clicked tab keeps cycling */
                if (e.target.matches(':focus-visible')) setFocused(true)
              }}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false)
              }}
              className="pd-tabs flex flex-col max-[1000px]:flex-row max-[1000px]:gap-[22px] max-[1000px]:overflow-x-auto max-[1000px]:border-b max-[1000px]:border-line max-[1000px]:px-5"
            >
              {TABS.map((t, i) => (
                <button
                  key={t.view}
                  ref={(el) => {
                    tabRefs.current[i] = el
                  }}
                  role="tab"
                  type="button"
                  id={`pd-t-${t.view}`}
                  aria-controls="pd-panel"
                  aria-selected={i === current}
                  tabIndex={i === current ? 0 : -1}
                  onClick={() => select(i)}
                  onKeyDown={onKey}
                  className="pd-tab"
                >
                  <b>{t.title}</b>
                  <span className="pd-d">{t.text}</span>
                  <i className="pd-bar">
                    <i key={i === current ? run : undefined} onAnimationEnd={i === current ? () => select(current + 1) : undefined} />
                  </i>
                </button>
              ))}
              <p className="border-t border-line pt-4 text-[13px] leading-normal text-ink-3 max-[1000px]:hidden">
                Rules and Settings are in the app too: eight views, one ledger.
              </p>
            </div>
            <div
              id="pd-panel"
              role="tabpanel"
              aria-labelledby={`pd-t-${TABS[current].view}`}
              data-swap={swapping ? '' : undefined}
              onPointerEnter={() => setHovering(true)}
              onPointerLeave={() => setHovering(false)}
              className="pd-win min-w-0 max-[1000px]:px-3"
            >
              <AppWindowDemo
                view={shown}
                narrow
                label={`The ${TABS.find((t) => t.view === shown)?.title} view of the Fluide app, with sample data`}
                className="[filter:drop-shadow(0_18px_28px_rgba(11,11,12,.1))]"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
