import { LogoMark } from '@repo/ui/brand'
import { useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { SectionTag } from '../site/SectionTag'
import { DISPLAY } from '../site/ds'
import { gsap, useGSAP } from '../motion/gsap'
import { Reveal, useRevealScope } from '../motion/reveal'
import './Platform.css'

type Tone = 'sage' | 'peach' | 'peri'

const CARDS: { tone: Tone; title: string; art: ReactNode; body: string }[] = [
  {
    tone: 'sage',
    title: 'Read-only, forever',
    art: (
      <>
        <g className="a-bank">
          <path d="M18 74 58 50l40 24z" />
          <path d="M24 80h68M28 84v40M45 84v40M62 84v40M79 84v40M88 84v40M18 130h80" />
        </g>
        <g className="a-flow">
          <path d="M104 92c12-7 22 7 34 0s22-7 34 0" />
          <path d="M104 104c12-7 22 7 34 0s22-7 34 0" />
          <path d="M104 116c12-7 22 7 34 0s22-7 34 0" />
          <path d="M168 86l8 6-8 6" />
          <path d="M168 98l8 6-8 6" />
          <path d="M168 110l8 6-8 6" />
        </g>
        <g className="a-coin">
          <circle cx="206" cy="104" r="24" />
          <path d="M184 104l8-2 14 2 14 2 8-2M186 112l6-2 14 2 14 2 6-2M190 120l2-1 14 2 14 2 2-1" />
        </g>
        {/* .7 is where its timeline rests, so the prerendered frame matches */}
        <g className="a-back" opacity="0.7">
          <path d="M196 74C178 38 98 30 66 44" strokeDasharray="3 5" />
          <path d="M74 38l-8 6 9 4" />
        </g>
        <g className="a-lock">
          <rect x="122" y="30" width="18" height="15" rx="3" fill="var(--pf-card)" />
          <path className="a-shackle" d="M125 30v-5a6 6 0 0 1 12 0v5" />
        </g>
      </>
    ),
    body: 'Fluide asks Plaid for one product, your transactions. There is no code in it that can move money, by design.',
  },
  {
    tone: 'peach',
    title: 'A ledger that adds up',
    art: (
      <>
        <rect x="52" y="22" width="156" height="128" rx="10" opacity=".45" />
        <rect x="36" y="34" width="168" height="134" rx="10" fill="var(--pf-card)" />
        <g className="a-row1">
          <text x="52" y="66" className="t">
            Groceries
          </text>
          <text x="188" y="66" className="t n" textAnchor="end">
            +62.18
          </text>
        </g>
        <path d="M52 78h136" strokeDasharray="2 4" opacity=".6" />
        <g className="a-row2">
          <text x="52" y="100" className="t">
            Checking
          </text>
          <text x="188" y="100" className="t n" textAnchor="end">
            −62.18
          </text>
        </g>
        <path d="M52 114h136" />
        <g className="a-sum">
          <text x="52" y="142" className="t b">
            Σ postings
          </text>
          <text x="170" y="142" className="t n b" textAnchor="end">
            0.00
          </text>
          <path d="M178 136l4 4 8-9" />
        </g>
      </>
    ),
    body: "Every transaction is recorded twice, and the two sides sum to zero. The database rejects anything that doesn't, and every category change leaves an audit row.",
  },
  {
    tone: 'peri',
    title: 'Bring your own model',
    art: (
      <>
        <rect x="14" y="34" width="92" height="24" rx="12" />
        <text x="60" y="50" className="t s" textAnchor="middle">
          OpenAI
        </text>
        <rect x="14" y="68" width="92" height="24" rx="12" />
        <text x="60" y="84" className="t s" textAnchor="middle">
          Claude
        </text>
        <rect x="14" y="102" width="92" height="24" rx="12" />
        <text x="60" y="118" className="t s" textAnchor="middle">
          Gemini
        </text>
        <g className="a-pick">
          <rect x="14" y="136" width="92" height="24" rx="12" strokeWidth="2.2" fill="var(--pf-card)" />
          <text x="60" y="152" className="t s b" textAnchor="middle">
            Ollama · local
          </text>
        </g>
        <path
          d="M106 46c28 0 30 50 44 50M106 80c22 0 26 16 44 16M106 114c22 0 26-18 44-18"
          strokeDasharray="2 4"
          opacity=".45"
        />
        <path className="a-wire" d="M106 148c30 0 30-52 44-52" />
        <g className="a-plug">
          <rect x="150" y="88" width="14" height="16" rx="3" fill="var(--pf-card)" />
          <path d="M164 92h8M164 100h8" />
        </g>
        <rect x="172" y="66" width="54" height="60" rx="12" fill="var(--pf-card)" />
        <svg x="185" y="82" width="28" height="28" viewBox="0 0 100 100">
          <LogoMark className="" />
        </svg>
        <text x="120" y="188" className="t s" textAnchor="middle">
          keys stored encrypted
        </text>
      </>
    ),
    body: 'Pick the model that answers your questions: OpenAI, Claude, Gemini, OpenCode Zen, OpenRouter, or a local server such as Ollama or LM Studio, which keeps them on your machine. Keys are stored encrypted.',
  },
]

/* the active card's tile colour */
const TONE: Record<Tone, string> = {
  sage: 'data-on:[--pf-card:var(--color-tile-3)]',
  peach: 'data-on:[--pf-card:var(--color-tile-1)]',
  peri: 'data-on:[--pf-card:var(--color-tile-2)]',
}

const CARD =
  'group relative flex aspect-[4/5] min-w-0 flex-1 cursor-default flex-col rounded-lg border border-line-strong bg-(--pf-card) p-8 text-(--pf-ink) outline-none ' +
  '[--pf-card:var(--color-surface)] [--pf-ink:var(--color-ink)] data-on:z-1 data-on:[--pf-ink:var(--color-tile-ink)] ' +
  'origin-bottom min-[760px]:[transform:scale(.9)] min-[760px]:data-on:[transform:scale(1.1)] ' +
  '[transition:transform_.45s_cubic-bezier(.2,.7,.2,1),--pf-card_.45s,color_.45s] motion-reduce:transition-none ' +
  'focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#4d53c2] ' +
  'max-[760px]:min-h-[420px] max-[760px]:flex-[0_0_82%] max-[760px]:snap-center max-[760px]:aspect-auto max-[760px]:p-[26px]'

/* stroke-draw without the DrawSVG plugin: dash = path length, offset from length to 0 */
function draw(card: HTMLElement, selector: string) {
  const paths = Array.from(card.querySelectorAll<SVGGeometryElement>(selector))
  const lens = paths.map((p) => p.getTotalLength())
  paths.forEach((p, i) => gsap.set(p, { strokeDasharray: `${lens[i]} ${lens[i]}` }))
  return { paths, from: (i: number) => lens[i] }
}

function cardTimeline(card: HTMLElement) {
  const $ = (s: string) => card.querySelector(s)
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } })
  const tone = card.dataset.tone as Tone
  if (tone === 'sage') {
    /* money flows one way into your ledger; the way back is locked */
    const waves = draw(card, '.a-flow path')
    tl.fromTo(waves.paths, { strokeDashoffset: waves.from }, { strokeDashoffset: 0, duration: 0.9, stagger: 0.08 }, 0)
      .fromTo($('.a-back'), { opacity: 0.25 }, { opacity: 0.7, duration: 0.4 }, 0.3)
      .fromTo($('.a-shackle'), { y: -5 }, { y: 0, duration: 0.35, ease: 'back.out(3)' }, 0.6)
  } else if (tone === 'peach') {
    /* the two sides arrive and settle to zero */
    tl.fromTo($('.a-row1'), { x: -18, opacity: 0.2 }, { x: 0, opacity: 1, duration: 0.6 }, 0)
      .fromTo($('.a-row2'), { x: 18, opacity: 0.2 }, { x: 0, opacity: 1, duration: 0.6 }, 0.1)
      .fromTo($('.a-sum'), { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, 0.45)
  } else {
    /* the local model is picked, its wire draws across and the plug seats in Fluide */
    const wire = draw(card, '.a-wire')
    tl.fromTo($('.a-pick'), { opacity: 0.35 }, { opacity: 1, duration: 0.3 }, 0)
      .fromTo(wire.paths, { strokeDashoffset: wire.from }, { strokeDashoffset: 0, duration: 0.7 }, 0.15)
      .fromTo($('.a-plug'), { x: -18 }, { x: 0, duration: 0.45, ease: 'back.out(2)' }, 0.65)
  }
  return tl
}

/** A statement over three principle cards. One card is active at a time: the first by default, then hover
    or focus, or on narrow screens the card most in view. The active card grows, takes its tile colour and
    shows its sentence; its drawing replays once the row has been on screen (still under reduced motion). */
export function Platform() {
  const reveal = useRevealScope<HTMLElement>()
  const row = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  /* the card controller lives in the effect (it owns the timelines); events reach it through this */
  const select = useRef<(i: number) => void>(null)

  useGSAP(
    () => {
      const el = row.current
      if (!el) return
      const cards = Array.from(el.querySelectorAll<HTMLElement>('[data-tone]'))
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
      const tls = cards.map(cardTimeline)
      tls.forEach((tl) => tl.progress(1))
      let current = 0
      let seen = false

      select.current = (i) => {
        if (i === current) return
        current = i
        /* committed synchronously in the event so the CSS transitions start this frame */
        flushSync(() => setActive(i))
        if (seen && !reduced) tls[i].restart()
      }

      /* play the first card's drawing only once the row is actually on screen */
      const io = new IntersectionObserver(
        (es) => {
          if (!es[0].isIntersecting) return
          seen = true
          io.disconnect()
          if (!reduced) tls[current].restart()
        },
        { threshold: 0.35 },
      )
      io.observe(el)

      /* narrow screens: the card most in view is the active one */
      const narrow = matchMedia('(max-width: 760px)')
      let swipe: IntersectionObserver | null = null
      const sync = () => {
        swipe?.disconnect()
        swipe = null
        if (!narrow.matches) return
        swipe = new IntersectionObserver(
          (es) => es.forEach((e) => e.isIntersecting && select.current?.(cards.indexOf(e.target as HTMLElement))),
          { root: el, threshold: 0.6 },
        )
        cards.forEach((c) => swipe!.observe(c))
      }
      narrow.addEventListener('change', sync)
      sync()

      return () => {
        io.disconnect()
        swipe?.disconnect()
        narrow.removeEventListener('change', sync)
        select.current = null
      }
    },
    { scope: row },
  )

  return (
    <section
      {...reveal}
      id="platform"
      aria-labelledby="pf-title"
      className="relative z-1 bg-canvas px-6 pt-[140px] pb-[120px] text-[#16181d] max-[760px]:px-0 max-[760px]:pt-24 max-[760px]:pb-[88px]"
    >
      <div className="mx-auto max-w-[1180px]">
        <Reveal kind="link">
          <SectionTag className="max-[760px]:mx-5">Platform</SectionTag>
        </Reveal>
        <Reveal kind="words">
          <h2
            id="pf-title"
            className={`${DISPLAY} mt-[26px] max-w-[24em] text-[clamp(28px,3vw,44px)] leading-[1.04] text-pretty max-[760px]:mx-5`}
          >
            <span className="text-ink">The ledger that only reads.</span>{' '}
            <span className="font-bold text-ink-3">
              Your bank accounts arrive through Plaid, land in a ledger on your own machine, and answer your questions. It
              never moves a cent.
            </span>
          </h2>
        </Reveal>

        <Reveal kind="each">
          <div
            ref={row}
            className="mt-24 flex items-end gap-6 pt-10 max-[760px]:mt-12 max-[760px]:snap-x max-[760px]:snap-mandatory max-[760px]:items-stretch max-[760px]:gap-[14px] max-[760px]:overflow-x-auto max-[760px]:px-5 max-[760px]:pt-6 max-[760px]:pb-2 max-[760px]:[scrollbar-width:none] max-[760px]:[&::-webkit-scrollbar]:hidden"
          >
            {CARDS.map((card, i) => (
              <article
                key={card.tone}
                data-tone={card.tone}
                data-on={i === active ? '' : undefined}
                tabIndex={0}
                onPointerEnter={() => select.current?.(i)}
                onFocus={() => select.current?.(i)}
                className={`${CARD} ${TONE[card.tone]}`}
              >
                <h3 className="max-w-[9em] font-display text-[22px] leading-[1.05] font-extrabold tracking-[-0.02em] [font-stretch:125%]">
                  {card.title}
                </h3>
                <div
                  className="pf-art grid flex-1 place-items-center py-2 opacity-55 [transition:opacity_.45s] group-data-on:opacity-100 motion-reduce:transition-none"
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 240 200"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-auto w-[82%] overflow-visible"
                  >
                    {card.art}
                  </svg>
                </div>
                <p className="max-w-[26em] text-[15px] leading-[1.45] opacity-0 [transform:translateY(12px)] [transition:opacity_.45s_.1s,transform_.45s_.1s] group-data-on:opacity-100 group-data-on:[transform:none] motion-reduce:transition-none">
                  {card.body}
                </p>
              </article>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
