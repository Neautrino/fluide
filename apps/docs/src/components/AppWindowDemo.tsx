import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  AppSidebar,
  AppWindow,
  getDaysLeft,
  getGreeting,
  HEADER_SUBTITLE,
  HeaderAskBox,
  HeaderButton,
  HeaderView,
  HideAmountsIcon,
  NAV,
  NAV_LINK,
  NAV_LINK_ACTIVE,
  NAV_LINK_INACTIVE,
  SyncIcon,
  ThemeIcon,
} from '@repo/ui/shell'
import { NOW, reviewQueue } from '../sample'
import { VIEW_COMPONENT, VIEW_ROUTE, VIEWS, type View } from './AppViews'
import './AppWindowDemo.css'

export { VIEWS, type View } from './AppViews'

/* The real Fluide app window (AppWindow + AppSidebar + HeaderView + one of six views, all from @repo/ui) on
   the landing's sample data, inside r3's browser frame (winbar: dots, localhost URL, read-only tag, Sample
   data chip). The app renders into a same-origin iframe DESIGN_WIDTH wide, so Tailwind's viewport
   breakpoints resolve against the window, not the visitor's screen; the frame is then scaled to fit its
   column (or, with `narrow`, shown as r3's zoomed, sideways-scrolling preview at ≤1100px).
   Client-only: the prerendered HTML holds the frame, the bar and an empty iframe of fixed size; the app is
   portalled in after hydration, so dates follow the visitor's locale with no hydration mismatch and no
   layout shift. The window is a picture: the iframe is inert (no pointer, no focus, hidden from assistive
   tech) and the box carries a text label instead. Docs: local://app-window.md. */

export const DESIGN_WIDTH = 1280
/** Height of the app area (the iframe), below the bar. */
export const APP_HEIGHT = 680
const BAR_HEIGHT = 38
const BORDER = 1
/** The window: the app plus its 1px border on each side. */
export const FRAME_WIDTH = DESIGN_WIDTH + 2 * BORDER

const SRC_DOC = '<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body><div id="adw-root"></div></body></html>'

/* Inside the iframe: the window's canvas padding and card chrome belong to our frame, the body is the
   app's 14px (the site's index.css sets 15px), and the cut at the bottom fades like r3's crop. */
const FRAME_CSS = `
html, body { margin: 0; overflow: hidden; background: var(--surface); }
body { font-size: 14px; }
#adw-root > div { padding: 0; }
#adw-root > div > div { border: 0; border-radius: 0; box-shadow: none; max-width: none; }
#adw-root main { -webkit-mask-image: linear-gradient(#000 calc(100vh - 40px), transparent 100vh); mask-image: linear-gradient(#000 calc(100vh - 40px), transparent 100vh); }
`

const subscribeNever = () => () => {}

/** True after hydration, false on the server and during the hydration render. */
export function useHydrated() {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  )
}

/**
 * Renders `<div {...props}>` and mounts `children` in it only after hydration, so locale- and clock-dependent
 * app UI never runs during prerender. Size the box yourself (width/height/aspect-ratio) so nothing moves when
 * the children arrive.
 */
export function ClientOnly({ children, fallback = null, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode; fallback?: ReactNode }) {
  return <div {...props}>{useHydrated() ? children : fallback}</div>
}

/** Handle on a mounted window, for callers that measure or animate its insides (the hero). */
export type AppWindowApi = {
  /** The outer box (sizer); `frame` is the scaled element inside it, `win` the bordered window. */
  root: HTMLDivElement
  frame: HTMLDivElement
  win: HTMLDivElement
  iframe: HTMLIFrameElement
  /** The iframe's document; query the app with `doc.querySelector('[data-slot="cashOnHand"]')` etc. */
  doc: Document
  /** The app's `<main>` (data-hx="main"). */
  main: HTMLElement
  /** Rect of an element inside the iframe in page (top-level viewport) coordinates, every scale applied. */
  rect: (el: Element) => DOMRect
  /** Current on-screen scale of the app: page px per app px. */
  scale: () => number
}

type Props = {
  /** The view on show (title, sidebar entry, header). */
  view: View
  /** Views kept mounted; defaults to `[view]`. Inactive ones are `hidden` unless `keepVisible`. */
  views?: readonly View[]
  keepVisible?: boolean
  /** `fit`: scale to the box's width (box height follows). `none`: natural size, the caller transforms it. */
  scale?: 'fit' | 'none'
  /** At ≤1100px, r3's framed preview instead: zoom .62 (.46 at ≤620px), scroll sideways. */
  narrow?: boolean
  appHeight?: number
  /** Text in the header's ask box (the hero types into it). */
  askText?: string
  /** Sidebar entries that are views call this; Rules and Settings do nothing. */
  onNavigate?: (view: View) => void
  onReady?: (api: AppWindowApi) => void
  /** Text alternative for the picture. */
  label?: string
  className?: string
  style?: CSSProperties
}

export function AppWindowDemo({
  view,
  views,
  keepVisible = false,
  scale = 'fit',
  narrow = false,
  appHeight = APP_HEIGHT,
  askText = '',
  onNavigate,
  onReady,
  label = 'The Fluide app with sample data',
  className = '',
  style,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const winRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [mount, setMount] = useState<HTMLElement | null>(null)
  const [shown, setShown] = useState(false)
  const totalHeight = BAR_HEIGHT + appHeight + 2 * BORDER

  /* fit: scale = box width / design width, set before the frame is shown */
  useLayoutEffect(() => {
    const root = rootRef.current
    if (scale !== 'fit' || !root) return
    const fit = () => {
      root.style.setProperty('--adw-s', String(root.clientWidth / FRAME_WIDTH))
      root.setAttribute('data-scaled', '')
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(root)
    return () => ro.disconnect()
  }, [scale])

  /* the iframe: clone the page's stylesheets in once, then portal the app into it */
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    let cancelled = false
    const init = () => {
      const doc = iframe.contentDocument
      const host = doc?.getElementById('adw-root')
      if (!doc || !host || doc.head.querySelector('[data-adw]')) return
      const loads: Promise<unknown>[] = []
      for (const node of document.head.querySelectorAll('link[rel="stylesheet"], style')) {
        const copy = node.cloneNode(true) as HTMLElement
        if (copy instanceof HTMLLinkElement)
          loads.push(
            new Promise<void>((resolve) => {
              copy.addEventListener('load', () => resolve(), { once: true })
              copy.addEventListener('error', () => resolve(), { once: true })
            }),
          )
        doc.head.append(copy)
      }
      const own = doc.createElement('style')
      own.setAttribute('data-adw', '')
      own.textContent = FRAME_CSS
      doc.head.append(own)
      setMount(host)
      void Promise.all(loads)
        .then(() => doc.fonts.ready)
        .then(() => !cancelled && setShown(true))
    }
    if (iframe.contentDocument?.readyState === 'complete' && iframe.contentDocument.getElementById('adw-root')) init()
    else iframe.addEventListener('load', init, { once: true })
    return () => {
      cancelled = true
      iframe.removeEventListener('load', init)
    }
  }, [])

  /* inert hooks for callers: data-hx on <main>, data-slot on the header's title block */
  useLayoutEffect(() => {
    if (!mount || !shown) return
    const doc = mount.ownerDocument
    const main = doc.querySelector('main')
    main?.setAttribute('data-hx', 'main')
    main?.querySelector('header > div:first-child')?.setAttribute('data-slot', 'hello')
    const root = rootRef.current
    const frame = frameRef.current
    const win = winRef.current
    const iframe = iframeRef.current
    if (!onReady || !main || !root || !frame || !win || !iframe) return
    const pageScale = () => iframe.getBoundingClientRect().width / iframe.offsetWidth
    onReady({
      root,
      frame,
      win,
      iframe,
      doc,
      main,
      scale: pageScale,
      rect: (el) => {
        const box = iframe.getBoundingClientRect()
        const s = pageScale()
        const r = el.getBoundingClientRect()
        return new DOMRect(box.left + r.left * s, box.top + r.top * s, r.width * s, r.height * s)
      },
    })
    // onReady is a callback prop; re-announcing on every parent render would be noise
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mount, shown])

  /* same element across mount/shown re-renders, so React doesn't re-render the whole app inside the frame
     (~54ms) when the styles land; pass a stable `views` array (module constant) to keep this cheap */
  const screen = useMemo(
    () => <AppScreen view={view} views={views ?? [view]} keepVisible={keepVisible} askText={askText} onNavigate={onNavigate} />,
    [view, views, keepVisible, askText, onNavigate],
  )

  const sizer =
    scale === 'fit'
      ? ({ aspectRatio: `${FRAME_WIDTH} / ${totalHeight}` } as CSSProperties)
      : ({ width: FRAME_WIDTH, height: totalHeight } as CSSProperties)

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={label}
      data-scale={scale}
      data-narrow={narrow ? '' : undefined}
      className={`adw ${className}`}
      style={{ ...sizer, ['--adw-h' as string]: `${totalHeight}px`, ...style }}
    >
      <div ref={frameRef} data-hx="frame" className="adw-frame" style={{ width: FRAME_WIDTH }}>
        <div ref={winRef} data-hx="win" className="adw-win overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-2">
          <div aria-hidden className="flex items-center gap-2 border-b border-line bg-surface-2 px-3.5" style={{ height: BAR_HEIGHT }}>
            <span className="flex gap-[5px]">
              <i className="block size-[9px] rounded-full bg-line" />
              <i className="block size-[9px] rounded-full bg-line" />
              <i className="block size-[9px] rounded-full bg-line" />
            </span>
            <span className="ml-1.5 font-mono text-[11px] text-ink-3">http://localhost:8080</span>
            <span className="ml-auto flex items-center gap-2">
              <span className="inline-flex h-[22px] items-center rounded-full border border-line-strong bg-surface px-2 text-[11px] font-semibold text-ink-2">
                read-only
              </span>
              <span className="inline-flex h-[22px] items-center gap-1 rounded-full border border-dashed border-ink px-2 text-[11px] font-semibold text-ink">
                <svg viewBox="0 0 12 12" className="size-[11px]" fill="none" stroke="currentColor" strokeWidth="1.3">
                  <circle cx="6" cy="6" r="4.6" />
                  <path d="M2.8 9.2 9.2 2.8" />
                </svg>
                Sample data
              </span>
            </span>
          </div>
          <iframe
            ref={iframeRef}
            srcDoc={SRC_DOC}
            title={label}
            tabIndex={-1}
            aria-hidden
            inert
            data-shown={shown ? '' : undefined}
            className="adw-app block border-0"
            style={{ width: DESIGN_WIDTH, height: appHeight }}
          />
        </div>
      </div>
      {mount && createPortal(screen, mount)}
    </div>
  )
}

const ROUTE_VIEW = Object.fromEntries(VIEWS.map((v) => [VIEW_ROUTE[v], v])) as Record<string, View>

/** The app as apps/web's Shell renders it (Shell.tsx, Header.tsx, Sidebar.tsx), at the sample world's clock. */
function AppScreen({
  view,
  views,
  keepVisible,
  askText,
  onNavigate,
}: {
  view: View
  views: readonly View[]
  keepVisible: boolean
  askText: string
  onNavigate?: (view: View) => void
}) {
  const route = VIEW_ROUTE[view]
  const current = NAV.find((item) => item.to === route) ?? NAV[0]
  const date = new Date(NOW)
  const dateStr = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(date)
  const subtitle = route === '/review' ? `${reviewQueue.length} waiting` : HEADER_SUBTITLE[route]
  const topLine = subtitle ? `${dateStr} · ${subtitle}` : `${getGreeting(date)} · ${getDaysLeft(date)}`

  return (
    <AppWindow
      sidebar={
        <AppSidebar
          items={NAV}
          reviewCount={reviewQueue.length}
          currentLabel={current.label}
          renderLink={(item, children) => (
            <button
              type="button"
              aria-current={item.to === route ? 'page' : undefined}
              onClick={() => {
                const target = ROUTE_VIEW[item.to]
                if (target) onNavigate?.(target)
              }}
              className={`${NAV_LINK} ${item.to === route ? NAV_LINK_ACTIVE : NAV_LINK_INACTIVE}`}
            >
              {children}
            </button>
          )}
        />
      }
    >
      <HeaderView topLine={topLine} title={current.label}>
        {/* hidden, not unmounted, on the Assistant (the app drops it there): the hero docks into this node */}
        <div data-slot="headerAsk" hidden={view === 'assistant'}>
          <HeaderAskBox value={askText} onChange={() => {}} onSubmit={() => {}} />
        </div>
        <div className="flex flex-none gap-2">
          <HeaderButton title="Sync connections" label="Sync">
            <SyncIcon />
          </HeaderButton>
          <HeaderButton title="Hide amounts" label="Hide amounts" pressed={false}>
            <HideAmountsIcon hidden={false} />
          </HeaderButton>
          <HeaderButton title="Dark theme" label="Toggle theme" pressed={false}>
            <ThemeIcon />
          </HeaderButton>
        </div>
      </HeaderView>
      <div data-hx="views" className="flex min-w-0 flex-1 flex-col">
        {views.map((v) => {
          const Screen = VIEW_COMPONENT[v]
          return (
            <div key={v} data-view={v} hidden={v !== view && !keepVisible} className={v === 'assistant' ? 'min-w-0' : 'flex min-w-0 flex-1 flex-col'}>
              <Screen />
            </div>
          )
        })}
      </div>
    </AppWindow>
  )
}
