import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { SectionTag } from '../site/SectionTag'
import { DISPLAY } from '../site/ds'
import { gsap, ScrollTrigger, useGSAP } from '../motion/gsap'
import { Reveal, useRevealScope } from '../motion/reveal'
import './How.css'

/* How it works (r4/flow/flow.js, option A). The map is an inline SVG.
   - Arrival: when the map is 30% in view it draws itself slowly, part by part, once.
   - Wide screens with motion: the section pins for 250% of the viewport. Scroll progress picks the state
     (intro → Sync → Sort → Ask); the left text swaps in place and the map lights that flow with dots.
     The Sync/Sort/Ask labels scroll to their state. Reaching a flow before the build ends speeds it ×4.
   - Narrow screens or reduced motion: no pin; every state is listed under the map, the labels just
     highlight a flow. Reduced motion: the map is drawn at once and has no dots. */

type Flow = 'sync' | 'sort' | 'ask'
type State = 'all' | Flow

const PIN_QUERY = '(min-width: 1000px) and (prefers-reduced-motion: no-preference)'
const COL: Record<Flow | 'grey', string> = { sync: '#efc3ae', sort: '#c8cbed', ask: '#a8d5b8', grey: '#92969e' }
const BUILD_PART = 1.6 /* seconds per part; four parts, about 6.5s in all */
const PIN = '+=250%'
/* pin progress → state, and where each label scrolls to */
const stateAt = (p: number): State => (p < 0.18 ? 'all' : p < 0.44 ? 'sync' : p < 0.7 ? 'sort' : 'ask')
const TARGET: Record<State, number> = { all: 0.05, sync: 0.31, sort: 0.57, ask: 0.86 }
const hasFlow = (active: State, flows: string) => active === 'all' || flows.split(' ').includes(active)

const CHIPS: [Flow, string][] = [
  ['sync', 'Sync'],
  ['sort', 'Sort'],
  ['ask', 'Ask'],
]

const BANKS: [string, string, number][] = [
  ['chase', 'Chase', 22],
  ['bankofamerica', 'Bank of America', 17],
  ['wellsfargo', 'Wells Fargo', 44],
  ['citi', 'Citi', 32],
  ['capitalone', 'Capital One', 28],
  ['usbank', 'U.S. Bank', 24],
  ['pnc', 'PNC', 28],
  ['truist', 'Truist', 24],
  ['amex', 'American Express', 44],
  ['schwab', 'Charles Schwab', 44],
  ['ally', 'Ally', 30],
  ['discover', 'Discover', 20],
  ['navyfederal', 'Navy Federal Credit Union', 36],
]

/* bank → Plaid → your machine (ledger; rules → AI suggests → you decide; views) → your AI model.
   Laid out tight: the ledger sits level with the middle of the views, so the box has no empty corner. */
const VIEWS: [string, number][] = [
  ['Overview', 50],
  ['Cash flow', 98],
  ['Transactions', 146],
  ['Accounts', 194],
  ['Assistant', 242],
]
type Line = { d: string; flows: string; part: number; ext?: boolean }
const LINES: Line[] = [
  { d: 'M170 166H205', flows: 'sync', part: 0 },
  { d: 'M370 166H430', flows: 'sync', part: 0 },
  { d: 'M485 210V300', flows: 'sort', part: 2 },
  { d: 'M540 330H556', flows: 'sort', part: 2 },
  { d: 'M676 330H692', flows: 'sort', part: 2 },
  { d: 'M751 300C751 250 690 196 620 196', flows: 'sort', part: 2 },
  { d: 'M616 360V392H1000V360', flows: 'sort', part: 3, ext: true },
  ...VIEWS.map(([name, y]) => ({
    d: `M620 166C700 166 720 ${y + 20} 800 ${y + 20}`,
    flows: name === 'Assistant' ? 'sync ask' : 'sync',
    part: 3,
  })),
  { d: 'M940 262H1080V300', flows: 'ask', part: 3, ext: true },
]
type Node = { x: number; y: number; w: number; h: number; t: string; s?: string; part: number; flows: string; hatch?: boolean }
const NODES: Node[] = [
  { x: 20, y: 132, w: 150, h: 68, t: 'Your bank', s: 'US banks', part: 0, flows: 'sync' },
  { x: 205, y: 132, w: 165, h: 68, t: 'Plaid', s: 'transactions only', part: 0, flows: 'sync' },
  { x: 430, y: 122, w: 190, h: 88, t: 'Your ledger', s: 'sides add to 0.00', part: 1, flows: 'sync sort ask' },
  { x: 430, y: 300, w: 110, h: 60, t: 'Your rules', part: 2, flows: 'sort' },
  { x: 556, y: 300, w: 120, h: 60, t: 'AI suggests', s: 'with a score', part: 2, flows: 'sort' },
  { x: 692, y: 300, w: 118, h: 60, t: 'You decide', s: 'when unsure', part: 2, flows: 'sort' },
  ...VIEWS.map(([t, y]) => ({ x: 800, y, w: 140, h: 40, t, part: 3, flows: t === 'Assistant' ? 'sync ask' : 'sync' })),
  { x: 966, y: 300, w: 128, h: 60, t: 'Your AI model', s: 'yours to pick', part: 3, flows: 'sort ask', hatch: true },
]

function FlowMap({ active, built }: { active: State; built: boolean }) {
  const on = (flows: string) => !built || hasFlow(active, flows)
  return (
    <svg viewBox="0 0 1100 440">
      <defs>
        <pattern id="flh" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#141416" />
          <rect width="1.2" height="6" fill="#3a3a40" />
        </pattern>
      </defs>
      <g data-part="1">
        <rect className="box" x="400" y="16" width="560" height="404" rx="18" />
        <text className="box-l" x="420" y="42">
          YOUR MACHINE
        </text>
      </g>
      {LINES.map((l) => (
        <path
          key={l.d}
          className={`p${l.ext ? ' ext' : ''}${on(l.flows) ? '' : ' dim'}`}
          d={l.d}
          data-flows={l.flows}
          data-part={l.part}
          style={{ stroke: built && active !== 'all' && on(l.flows) ? COL[active] : undefined }}
        />
      ))}
      <text className="lbl" x="230" y="122" data-part="0">
        read-only
      </text>
      <text className="lbl" x="628" y="284" data-part="2">
        approve → rule
      </text>
      <text className="lbl" x="968" y="290" data-part="3">
        only if set up
      </text>
      {NODES.map((n) => (
        <g
          key={n.t}
          className={`n${n.hatch ? ' hatch' : ''}${on(n.flows) ? '' : ' dim'}`}
          data-part={n.part}
          data-flows={n.flows}
        >
          <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="10" />
          <text className="t" x={n.x + 14} y={n.s ? n.y + 27 : n.y + n.h / 2 + 6}>
            {n.t}
          </text>
          {n.s && (
            <text className="s" x={n.x + 14} y={n.y + 47}>
              {n.s}
            </text>
          )}
        </g>
      ))}
      <g className="dots" />
    </svg>
  )
}

function BankSet({ copy }: { copy?: boolean }) {
  return (
    <ul
      className="bk-set flex h-11 list-none items-center gap-16 pr-16 max-[760px]:gap-10 max-[760px]:pr-10"
      aria-hidden={copy || undefined}
    >
      {BANKS.map(([file, name, h]) => (
        <li key={file}>
          <img
            src={`/banks/${file}.png`}
            alt={copy ? '' : name}
            className="block w-auto max-w-none opacity-70 transition-opacity duration-250 hover:opacity-100"
            style={{ '--h': `${h}px` } as CSSProperties}
          />
        </li>
      ))}
    </ul>
  )
}

export function How() {
  const reveal = useRevealScope<HTMLElement>()
  const mapRef = useRef<HTMLDivElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const [active, setActiveState] = useState<State>('all')
  const [built, setBuilt] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [pending, setPending] = useState(true)
  /* mirrors for the timeline callbacks and the dot loop */
  const live = useRef({ active: 'all' as State, built: false, tl: null as gsap.core.Timeline | null, st: null as ScrollTrigger | null })

  const setActive = (s: State) => {
    const L = live.current
    if (s === L.active) return
    L.active = s
    if (!L.built && L.tl && s !== 'all') L.tl.timeScale(4)
    setActiveState(s)
  }

  /* ---- slow build on arrival; pin on wide screens with motion allowed */
  useGSAP(
    () => {
      const svg = mapRef.current!.querySelector('svg')!
      const L = live.current
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
      const parts = [0, 1, 2, 3].map((i) => Array.from(svg.querySelectorAll<SVGElement>(`[data-part="${i}"]`)))
      let fades: SVGElement[] = []
      const finish = () => {
        L.built = true
        gsap.set(fades, { clearProps: 'opacity,transform' }) /* hand opacity back to the .dim classes */
        setBuilt(true)
      }
      let io: IntersectionObserver | null = null
      if (reduced) finish()
      else {
        const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' }, onComplete: finish })
        L.tl = tl
        parts.forEach((els, i) => {
          const t = i * BUILD_PART
          const ns = els.filter((e) => !e.classList.contains('p'))
          const ls = els.filter((e) => e.classList.contains('p')) as SVGPathElement[]
          fades = fades.concat(ns)
          gsap.set(ns, { opacity: 0, y: 10 })
          tl.to(ns, { opacity: 1, y: 0, duration: 0.7, stagger: 0.1 }, t)
          ls.forEach((p, j) => {
            if (p.classList.contains('ext')) {
              fades.push(p)
              gsap.set(p, { opacity: 0 })
              tl.to(p, { opacity: 1, duration: 0.6 }, t + 0.7 + j * 0.08)
            } else {
              const len = p.getTotalLength()
              p.style.strokeDasharray = `${len} ${len}`
              p.style.strokeDashoffset = String(len)
              tl.to(p, { strokeDashoffset: 0, duration: 1, ease: 'power1.inOut' }, t + 0.35 + j * 0.1)
            }
          })
        })
        io = new IntersectionObserver(
          (es) => {
            if (!es[0].isIntersecting) return
            io!.disconnect()
            tl.play()
          },
          { threshold: 0.3 },
        )
        io.observe(mapRef.current!)
      }
      setPending(false)

      const mm = gsap.matchMedia()
      mm.add(PIN_QUERY, () => {
        setPinned(true)
        const st = ScrollTrigger.create({
          trigger: reveal.ref.current,
          start: 'top top',
          end: PIN,
          pin: pinRef.current,
          anticipatePin: 1,
          onUpdate: (self) => setActive(stateAt(self.progress)),
        })
        L.st = st
        setActive(stateAt(st.progress))
        return () => {
          L.st = null
          setPinned(false)
        }
      })
      return () => {
        io?.disconnect()
        L.tl = null
      }
    },
    { scope: reveal.ref },
  )

  /* ---- dots: run along drawn lines of the active flow, one rAF loop, paused off-screen */
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const svg = mapRef.current!.querySelector('svg')!
    const layer = svg.querySelector('.dots')!
    const L = live.current
    const lines = Array.from(svg.querySelectorAll<SVGPathElement>('.p')).map((el) => ({
      el,
      len: el.getTotalLength(),
      dots: [] as { c: SVGCircleElement; s: number }[],
      next: Math.random() * 600,
    }))
    let visible = false
    let last = 0
    let raf = 0
    const io = new IntersectionObserver((es) => {
      visible = es[0].isIntersecting
    })
    io.observe(svg)
    const drawn = (p: SVGPathElement) =>
      p.classList.contains('ext')
        ? p.style.opacity === '' || parseFloat(p.style.opacity) > 0.98
        : p.style.strokeDashoffset === '' || parseFloat(p.style.strokeDashoffset) < 1
    const tick = (t: number) => {
      const dt = last ? Math.min(64, t - last) : 16
      last = t
      if (visible)
        for (const line of lines) {
          if (!L.built || !drawn(line.el) || !hasFlow(L.active, line.el.dataset.flows ?? '')) {
            for (const o of line.dots) o.c.remove()
            line.dots.length = 0
            continue
          }
          line.next -= dt
          if (line.next <= 0) {
            const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
            c.setAttribute('r', '3.5')
            c.setAttribute('class', 'dot')
            /* the active flow's colour, or in the intro the colour of the line's first flow */
            c.setAttribute(
              'fill',
              L.active !== 'all' ? COL[L.active] : COL[(line.el.dataset.flows ?? '').split(' ')[0] as Flow] || COL.grey,
            )
            layer.appendChild(c)
            line.dots.push({ c, s: 0 })
            line.next = 900 + Math.random() * 500
          }
          for (let i = line.dots.length - 1; i >= 0; i--) {
            const o = line.dots[i]
            o.s += dt * 0.14
            if (o.s >= line.len) {
              o.c.remove()
              line.dots.splice(i, 1)
              continue
            }
            const pt = line.el.getPointAtLength(o.s)
            o.c.setAttribute('cx', String(pt.x))
            o.c.setAttribute('cy', String(pt.y))
          }
        }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      for (const line of lines) for (const o of line.dots) o.c.remove()
    }
  }, [])

  const go = (s: Flow) => {
    const st = live.current.st
    if (st) window.scrollTo({ top: st.start + TARGET[s] * (st.end - st.start), behavior: 'smooth' })
    else setActive(live.current.active === s ? 'all' : s)
  }

  const states: { id: State; body: ReactNode }[] = [
    {
      id: 'all',
      body: (
        <>
          <p className="fl-lead font-sans text-[20px] leading-[1.4] font-medium tracking-[-0.01em] text-[#ececea]">
            Three things happen on this path, and you start each one.
          </p>
          <p className="fl-hint mt-3.5 font-mono text-[12px] leading-[normal] font-medium tracking-[0.04em] text-[#8a8d93]">
            Scroll to follow each one.
          </p>
        </>
      ),
    },
    {
      id: 'sync',
      body: (
        <Steps flow="sync" title="When you press Sync">
          <li>Fluide asks Plaid for anything new, with the keys you entered.</li>
          <li>Plaid reads it from your bank. Read-only.</li>
          <li>Each transaction is written into your ledger, both sides adding to zero, and every view updates.</li>
        </Steps>
      ),
    },
    {
      id: 'sort',
      body: (
        <Steps flow="sort" title="When you sort">
          <li>Your rules are checked first.</li>
          <li>If you set up an AI model, it suggests a category for what's left, with a score.</li>
          <li>Sure enough: filed. Not sure: it waits for you. Approving saves a rule for next time.</li>
        </Steps>
      ),
    },
    {
      id: 'ask',
      body: (
        <Steps flow="ask" title="When you ask">
          <li>Your question goes to the chat model you chose.</li>
          <li>The model can only run read-only queries on your ledger. The ledger does the maths.</li>
          <li>The answer comes back to you. A local model keeps all of it on your machine.</li>
        </Steps>
      ),
    },
  ]

  return (
    <section {...reveal} id="how" aria-labelledby="how-t" className="fl mt-8 bg-[#0b0b0c] text-[#ececea]">
      <div ref={pinRef} className="fl-pin">
        <div className="fl-in mx-auto max-w-[1240px] px-8 py-24 max-[1000px]:px-5 max-[1000px]:py-[72px]">
          <div>
            <Reveal kind="link">
              <SectionTag tone="dark">How it works</SectionTag>
            </Reveal>
            <Reveal kind="words">
              <h2 id="how-t" className={`${DISPLAY} mt-5 max-w-[22em] text-[clamp(28px,3vw,44px)] leading-none text-[#ececea]`}>
                One read path, from your bank to your answer.
              </h2>
            </Reveal>
          </div>
          <div className="mt-9 grid grid-cols-[300px_minmax(0,1fr)] items-center gap-12 max-[1000px]:grid-cols-1 max-[1000px]:gap-7">
            <div>
              <div className="fl-chips flex flex-wrap gap-2" role="group" aria-label="The three flows">
                {CHIPS.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    data-go={id}
                    aria-pressed={active === id}
                    onClick={() => go(id)}
                    style={{ '--c': COL[id] } as CSSProperties}
                    className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border border-[#3a3a3e] pr-3.5 pl-[11px] font-sans text-[13px] leading-[normal] font-bold text-[#b9bcc2] transition-[border-color,color,background-color] duration-250 hover:border-[#5a5a62] hover:text-[#ececea] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ececea]"
                  >
                    <i className="size-2 rounded-full bg-(--c)" />
                    {label}
                  </button>
                ))}
              </div>
              <div className="fl-states relative mt-7">
                {states.map(({ id, body }) => (
                  <div
                    key={id}
                    data-state={id}
                    className={`fl-state${active === id ? ' on' : ''}`}
                    aria-hidden={pinned ? active !== id : undefined}
                  >
                    {body}
                  </div>
                ))}
              </div>
            </div>
            <div
              ref={mapRef}
              className="fl-map w-full justify-self-end max-[1000px]:order-first"
              aria-hidden="true"
              data-pending={pending ? '' : undefined}
            >
              <FlowMap active={active} built={built} />
            </div>
          </div>
          {/* banks Plaid connects to (US only). Not customers, not partners. */}
          <Reveal kind="block">
            <div className="mt-[clamp(24px,4vh,44px)] border-t border-[#26262a] pt-[clamp(18px,3vh,28px)]">
              <p className="text-center font-sans text-[14px] leading-[normal] font-medium text-[#b9bcc2]">
                Connects through Plaid to
              </p>
              <div className="bk-row relative mt-[clamp(14px,2.4vh,22px)] overflow-hidden">
                <div className="bk-track flex w-max">
                  <BankSet />
                  <BankSet copy />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function Steps({ flow, title, children }: { flow: Flow; title: string; children: ReactNode }) {
  return (
    <>
      <span
        className="fl-k inline-flex items-center gap-[9px] font-display text-[19px] leading-[normal] font-extrabold tracking-[-0.02em] [font-stretch:125%]"
        style={{ '--c': COL[flow] } as CSSProperties}
      >
        {title}
      </span>
      <ol className="mt-3.5 flex list-decimal flex-col gap-2.5 pl-[18px] text-[15px] leading-[1.5] text-[#b9bcc2]">
        {children}
      </ol>
    </>
  )
}
