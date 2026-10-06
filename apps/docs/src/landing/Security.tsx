import { useRef, type ReactNode } from 'react'
import { SectionTag } from '../site/SectionTag'
import { DISPLAY } from '../site/ds'
import { gsap, useGSAP } from '../motion/gsap'
import { Reveal, useRevealScope } from '../motion/reveal'
import './Security.css'

const FACTS: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: (
      <>
        <rect x="1.5" y="2" width="13" height="9" rx="1.5" />
        <path d="M5.5 14h5M8 11v3" />
        <rect x="6" y="6" width="4" height="3" rx=".6" />
        <path d="M6.8 6V5a1.2 1.2 0 0 1 2.4 0v1" />
      </>
    ),
    title: 'One door, on this computer',
    body: "Fluide answers on 127.0.0.1 only, so it's reachable from the computer it runs on, not from your network.",
  },
  {
    icon: (
      <>
        <ellipse cx="8" cy="4" rx="5.5" ry="2" />
        <path d="M2.5 4v8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V4" />
        <path d="M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" />
      </>
    ),
    title: 'Your ledger has no door',
    body: 'It sits on a private network inside the install. The app connects to it without admin rights.',
  },
  {
    icon: (
      <>
        <circle cx="5" cy="11" r="3" />
        <path d="M7.2 8.8 14 2M11.5 4.5l1.8 1.8M9.8 6.2l1.4 1.4" />
      </>
    ),
    title: 'Keys kept apart',
    body: 'Bank access, API keys and chats are encrypted with AES-256-GCM. The key lives in its own place.',
  },
  {
    icon: (
      <>
        <path d="M8 1.5 2.5 3.5v4c0 3.3 2.3 6 5.5 7 3.2-1 5.5-3.7 5.5-7v-4z" />
        <path d="M5.5 8.2 7.3 10l3.2-3.4" />
      </>
    ),
    title: 'A locked-down app',
    body: "It runs as a regular user, can't change its own files, and has no special system permissions.",
  },
]

/** A drawing of a running install (what stops at the edge, what goes out) and four facts. Once the wide
    drawing is 30% in view, a request drops to the edge and stops, then a dot runs out to Plaid / the AI
    model; loops while in view. Reduced motion: the drawing stays still. */
export function Security() {
  const reveal = useRevealScope<HTMLElement>()
  const wide = useRef<SVGSVGElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const svg = wide.current
        if (!svg) return
        const sbIn = svg.querySelector('.sb-in')
        const sbOut = svg.querySelector('.sb-out')
        const stop = svg.querySelector('.stop')
        const bt = gsap.timeline({ repeat: -1, repeatDelay: 0.8, paused: true })
        bt.set(sbIn, { attr: { cy: 14 }, opacity: 1 })
          .to(sbIn, { attr: { cy: 60 }, duration: 0.9, ease: 'power1.in' })
          .to(stop, { opacity: 1, duration: 0.12 })
          .to(sbIn, { opacity: 0, duration: 0.2 }, '<')
          .to(stop, { opacity: 0, duration: 0.5 }, '+=.6')
          .set(sbOut, { attr: { cx: 450, cy: 150 }, opacity: 1 })
          .to(sbOut, { attr: { cy: 22 }, duration: 0.9, ease: 'none' })
          .to(sbOut, { attr: { cx: 520 }, duration: 0.35, ease: 'none' })
          .to(sbOut, { opacity: 0, duration: 0.2 })
        const io = new IntersectionObserver(
          (es) => {
            if (es[0].isIntersecting) bt.play()
            else bt.pause()
          },
          { threshold: 0.3 },
        )
        io.observe(svg)
        return () => io.disconnect()
      })
    },
    { scope: wide },
  )

  return (
    <section
      {...reveal}
      id="security"
      aria-labelledby="sec-t"
      className="bg-surface-inverse px-6 pt-28 pb-30 max-[760px]:px-5 max-[760px]:pt-20 max-[760px]:pb-22"
    >
      <div data-theme="dark" className="mx-auto max-w-[1180px] text-ink">
        <Reveal kind="link">
          <SectionTag tone="dark">Security</SectionTag>
        </Reveal>
        <Reveal kind="words">
          <h2
            id="sec-t"
            className={`${DISPLAY} mt-[22px] max-w-[20em] text-[clamp(30px,3.3vw,50px)] leading-none text-balance text-ink`}
          >
            Reachable from one computer. <span className="font-bold text-ink-3">Yours.</span>
          </h2>
        </Reveal>
        <Reveal kind="line">
          <p className="mt-4 max-w-[36em] text-[18px] leading-[1.5] text-ink-2">
            Fluide opens one door, on the computer it runs on. Your ledger has no door at all.
          </p>
        </Reveal>
        <Reveal kind="block">
          <figure className="mt-12 overflow-hidden rounded-lg border border-line bg-canvas">
            <div className="px-9 pt-7 pb-[18px] max-[760px]:px-3.5 max-[760px]:pt-[18px] max-[760px]:pb-2.5">
              <svg
                ref={wide}
                className="sb-svg block h-auto w-full max-[760px]:hidden"
                viewBox="0 0 1000 430"
                role="img"
                aria-label="Drawing of a running install. A request from your network stops at the edge of this computer. The app has one door, on 127.0.0.1. The app reaches the ledger without admin rights; the ledger has no door to the outside. The encryption key is kept apart. Fluide only reaches out to Plaid, read-only, and to your AI model if you set one, when you start it."
              >
                <path className="dash" d="M150 14V66" />
                <path className="ln" d="M136 66h28" />
                <path className="stop" d="M144 52l12 12M156 52l-12 12" />
                <circle className="dot sb-in" cx="150" cy="14" r="5" />
                <text x="176" y="44">your network · can't reach it</text>
                <text x="40" y="92">THIS COMPUTER</text>
                <path className="ln" d="M40 102H960" />
                <rect className="box" x="314" y="96" width="12" height="12" />
                <text className="on" x="302" y="128" textAnchor="end">one door · 127.0.0.1</text>
                <rect className="box" x="220" y="150" width="260" height="66" rx="2" />
                <text className="tb" x="240" y="180">Fluide</text>
                <text x="240" y="201">regular user · files locked</text>
                <path className="ln" d="M320 108v42" />
                <path className="out" d="M450 150V22H520" />
                <circle className="dot blue sb-out" cx="450" cy="150" r="5" opacity="0" />
                <text className="bl" x="530" y="20">goes out only when you start it:</text>
                <text className="bl" x="530" y="40">Plaid, read-only · your AI model, if you set one</text>
                <rect className="area" x="40" y="262" width="600" height="140" rx="2" />
                <text x="56" y="286">PRIVATE NETWORK</text>
                <rect className="box" x="220" y="310" width="260" height="66" rx="2" />
                <text className="tb" x="240" y="340">Your ledger</text>
                <text x="240" y="361">money rows can't be edited</text>
                <path className="ln" d="M280 216v94" />
                <text x="268" y="250" textAnchor="end">no admin rights</text>
                <path className="dash" d="M430 310v-24" />
                <path className="ln" d="M416 286h28" />
                <text className="on" x="452" y="290">no door</text>
                <text x="700" y="140">KEPT APART</text>
                <rect className="kept" x="700" y="150" width="260" height="66" rx="2" />
                <text className="tb" x="720" y="180">Encryption key</text>
                <text x="720" y="201">its own place · read-only</text>
                <path className="hair" d="M480 183H700" />
                <rect className="kept" x="700" y="310" width="260" height="66" rx="2" />
                <text className="tb" x="720" y="340">Ledger data</text>
                <text x="720" y="361">on this computer's disk</text>
                <path className="hair" d="M480 343H700" />
              </svg>
              <svg
                className="sb-svg hidden h-auto w-full max-[760px]:block"
                viewBox="0 0 420 600"
                role="img"
                aria-label="Drawing of a running install, stacked: a request from your network stops at the edge of this computer; one door on 127.0.0.1 to the app; the ledger below has no door; the encryption key is kept apart."
              >
                <path className="dash" d="M70 6V44" />
                <path className="ln" d="M56 44h28" />
                <text x="96" y="30">your network · can't reach it</text>
                <text x="20" y="72">THIS COMPUTER</text>
                <path className="ln" d="M20 82H400" />
                <rect className="box" x="114" y="76" width="12" height="12" />
                <text className="on" x="138" y="108">127.0.0.1 only</text>
                <rect className="box" x="20" y="126" width="260" height="66" rx="2" />
                <text className="tb" x="38" y="156">Fluide</text>
                <text x="38" y="177">regular user · files locked</text>
                <path className="ln" d="M120 88v38" />
                <path className="out" d="M250 126V70h40" />
                <text className="bl" x="298" y="58">goes out when</text>
                <text className="bl" x="298" y="76">you start it</text>
                <rect className="area" x="20" y="226" width="380" height="132" rx="2" />
                <text x="34" y="248">PRIVATE NETWORK · no door</text>
                <rect className="box" x="38" y="270" width="260" height="66" rx="2" />
                <text className="tb" x="56" y="300">Your ledger</text>
                <text x="56" y="321">money rows can't be edited</text>
                <path className="ln" d="M90 192v78" />
                <text x="102" y="216">no admin rights</text>
                <text x="20" y="400">KEPT APART</text>
                <rect className="kept" x="20" y="410" width="380" height="60" rx="2" />
                <text className="tb" x="38" y="437">Encryption key</text>
                <text x="38" y="457">its own place · read-only to the app</text>
                <rect className="kept" x="20" y="484" width="380" height="60" rx="2" />
                <text className="tb" x="38" y="511">Ledger data</text>
                <text x="38" y="531">on this computer's disk</text>
              </svg>
            </div>
            <figcaption className="border-t border-line px-6 py-3.5 text-[13.5px] text-ink-3">
              How a running install is laid out. Plaid and your AI model are only reached when you sync, ask or
              sort; nothing reaches in.
            </figcaption>
          </figure>
        </Reveal>
        <Reveal kind="each">
          <div className="mt-10 grid grid-cols-4 border-t border-line max-[760px]:grid-cols-1">
            {FACTS.map((f, i) => (
              <div
                key={f.title}
                className={`pt-[22px] pr-[22px] pb-1.5 max-[760px]:pt-[18px] max-[760px]:pr-0 max-[760px]:pb-1 ${
                  i === 0
                    ? ''
                    : 'border-l border-line pl-[22px] max-[760px]:border-t max-[760px]:border-l-0 max-[760px]:pl-0'
                }`}
              >
                <i className="sx-ic mb-4 grid size-10 place-items-center rounded-md border border-line bg-ink/4">
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    {f.icon}
                  </svg>
                </i>
                <b className="block font-display text-[15px] leading-[normal] font-extrabold tracking-[-0.015em] text-ink [font-stretch:125%]">
                  {f.title}
                </b>
                <p className="mt-2.5 text-[14px] leading-[1.5] text-ink-2">{f.body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
