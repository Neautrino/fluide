import { LatestTransactionsCard, OwnAndOweCard, SpendByMonthCard, WhereItWentCard } from '@repo/ui/overview'
import { QueueCard } from '@repo/ui/review'
import { HEADER_SUBTITLE, HeaderAskBox, NAV, NAV_LINK, NAV_LINK_ACTIVE, NAV_LINK_INACTIVE } from '@repo/ui/shell'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AssistantDemo } from '../components/AppViews'
import { APP_HEIGHT, AppWindowDemo, ClientOnly, useHydrated, type AppWindowApi } from '../components/AppWindowDemo'
import { DISPLAY, GITHUB, pill } from '../components/ds'
import { HashLink } from '../components/HashLink'
import { gsap, MOTION_QUERY, ScrollTrigger, useGSAP } from '../motion/gsap'
import { useMotion } from '../motion/MotionProvider'
import { cashflow, CURRENCY, fresh, latest, NOW, ownAndOweProps, reviewCardProps, reviewQueue } from '../sample'
import './Hero.css'

/* The hero (#top of r4/ds/index.html): the copy over the app's own light and — on wide screens that allow
   motion — the pinned, scrubbed sequence of r4/hero/hero.js over the real app:
     1 real Overview cards and the header ask box float around the headline
     2 the headline lifts away, the window rises, the cards fly into their Overview slots
       (the Review card is not on Overview: it folds into the Needs-you strip)
     3 the ask box zooms over a frosted Overview and the cursor types the question
     4 the Assistant opens and its answer + chart come in
   The floating cards are the same @repo/ui components, with the same props, that the window's Overview
   shows (components/AppViews.tsx); Hero.css trims each copy down to its headline content, as
   r4/hero/hero.css trimmed the replicas. The window is AppWindowDemo, which renders the app in a
   same-origin frame at its design width, so every position the sequence flies to is measured inside that
   frame and mapped into the page.
   Narrow screens and reduced motion get the static layout: the copy, the window, then the Assistant. */

const QUESTION = 'Why is Shopping up 38% this month?'
/** The window's design width (AppWindowDemo.DESIGN_WIDTH); the hero scales it to fit. */
const DW = 1280
const EDGE = 16
const GAP = 24
const ASK = { y: 0.785, s: 1.18, depth: 28 }
const noop = () => {}
/* stable arrays: a fresh literal on every render would re-render the whole app in the window */
const BOTH_VIEWS = ['overview', 'assistant'] as const
const OVERVIEW_ONLY = ['overview'] as const

type Region = 'tl' | 'tr' | 'bl' | 'br' | 'mr'

type Float = {
  key: string
  /** the Overview slot this card flies into (data-slot inside the app frame) */
  slot: string
  region: Region
  /** not on Overview: it shrinks into the middle of the Needs-you strip instead */
  fold?: boolean
  /** fixed float width; otherwise the slot's own width */
  w?: number
  /** width to render at before anything is measured: what the slot is at the app's 1280 design width, so
      the card is laid out once, at the size it keeps (an unconstrained card lays out at max-content first) */
  w0: number
  /** largest scale for this card: Where it went stays at app size, the rest sit smaller around it */
  max: number
  depth: number
  bt: number
  d: number
  card: ReactNode
}

/* Each card fills a free region around the copy (measured per refresh), never leaving the viewport.
   region: tl/tr above the headline · bl/br below the lede beside the CTAs and ask box · mr right of the
   text. Array order matters: mr is placed in the gap left between tr and br. */
const FLOATS: Float[] = [
  {
    key: 'whereItWent',
    slot: 'whereItWent',
    region: 'tl',
    w0: 325,
    max: 1,
    depth: 16,
    bt: 7.4,
    d: 0.15,
    card: <WhereItWentCard flow={cashflow} items={reviewQueue} fresh={fresh} onDetails={noop} onReview={noop} />,
  },
  {
    key: 'review',
    slot: 'needsYou',
    region: 'tr',
    fold: true,
    w: 440,
    w0: 440,
    max: 0.72,
    depth: 24,
    bt: 6.2,
    d: 0.3,
    card: <QueueCard {...reviewCardProps('Amazon')} />,
  },
  {
    key: 'latestRows',
    slot: 'latestRows',
    region: 'bl',
    w0: 651,
    max: 0.6,
    depth: 20,
    bt: 6.8,
    d: 0.4,
    card: <LatestTransactionsCard data={latest} currency={CURRENCY} fresh={fresh} onOpen={noop} />,
  },
  {
    key: 'ownOwe',
    slot: 'ownOwe',
    region: 'br',
    w0: 651,
    max: 0.58,
    depth: 12,
    bt: 7.9,
    d: 0.5,
    card: <OwnAndOweCard {...ownAndOweProps} onOpenAccounts={noop} />,
  },
  {
    key: 'spendByMonth',
    slot: 'spendByMonth',
    region: 'mr',
    w0: 325,
    max: 0.62,
    depth: 18,
    bt: 7.1,
    d: 0.45,
    card: <SpendByMonthCard flow={cashflow} items={reviewQueue} fresh={fresh} />,
  },
]

/** Offset chain, which ignores transforms — the window is scaled while the sequence runs. */
function offsetIn(el: HTMLElement, stop: Element) {
  let x = 0
  let y = 0
  for (let n: HTMLElement | null = el; n && n !== stop; n = n.offsetParent as HTMLElement | null) {
    x += n.offsetLeft
    y += n.offsetTop
  }
  return { x, y }
}

/** Page px per app px: the window is scaled to leave 40px of stage beside it, never past 0.9. */
const scaleFor = (stageWidth: number) => Math.min(0.9, (stageWidth - 80) / DW)

/** Where the window starts: below the fixed site nav, which stays on screen the whole time. */
const topFor = (nav: HTMLElement | null) => (nav ? nav.offsetHeight : 0) + 12

/** The app area that makes the scaled window reach from `top` to 26px above the fold. */
const appHeightFor = (stageWidth: number, stageHeight: number, nav: HTMLElement | null, chrome: number) =>
  Math.round((stageHeight - topFor(nav) - 26) / scaleFor(stageWidth)) - chrome

type Spot = { x: number; y: number; s: number }
type Entry = {
  x0: number
  y0: number
  s0: number
  h: number
  x1: number
  y1: number
  s1: number
}
type Layout = {
  W: number
  H: number
  /** page px per app px */
  k: number
  /** where the window sits in the stage */
  wx: number
  wy: number
  f: Record<string, Entry>
  ask0: { x: number; y: number }
  ask1: Spot
  ask2: Spot
  /** cursor scale that keeps it the size it had in the hero */
  cur2: number
}

/** The entrance plays once per page load; a remount (StrictMode, crossing the gate) must not replay it. */
let introPlayed = false

export function Hero() {
  const { motion } = useMotion()
  const hydrated = useHydrated()
  /* The window is handed over imperatively and never through state: a Hero re-render would re-render the
     whole app inside the frame (a ~50ms task), and the sequence switches its view mid-scrub. */
  const apiRef = useRef<AppWindowApi | null>(null)
  const startRef = useRef<(() => void) | null>(null)
  const onReady = useCallback((api: AppWindowApi) => {
    apiRef.current = api
    startRef.current?.()
  }, [])
  /* The app frame is sized before the app is portalled into it, so the Overview is laid out once, at the
     height it keeps: the window fills the viewport in the motion layout. Later refreshes set it directly
     (measure()), which is why this is read once and never updated. */
  const [appHeight, setAppHeight] = useState(APP_HEIGHT)

  useEffect(() => {
    if (!motion) return
    const frame = document.querySelector<HTMLElement>('#top [data-hx="win"]')
    const iframe = frame?.querySelector('iframe')
    if (!frame || !iframe) return
    setAppHeight(
      appHeightFor(innerWidth, innerHeight, document.querySelector('header'), frame.offsetHeight - iframe.offsetHeight),
    )
  }, [motion])

  useGSAP(
    () => {
      if (!motion) return
      const mm = gsap.matchMedia()
      const build = () => {
        const api = apiRef.current
        if (!api) return
        startRef.current = null
        mm.add(MOTION_QUERY, () => {
          const section = document.getElementById('top')!
          const stage = section.querySelector<HTMLDivElement>('.hx-stage')!
          const host = section.querySelector<HTMLDivElement>('.hx-win')!
          const copy = section.querySelector<HTMLDivElement>('.hx-copy')!
          const askEl = section.querySelector<HTMLDivElement>('.hx-ask')!
          const veil = section.querySelector<HTMLDivElement>('.hx-veil')!
          const askFrag = askEl.querySelector<HTMLElement>('.hx-frag')!
          const input = askEl.querySelector('input')!
          const cursor = askEl.querySelector<SVGElement>('.hx-cursor')!
          const root = document.documentElement
          /* the site nav is fixed over every layout and stays on screen the whole time */
          const nav = document.querySelector('header')
          const { doc, iframe, win } = api
          const slotOf = (name: string) => doc.querySelector<HTMLElement>(`[data-slot="${name}"]`)!
          const headerAsk = slotOf('headerAsk')
          const views = doc.querySelector<HTMLElement>('[data-hx="views"]')!
          const overview = doc.querySelector<HTMLElement>('[data-view="overview"]')!
          const chat = doc.querySelector<HTMLElement>('[data-view="assistant"]')!

          /* decorative copies: aria-hidden, so none of their controls may take focus */
          for (const el of stage.querySelectorAll<HTMLElement>(
            '.hx-float :is(a[href], button, input, select, textarea, [tabindex]), .hx-ask :is(input, button, label)',
          ))
            el.setAttribute('tabindex', '-1')

          /* the Assistant waits over the Overview. Hero.css can't reach inside the frame (its rules key on
           html.is-motion, which is the page's), so these two go on as inline styles the context reverts. */
          gsap.set(views, { position: 'relative' })
          gsap.set(chat, {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
          })

          const floats = FLOATS.map((cfg) => {
            const f = stage.querySelector<HTMLElement>(`.hx-float[data-frag="${cfg.key}"]`)!
            const target = slotOf(cfg.slot)
            return {
              cfg,
              f,
              px: f.querySelector<HTMLElement>('.hx-px')!,
              frag: f.querySelector<HTMLElement>('.hx-frag')!,
              slot: target,
              seated: target.firstElementChild!,
            }
          })

          /* Layout, measured once per ScrollTrigger refresh. Positions inside the app come from the frame's
           own document, which is never transformed, and are mapped through the window's place and scale. */
          let M: Layout | null = null
          /* the window chrome (title bar + borders) around the app frame */
          const chrome = win.offsetHeight - iframe.offsetHeight

          function measure(): Layout {
            const W = stage.clientWidth
            const H = stage.clientHeight
            const k = scaleFor(W)
            const top = topFor(nav)
            const appH = appHeightFor(W, H, nav, chrome)
            iframe.style.height = `${appH}px`
            api!.root.style.height = `${appH + chrome}px`
            const fo = offsetIn(iframe, host)
            /** an element of the app, in the window's own (unscaled) coordinates */
            const inApp = (el: Element) => {
              const r = el.getBoundingClientRect()
              return {
                x: fo.x + r.left,
                y: fo.y + r.top,
                w: r.width,
                h: r.height,
              }
            }
            const m = {
              W,
              H,
              k,
              wx: (W - DW * k) / 2,
              wy: top,
              f: {},
            } as Layout
            const at = (el: Element) => {
              const p = inApp(el)
              return { x: m.wx + p.x * k, y: m.wy + p.y * k }
            }

            const pillEl = copy.querySelector<HTMLElement>('.hx-pill')!
            const ctas = copy.querySelector<HTMLElement>('.hx-ctas')!
            const lede = copy.querySelector<HTMLElement>('.hx-lede')!
            const h1 = copy.querySelector<HTMLElement>('.hx-h1')!
            const pillX = offsetIn(pillEl, stage).x
            const pillRight = pillX + pillEl.offsetWidth
            const h1Top = offsetIn(h1, stage).y
            const ledeBottom = offsetIn(lede, stage).y + lede.offsetHeight
            const cp = offsetIn(ctas, stage)
            const ctasBottom = cp.y + ctas.offsetHeight
            /* right edge of the headline and lede text; the copy only ever moves vertically, so x from a Range is safe */
            let textRight = 0
            const sr = stage.getBoundingClientRect()
            for (const el of [h1, lede]) {
              const range = document.createRange()
              range.selectNodeContents(el)
              textRight = Math.max(textRight, range.getBoundingClientRect().right - sr.left)
            }

            /* the ask box sits centred under the CTAs. The app hides it on the Assistant view, so a refresh
             while the sequence sits at its end would measure a zero-width box: unhide it for the measure. */
            const askHidden = headerAsk.hidden
            if (askHidden) headerAsk.hidden = false
            const askW = headerAsk.offsetWidth
            const ah = askEl.offsetHeight * ASK.s
            const hp = at(headerAsk)
            if (askHidden) headerAsk.hidden = true
            m.ask1 = { x: hp.x, y: hp.y, s: k }
            /* typing: the ask box zooms to the top-centre of the content area, over the blurred Overview */
            const vb = inApp(views)
            const vp = at(views)
            const vw = vb.w * k
            const tw = Math.min(620, vw * 0.66)
            const s2 = tw / askW
            m.ask2 = { x: vp.x + (vw - tw) / 2, y: vp.y + 36 * k, s: s2 }
            m.cur2 = ASK.s / s2
            /* every remaining write is held back to here: reading a box after a style write costs a forced
             layout, and the floats alone would cost one each */
            askFrag.style.width = `${askW}px`
            /* the frosted layer covers the content area, in the window's own coordinates */
            veil.style.left = `${vb.x - 22}px`
            veil.style.top = `${vb.y - 6}px`
            veil.style.width = `${vb.w + 44}px`
            veil.style.height = `${vb.h + 30}px`
            const slots = floats.map((o) => o.slot.getBoundingClientRect())
            floats.forEach((o, i) => {
              o.frag.style.width = `${o.cfg.w || slots[i].width}px`
            })
            const heights = floats.map((o) => o.f.offsetHeight)

            const aw = askW * ASK.s
            m.ask0 = {
              x: (W - aw) / 2,
              y: Math.min(Math.max(ASK.y * H, ctasBottom + 26), H - ah - 26),
            }
            const midL = Math.min(cp.x, m.ask0.x) - GAP
            const midR = Math.max(cp.x + ctas.offsetWidth, m.ask0.x + aw) + GAP

            const R: Record<string, { l: number; r: number; t: number; b: number; align: 'l' | 'r' }> = {
              tl: { l: EDGE, r: pillX - GAP, t: 84, b: h1Top - 16, align: 'l' },
              tr: {
                l: pillRight + GAP,
                r: W - EDGE,
                t: 84,
                b: h1Top - 16,
                align: 'r',
              },
              bl: {
                l: EDGE,
                r: midL,
                t: ledeBottom + 18,
                b: H - EDGE,
                align: 'l',
              },
              br: {
                l: midR,
                r: W - EDGE,
                t: ledeBottom + 18,
                b: H - EDGE,
                align: 'r',
              },
            }

            floats.forEach((o, i) => {
              const c = o.cfg
              const sb = slots[i]
              const w = c.w || sb.width
              const h = heights[i]
              if (c.region === 'mr')
                R.mr = {
                  l: textRight + GAP,
                  r: W - EDGE,
                  t: m.f.review.y0 + m.f.review.h + GAP,
                  b: m.f.ownOwe.y0 - GAP,
                  align: 'r',
                }
              const g = R[c.region]
              const s0 = Math.min(c.max, (g.r - g.l) / w, (g.b - g.t) / h)
              const x0 = g.align === 'l' ? g.l : g.r - w * s0
              const y0 = g.t + (g.b - g.t - h * s0) / 2
              const p = at(o.slot)
              const e: Entry = {
                x0,
                y0,
                s0,
                h: h * s0,
                x1: p.x,
                y1: p.y,
                s1: k,
              }
              if (c.fold) {
                const s1 = k * 0.3
                e.x1 = p.x + (sb.width * k) / 2 - (w * s1) / 2
                e.y1 = p.y + (sb.height * k) / 2 - (h * s1) / 2
                e.s1 = s1
              }
              m.f[c.key] = e
            })
            return m
          }
          const G = () => (M ??= measure())
          const resetM = () => {
            M = null
          }
          ScrollTrigger.addEventListener('refreshInit', resetM)

          let progress = 0
          const typing = { n: 0 }
          const renderTyping = () => {
            input.value = QUESTION.slice(0, Math.round(typing.n))
          }

          const tl = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              /* The stage is sticky (Hero.css), so the trigger only scrubs: `bottom bottom` is the end of the
               hero's 440vh of run — the +=440% of pin r4/hero/hero.js scrolled through — and the 1.2s scrub
               catch-up makes each beat ease in rather than snap. */
              trigger: section,
              start: 'top top',
              end: 'bottom bottom',
              scrub: 1.2,
              invalidateOnRefresh: true,
              onUpdate: (s) => {
                progress = s.progress
              },
            },
          })

          /* background light drifts the whole way */
          tl.to('.hx-b1', { x: () => G().W * 0.1, y: () => G().H * 0.14, duration: 9.6 }, 0)
            .to('.hx-b2', { x: () => -G().W * 0.12, y: () => -G().H * 0.12, duration: 9.6 }, 0)
            .to('.hx-b3', { x: () => G().W * 0.08, y: () => -G().H * 0.2, duration: 9.6 }, 0)
            .to('.hx-b4', { y: () => -G().H * 0.3, duration: 9.6 }, 0)

          /* 1 → 2: the headline lifts, the window rises, the cards fly to their slots */
          tl.to(
            copy,
            {
              y: () => -G().H * 0.3,
              autoAlpha: 0,
              ease: 'power1.in',
              duration: 1.7,
            },
            0,
          )
            .fromTo(
              host,
              {
                x: () => G().wx + DW * G().k * 0.04,
                y: () => G().H * 0.74,
                scale: () => G().k * 0.92,
              },
              {
                x: () => G().wx,
                y: () => G().wy,
                scale: () => G().k,
                ease: 'power1.inOut',
                duration: 2.8,
              },
              0.2,
            )
            .fromTo(host, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 0.2)
            .fromTo(headerAsk, { autoAlpha: 0 }, { autoAlpha: 0, duration: 0.01 }, 0)

          for (const o of floats) {
            const key = o.cfg.key
            tl.fromTo(
              o.f,
              {
                x: () => G().f[key].x0,
                y: () => G().f[key].y0,
                scale: () => G().f[key].s0,
              },
              {
                x: () => G().f[key].x1,
                y: () => G().f[key].y1,
                scale: () => G().f[key].s1,
                ease: 'power2.inOut',
                duration: 2.7,
              },
              0.3,
            ).fromTo(o.f, { '--sh': 1 }, { '--sh': 0, duration: 0.8 }, 2.2)
            if (o.cfg.fold) {
              tl.fromTo(o.f, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.5, immediateRender: false }, 2.3).fromTo(
                o.seated,
                { autoAlpha: 0 },
                { autoAlpha: 1, duration: 0.5 },
                2.5,
              )
            } else {
              /* the floating copy is trimmed, so it crossfades into the full seated card rather than cutting */
              tl.fromTo(o.f, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.35, immediateRender: false }, 2.85).fromTo(
                o.seated,
                { autoAlpha: 0 },
                { autoAlpha: 1, duration: 0.35 },
                2.75,
              )
            }
          }

          tl.fromTo(
            askEl,
            { x: () => G().ask0.x, y: () => G().ask0.y, scale: ASK.s },
            {
              x: () => G().ask1.x,
              y: () => G().ask1.y,
              scale: () => G().ask1.s,
              ease: 'power2.inOut',
              duration: 2.7,
            },
            0.3,
          )
            .fromTo(askEl, { '--sh': 1 }, { '--sh': 0, duration: 0.8 }, 2.2)
            .fromTo(cursor, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.4 }, 1.1)

          /* 3: the ask box zooms out of the header over a blurred Overview, the question is typed and sent */
          tl.fromTo(headerAsk, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, immediateRender: false }, 3.2)
            .to(
              askEl,
              {
                x: () => G().ask2.x,
                y: () => G().ask2.y,
                scale: () => G().ask2.s,
                ease: 'power2.inOut',
                duration: 0.7,
              },
              3.2,
            )
            .to(askEl, { '--sh': 1, duration: 0.5 }, 3.3)
            .fromTo(veil, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 3.2)
            .fromTo(
              cursor,
              { autoAlpha: 0, x: -60, y: 40, scale: () => G().cur2 },
              {
                autoAlpha: 1,
                x: 0,
                y: 0,
                scale: () => G().cur2,
                ease: 'power2.out',
                duration: 0.5,
                immediateRender: false,
              },
              3.8,
            )
            .to(
              typing,
              {
                n: QUESTION.length,
                ease: 'none',
                duration: 1.6,
                onUpdate: renderTyping,
              },
              4.3,
            )
            .to(cursor, { scale: () => G().cur2 * 0.86, duration: 0.1 }, 6.0)
            .to(cursor, { scale: () => G().cur2, duration: 0.1 }, 6.1)

          /* 4: the Assistant opens (the header ask box hides there, as in the app's own header) */
          tl.fromTo(askEl, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.3, immediateRender: false }, 6.3)
            .to(veil, { autoAlpha: 0, duration: 0.4 }, 6.3)
            .to(headerAsk, { autoAlpha: 0, duration: 0.3 }, 6.3)
            .to(overview, { autoAlpha: 0, y: -12, duration: 0.5 }, 6.3)
            .fromTo(chat, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 6.55)
          /* The view switch, reversible inside a scrubbed timeline: a 1ms tween whose value reads as on/off
           whichever way the scroll runs. It writes the header's title block and the sidebar's current entry
           straight into the app's DOM (as r4/hero/hero.js did): re-rendering the window from React here
           would rebuild every card in it, mid-scrub. */
          const hello = slotOf('hello')
          const helloLine = hello.querySelector('small')!
          const helloTitle = hello.querySelector('h1')!
          const links = doc.querySelectorAll<HTMLElement>('aside nav button')
          const current = {
            overview: links[NAV.findIndex((i) => i.to === '/')],
            assistant: links[NAV.findIndex((i) => i.to === '/assistant')],
          }
          const dateStr = new Intl.DateTimeFormat(undefined, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }).format(new Date(NOW))
          const HEADER = {
            overview: {
              line: helloLine.textContent ?? '',
              title: helloTitle.textContent ?? '',
            },
            assistant: {
              line: `${dateStr} · ${HEADER_SUBTITLE['/assistant']}`,
              title: 'Assistant',
            },
          }
          const setView = (to: 'overview' | 'assistant') => {
            if (helloTitle.textContent === HEADER[to].title) return
            helloLine.textContent = HEADER[to].line
            helloTitle.textContent = HEADER[to].title
            const from = to === 'overview' ? 'assistant' : 'overview'
            current[to].className = `${NAV_LINK} ${NAV_LINK_ACTIVE}`
            current[to].setAttribute('aria-current', 'page')
            current[from].className = `${NAV_LINK} ${NAV_LINK_INACTIVE}`
            current[from].removeAttribute('aria-current')
          }
          const switcher = { v: 0 }
          tl.fromTo(
            switcher,
            { v: 0 },
            {
              v: 1,
              duration: 0.001,
              onUpdate: () => setView(switcher.v > 0.5 ? 'assistant' : 'overview'),
            },
            6.5,
          )

          /* the answer, part by part: the question bubble, the mark, the text, the chips, the chart and its
           bars, then the source line (@repo/ui SampleAnswer's own shape) */
          const answer = chat.querySelector<HTMLElement>('section[aria-label="Ask about your money"] > div:last-child')!
          const bubble = answer.children[0]
          const reply = answer.children[1]
          const body = reply.lastElementChild!
          const chart = body.children[2]
          tl.fromTo(bubble, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.4 }, 7.0)
            .fromTo(reply.firstElementChild!, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 7.35)
            .fromTo(
              body.children[0],
              { clipPath: 'inset(0 0 100% 0)' },
              {
                clipPath: 'inset(0 0 0% 0)',
                ease: 'power2.out',
                duration: 0.7,
              },
              7.4,
            )
            .fromTo(body.children[1], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 7.9)
            .fromTo(chart, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 8.1)
            .fromTo(
              chart.querySelectorAll('svg > rect:nth-of-type(-n+2), svg > path'),
              { scaleX: 0, transformOrigin: '0% 50%' },
              { scaleX: 1, ease: 'power2.out', duration: 0.6, stagger: 0.1 },
              8.5,
            )
            .fromTo(body.children[3], { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.4 }, 9.0)
            .to({}, { duration: 0.6 }, 9.4)

          /* pointer parallax + idle bob, faded out as soon as the sequence starts */
          let mx = 0
          let my = 0
          let cx = 0
          let cy = 0
          let lastAmp = -1
          const onMove = (e: PointerEvent) => {
            mx = e.clientX / innerWidth - 0.5
            my = e.clientY / innerHeight - 0.5
          }
          addEventListener('pointermove', onMove, { passive: true })
          const layers = floats.map((o) => ({ el: o.px, depth: o.cfg.depth }))
          layers.push({ el: askFrag, depth: ASK.depth })
          const parallax = () => {
            const amp = Math.max(0, 1 - progress * 9)
            /* on the stage, not on <html>: a custom property on the root invalidates the style of every
               element on the page, and this runs on the ticker */
            if (amp !== lastAmp) stage.style.setProperty('--bob', amp.toFixed(3))
            if (amp === 0 && lastAmp === 0) return
            lastAmp = amp
            cx += (mx - cx) * 0.07
            cy += (my - cy) * 0.07
            for (const l of layers)
              l.el.style.translate = `${(cx * l.depth * amp).toFixed(2)}px ${(cy * l.depth * amp).toFixed(2)}px`
          }
          gsap.ticker.add(parallax)

          void document.fonts?.ready.then(() => ScrollTrigger.refresh())

          /* The entrance (Hero.css .hx-intro) starts once the page has stopped re-measuring: after the fonts
           and the load event, and 150ms after the last ScrollTrigger refresh — each refresh re-pins the
           hero, which moves it in the DOM, and a DOM move restarts every CSS animation inside it. After
           1.8s it is done and .hx-shown leaves everything still, so a later refresh can't replay it.
           Capped at 2.5s. Every floating card is mounted and placed before this runs. */
          let quiet: ReturnType<typeof setTimeout> | undefined
          let cap: ReturnType<typeof setTimeout> | undefined
          let done: ReturnType<typeof setTimeout> | undefined
          let started = false
          const startIntro = () => {
            if (started) return
            started = true
            introPlayed = true
            clearTimeout(quiet)
            clearTimeout(cap)
            ScrollTrigger.removeEventListener('refresh', armIntro)
            root.classList.add('hx-intro')
            done = setTimeout(() => {
              root.classList.add('hx-shown')
              root.classList.remove('hx-intro')
            }, 1800)
          }
          function armIntro() {
            clearTimeout(quiet)
            quiet = setTimeout(startIntro, 150)
          }
          const armAfterFonts = () => {
            void (document.fonts?.ready ?? Promise.resolve()).then(() => {
              ScrollTrigger.addEventListener('refresh', armIntro)
              armIntro()
            })
          }
          if (introPlayed) {
            root.classList.add('hx-shown')
          } else {
            if (document.readyState === 'complete') armAfterFonts()
            else addEventListener('load', armAfterFonts, { once: true })
            cap = setTimeout(startIntro, 2500)
          }

          return () => {
            clearTimeout(quiet)
            clearTimeout(cap)
            clearTimeout(done)
            ScrollTrigger.removeEventListener('refresh', armIntro)
            removeEventListener('load', armAfterFonts)
            ScrollTrigger.removeEventListener('refreshInit', resetM)
            root.classList.remove('hx-intro', 'hx-shown')
            gsap.ticker.remove(parallax)
            removeEventListener('pointermove', onMove)
            stage.style.removeProperty('--bob')
            iframe.style.height = ''
            api.root.style.height = ''
            setView('overview')
          }
        })
      }
      startRef.current = build
      build()
      return () => {
        startRef.current = null
        mm.kill(true)
      }
    },
    { dependencies: [motion] },
  )

  return (
    <section id="top" className="hx-hero" aria-label="Fluide">
      <div className="hx-stage">
        {/* the hero's own light: it fills the stage, so it stays while the sequence runs and leaves with it */}
        <div className="hx-bg" aria-hidden="true">
          <i className="hx-blob hx-b1" />
          <i className="hx-blob hx-b2" />
          <i className="hx-blob hx-b3" />
          <i className="hx-blob hx-b4" />
        </div>
        <div className="hx-copy">
          <HashLink
            to="/docs"
            hash="security-model"
            className="hx-pill mb-11 inline-flex h-9 items-center gap-[9px] rounded-full border border-line-strong bg-surface pr-3.5 pl-[13px] text-[13.5px] font-semibold text-ink transition-colors duration-200 hover:bg-surface-2 max-[760px]:mb-8 max-[760px]:h-auto max-[760px]:min-h-[34px] max-[760px]:py-1.5 max-[760px]:text-left max-[760px]:text-[12.5px]"
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="size-[15px] flex-none fill-none stroke-current stroke-[1.4] [stroke-linecap:round] [stroke-linejoin:round]"
            >
              <rect x="3" y="7.2" width="10" height="6.3" rx="1.3" />
              <path d="M5.6 7.2V5.4a2.4 2.4 0 0 1 4.8 0v1.8" />
            </svg>
            <span>Read-only by design: Fluide can't move money</span>
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="w-3.5 flex-none fill-none stroke-current stroke-[1.4] text-ink-3 [stroke-linecap:round] [stroke-linejoin:round]"
            >
              <path d="M3 8h9.5M8.5 4l4 4-4 4" />
            </svg>
          </HashLink>
          <h1 className={`hx-h1 ${DISPLAY} max-w-[14em] text-[clamp(38px,4.4vw,74px)] leading-[0.98] text-balance text-ink`}>
            <span className="ln">Your bank accounts in one</span>{' '}
            <span className="ln">
              ledger, <em>on your machine</em>.
            </span>
          </h1>
          <p className="hx-lede mt-[26px] mb-[34px] max-w-[34em] text-[18px] leading-[1.5] text-pretty text-ink-2 max-[760px]:text-[16.5px]">
            Fluide is a self-hosted finance app. It reads your accounts through Plaid, sorts transactions with rules and AI,
            asks you when it isn't sure, and answers questions from your own ledger.
          </p>
          <div className="hx-ctas flex items-center gap-[26px] max-[760px]:flex-col max-[760px]:gap-4">
            <HashLink to="/docs" hash="install" className={pill('solid', 'lg')}>
              Self-host it
            </HashLink>
            <a className={pill('outline', 'lg')} href={GITHUB}>
              Source on GitHub
            </a>
          </div>
        </div>

        <p className="sr-only" id="product-desc">
          Product preview with sample data: the Fluide Overview running at localhost:8080, then the Assistant answering why
          Shopping is up 38% this month, from the ledger.
        </p>
        <div className="hx-win" id="product" role="group" aria-label="Fluide app preview" aria-describedby="product-desc">
          <ClientOnly className="hx-winbox">
            <AppWindowDemo
              view="overview"
              views={motion ? BOTH_VIEWS : OVERVIEW_ONLY}
              keepVisible={motion}
              scale={motion ? 'none' : 'fit'}
              narrow={!motion}
              appHeight={appHeight}
              onReady={onReady}
              className="[filter:drop-shadow(0_18px_28px_rgba(11,11,12,.1))]"
              label="The Fluide app with sample data: the Overview, then the Assistant"
            />
          </ClientOnly>
          <div className="hx-veil" aria-hidden="true" />
          {/* static layout: the Assistant sits under the window, as it does in r4/hero/hero.js */}
          {!motion && (
            <ClientOnly className="hx-chat">
              <AssistantDemo />
            </ClientOnly>
          )}
        </div>

        {motion && hydrated && (
          <>
            {FLOATS.map((cfg) => (
              <div key={cfg.key} className="hx-float" data-frag={cfg.key} aria-hidden="true">
                <div className="hx-px" style={{ '--d': `${cfg.d}s` } as CSSProperties}>
                  <ClientOnly className="hx-frag" style={{ width: cfg.w0, '--bt': `${cfg.bt}s` } as CSSProperties}>
                    {cfg.card}
                  </ClientOnly>
                </div>
              </div>
            ))}
            <div className="hx-ask" aria-hidden="true">
              <ClientOnly className="hx-frag">
                <HeaderAskBox value="" onChange={noop} onSubmit={noop} />
              </ClientOnly>
              <svg className="hx-cursor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 2.5 19.5 11l-6.6 1.7-3.3 6.3z" />
              </svg>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
