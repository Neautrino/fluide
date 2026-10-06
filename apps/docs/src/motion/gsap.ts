import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/** The motion gate: the pinned/scrubbed layout and Lenis run only here. index.html's inline script uses
 *  the same query to set html.is-motion before first paint. */
export const MOTION_QUERY = '(min-width: 1180px) and (prefers-reduced-motion: no-preference)'

// registered once, in the browser only (prerendering imports this module too). ScrollTrigger is
// registered outside the gate because some scroll pieces have their own, wider media query.
if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger, useGSAP)

export { gsap, ScrollTrigger, useGSAP }
