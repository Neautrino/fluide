import { useEffect, useRef, type CSSProperties } from 'react'
import { AppWindowDemo } from '../app-preview/AppWindowDemo'
import { SectionTag } from '../site/SectionTag'
import { DISPLAY } from '../site/ds'
import { gsap, useGSAP } from '../motion/gsap'
import { Reveal, useRevealScope } from '../motion/reveal'
import './Ask.css'

/* r4 Ask (r4/ask/ask.js + ask.css + ds.css): the app's Assistant page with six questions around it,
   each answered by one of the Assistant's six read-only queries, every period one the queries accept.
   The label is the plain name of that query, never its code name.
   Wide screens: three questions in each side margin, touching the window's frame only; each floats
   gently on its own rhythm (paused off-screen, still under reduced motion). The questions and the whole
   app window can be dragged anywhere and stay where they are dropped (a reload puts everything back).
   Narrow screens: the questions as a grid above the window. */

const WIDE = '(min-width: 1100.02px)'
/* r4 sized its app (`.ak-win .app { height: 700px }`) to show the whole sample answer, query line
   included. The real Assistant page at the 1280px design width ends at 721px; 768 leaves it clear of
   the 40px bottom fade, and keeps the window as tall on the page as r4's (≈540px at 1440). */
const APP_HEIGHT = 768

/* [query, question, wide-layout position] */
const QUESTIONS: [string, string, string][] = [
  ['spending by category', 'What did I spend the most on this month?', 'min-[1100.02px]:left-0 min-[1100.02px]:top-[9%]'],
  ['one category', 'How much did I spend on groceries this month?', 'min-[1100.02px]:left-[10px] min-[1100.02px]:top-[38%]'],
  ['money in and out', 'Did I earn more than I spent in September?', 'min-[1100.02px]:left-0 min-[1100.02px]:top-[67%]'],
  ['top merchants', 'Who did I pay the most this month?', 'min-[1100.02px]:right-0 min-[1100.02px]:top-[16%]'],
  ['account balances', 'What are my account balances?', 'min-[1100.02px]:right-[10px] min-[1100.02px]:top-[45%]'],
  ['recent transactions', 'Show me my two latest Whole Foods charges.', 'min-[1100.02px]:right-0 min-[1100.02px]:top-[74%]'],
]

type Lift = { grow: number; tilt: number }
type Hooks = { start?: () => void; end?: () => void }

/* One drag behaviour for the questions and the whole app window: follow the pointer, lean into the
   motion, stay where dropped. `lift` is the element that tilts and grows; `o` sets how far (the big
   window leans and grows much less than a small question). Returns the cleanup. */
function draggable(el: HTMLElement, lift: HTMLElement, o: Lift, reduced: boolean, hooks: Hooks) {
  let drag: { id: number; x0: number; y0: number; bx: number; by: number; lx: number; lt: number } | null = null
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return
    drag = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      bx: Number(gsap.getProperty(el, 'x')),
      by: Number(gsap.getProperty(el, 'y')),
      lx: e.clientX,
      lt: performance.now(),
    }
    el.setPointerCapture(e.pointerId)
    el.setAttribute('data-held', '')
    hooks.start?.()
    gsap.to(lift, { scale: o.grow, duration: 0.2, overwrite: 'auto' })
    e.preventDefault()
  }
  const move = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    const now = performance.now()
    const vx = (e.clientX - drag.lx) / Math.max(1, now - drag.lt)
    drag.lx = e.clientX
    drag.lt = now
    gsap.set(el, { x: drag.bx + e.clientX - drag.x0, y: drag.by + e.clientY - drag.y0 })
    if (!reduced)
      gsap.to(lift, { rotation: Math.max(-o.tilt, Math.min(o.tilt, vx * o.tilt * 0.75)), duration: 0.25, overwrite: 'auto' })
  }
  const up = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    drag = null
    el.removeAttribute('data-held')
    gsap.to(lift, { scale: 1, rotation: 0, duration: 0.35, ease: 'power2.out', overwrite: 'auto', onComplete: hooks.end })
  }
  el.addEventListener('pointerdown', down)
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
  return () => {
    el.removeEventListener('pointerdown', down)
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
    el.removeAttribute('data-held')
  }
}

export function Ask() {
  const reveal = useRevealScope<HTMLElement>()
  const stage = useRef<HTMLDivElement>(null)
  const win = useRef<HTMLDivElement>(null)

  /* the questions arrive once, when the stage comes into view */
  useEffect(() => {
    const el = stage.current
    const sec = reveal.ref.current
    if (!el || !sec) return
    const io = new IntersectionObserver(
      (entries, obs) => {
        if (!entries[0].isIntersecting) return
        sec.setAttribute('data-ak-in', '')
        obs.disconnect()
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reveal.ref])

  /* float + drag, wide screens only (the questions sit in the margins there) */
  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(WIDE, () => {
        const st = stage.current
        const host = win.current
        if (!st || !host) return
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
        const chips = Array.from(st.querySelectorAll<HTMLElement>('.ak-chip'))
        const cards = chips.map((li) => li.querySelector<HTMLElement>('.ak-card')!)

        /* each card drifts a few pixels on its own period, so the six never move in step */
        const floats = reduced
          ? []
          : cards.map((c, i) =>
              gsap.to(c, {
                y: i % 2 ? 7 : -7,
                x: i % 3 === 0 ? 4 : -3,
                rotation: i % 2 ? 0.6 : -0.6,
                duration: 3.2 + i * 0.45,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
                delay: i * 0.3,
              }),
            )
        const io = new IntersectionObserver((entries) => {
          for (const t of floats) {
            if (entries[0].isIntersecting) t.resume()
            else t.pause()
          }
        })
        io.observe(st)

        const offs = chips.map((li, i) =>
          draggable(li, cards[i], { grow: 1.04, tilt: 8 }, reduced, {
            start: () => floats[i]?.pause(),
            end: () => floats[i]?.resume(),
          }),
        )
        /* the whole app window, as one piece. Only while held does it come in front of the questions;
           once dropped it goes back behind them, so a question resting on it is never hidden. */
        offs.push(
          draggable(host, host, { grow: 1.015, tilt: 2 }, reduced, {
            start: () => (host.style.zIndex = '3'),
            end: () => (host.style.zIndex = ''),
          }),
        )

        return () => {
          io.disconnect()
          for (const t of floats) t.kill()
          for (const off of offs) off()
          gsap.set([...chips, ...cards, host], { clearProps: 'transform' })
          host.style.zIndex = ''
        }
      })
    },
    { scope: stage },
  )

  return (
    <section
      {...reveal}
      id="ask"
      aria-labelledby="ak-t"
      className="px-6 pt-28 pb-[140px] text-[#16181d] max-[1100.02px]:px-0 max-[1100.02px]:pt-20 max-[1100.02px]:pb-24"
    >
      <div className="mx-auto max-w-[1180px]">
        <Reveal kind="link">
          <SectionTag className="max-[1100.02px]:mx-5">Assistant</SectionTag>
        </Reveal>
        <Reveal kind="words">
          <h2
            id="ak-t"
            className={`${DISPLAY} mt-6 text-[clamp(30px,3.3vw,50px)] leading-none text-ink max-[1100.02px]:mx-5`}
          >
            Six questions, six real queries.
          </h2>
        </Reveal>
        <Reveal kind="line">
          <p className="mt-4 max-w-[34em] text-[18px] leading-[1.5] text-ink-2 max-[1100.02px]:mx-5">
            The model picks a query. The ledger does the maths. Pick a local model and your question never leaves your
            machine.
          </p>
        </Reveal>
        <Reveal kind="line">
          <p
            className="mt-3.5 hidden items-center gap-2 font-mono text-[12px] leading-[normal] font-medium tracking-[.04em] text-ink-3 min-[1100.02px]:inline-flex"
            aria-hidden="true"
          >
            ↔ drag the questions and the app anywhere
          </p>
        </Reveal>
        <div
          ref={stage}
          className="relative mt-14 max-[1100.02px]:mt-9 min-[1100.02px]:ml-[50%] min-[1100.02px]:w-[min(1320px,100vw_-_48px)] min-[1100.02px]:-translate-x-1/2 min-[1100.02px]:px-[238px]"
        >
          <ul
            aria-label="Example questions"
            className="relative z-2 list-none max-[1100.02px]:mb-6 max-[1100.02px]:grid max-[1100.02px]:grid-cols-2 max-[1100.02px]:gap-2.5 max-[1100.02px]:px-5 max-[560px]:grid-cols-1 min-[1100.02px]:pointer-events-none min-[1100.02px]:absolute min-[1100.02px]:inset-0"
          >
            {QUESTIONS.map(([query, question, at], i) => (
              <li
                key={query}
                style={{ '--i': i } as CSSProperties}
                className={`ak-chip block min-[1100.02px]:pointer-events-auto min-[1100.02px]:absolute min-[1100.02px]:w-[244px] min-[1100.02px]:cursor-grab min-[1100.02px]:touch-none min-[1100.02px]:select-none min-[1100.02px]:data-held:cursor-grabbing ${at}`}
              >
                <span className="ak-card block rounded-lg border border-line bg-surface px-3.5 pt-2.5 pb-3 text-ink shadow-[0_12px_24px_-18px_rgba(11,11,12,.3)] transition-[box-shadow,border-color] duration-250 ease-[ease]">
                  <span className="flex items-center gap-[7px] font-mono text-[11px] leading-[normal] font-medium tracking-[.02em] text-ink-3">
                    <i className="size-[7px] flex-none rounded-[1px] bg-accent" />
                    {query}
                  </span>
                  <span className="mt-1.5 block font-sans text-[13.5px] leading-[1.4] font-medium text-ink">{question}</span>
                </span>
              </li>
            ))}
          </ul>
          <div
            ref={win}
            className="relative mx-auto w-full max-[1100.02px]:px-3 min-[1100.02px]:z-1 min-[1100.02px]:cursor-grab min-[1100.02px]:touch-none min-[1100.02px]:select-none min-[1100.02px]:data-held:cursor-grabbing"
          >
            {/* the app's Assistant page, scaled into the column; below 1100px r3's sideways-scrolling preview */}
            <AppWindowDemo
              view="assistant"
              narrow
              appHeight={APP_HEIGHT}
              label="The Fluide Assistant page with a sample answer"
              className="[filter:drop-shadow(0_18px_28px_rgba(11,11,12,.1))]"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
