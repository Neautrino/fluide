import { Children, cloneElement, isValidElement, useEffect, useRef, type ReactElement, type ReactNode } from 'react'

/* Section entrances, ported from r4/ds/reveal.js (measured from steep.app): headline words rise 1.15em
   while fading in, 0.5s strong ease-out, 70ms apart; the sub-line follows from 40px; links and buttons
   from 15px; blocks from 28px; `each` gives every child its own 28px step, 90ms apart. Plays once per
   scope as it comes into view. Moves with the `translate` property, never `transform`, so it can't
   fight GSAP. The hidden state is CSS (index.css), keyed on html.rv-on, which index.html's inline
   script sets before first paint unless motion is reduced: prerendered HTML never flashes, and under
   reduced motion nothing is hidden. */

export type RevealKind = 'words' | 'line' | 'link' | 'block' | 'each'

const WORD_MS = 70

/**
 * Makes an element a reveal scope (r4: each landing section and the footer). Spread the result on it:
 * `const reveal = useRevealScope<HTMLElement>(); <section {...reveal} id="…">`. Its <Reveal> descendants
 * get their delays here, in document order, and enter together once 15% of it is above the fold line.
 */
export function useRevealScope<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const scope = ref.current
    if (!enabled || !scope || !document.documentElement.classList.contains('rv-on')) return
    let t = 0 /* running delay in ms within this scope */
    for (const el of scope.querySelectorAll<HTMLElement>('[data-rv]')) {
      const kind = el.dataset.rv as RevealKind
      if (kind === 'words') {
        const words = el.querySelectorAll<HTMLElement>('.rv-w')
        /* 70ms per word, but a long headline never takes more than 0.7s to start its last word */
        const gap = words.length > 1 ? Math.min(WORD_MS, 700 / (words.length - 1)) : 0
        words.forEach((w, i) => w.style.setProperty('--d', `${Math.round(t + i * gap)}ms`))
        /* what follows starts 60ms after the last word */
        t += Math.round((words.length - 1) * gap) + 60
      } else if (kind === 'each') {
        for (const child of el.children) {
          ;(child as HTMLElement).style.setProperty('--d', `${t}ms`)
          t += 90
        }
      } else {
        el.style.setProperty('--d', `${t}ms`)
        t += 110
      }
    }
    /* once the last step has played (its delay + the 0.65s transition, rounded up), the scope is marked done
       and index.css stops applying the entrance transition, so every element gets its own transitions back
       (card scale/colour, hover fades); while the entrance runs, its transition replaces theirs */
    const doneAfter = t + 700
    let done = 0
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          /* an attribute, not a class: React rewrites className on re-render, never an attribute it doesn't own */
          scope.setAttribute('data-rv-in', '')
          done = window.setTimeout(() => scope.setAttribute('data-rv-done', ''), doneAfter)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -15% 0px', threshold: 0 },
    )
    io.observe(scope)
    return () => {
      io.disconnect()
      window.clearTimeout(done)
    }
  }, [enabled])

  return { ref, 'data-rv-scope': enabled ? '' : undefined }
}

type RevealTarget = ReactElement<{ children?: ReactNode; 'data-rv'?: RevealKind }>

/**
 * Marks its single child (a DOM element, or a component that spreads its props onto one) as one step of
 * the enclosing scope's entrance. `words` also splits the child's text into words, keeping inner
 * elements such as `<span className="text-ink-3">`.
 */
export function Reveal({ kind, children }: { kind: RevealKind; children: RevealTarget }) {
  return kind === 'words'
    ? cloneElement(children, { 'data-rv': kind }, splitWords(children.props.children))
    : cloneElement(children, { 'data-rv': kind })
}

function splitWords(node: ReactNode): ReactNode {
  return Children.map(node, (child) => {
    if (typeof child === 'string')
      return child
        .split(/(\s+)/)
        .filter(Boolean)
        .map((part, i) =>
          /^\s+$/.test(part) ? (
            part
          ) : (
            <span key={i} className="rv-w">
              {part}
            </span>
          ),
        )
    if (isValidElement<{ children?: ReactNode }>(child) && child.props.children != null)
      return cloneElement(child, undefined, splitWords(child.props.children))
    return child
  })
}
