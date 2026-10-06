import Lenis from 'lenis'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { gsap, MOTION_QUERY, ScrollTrigger } from './gsap'

export type Motion = {
  /** true while the motion gate (MOTION_QUERY) matches; always false during prerender and first render */
  motion: boolean
  /** the smooth scroller, only inside the motion gate */
  lenis: Lenis | null
}

const OFF: Motion = { motion: false, lenis: null }
const MotionContext = createContext<Motion>(OFF)

export const useMotion = () => useContext(MotionContext)

/**
 * Site-wide smooth scrolling, ported from r3/shared/fl-core.js (FL.motion.init) with the Lenis tuning
 * r4/hero/hero.js shipped. Set up only while the motion gate matches (crossing it at runtime sets up or
 * tears down), and torn down on unmount.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Motion>(OFF)

  useEffect(() => {
    const mm = gsap.matchMedia()
    mm.add(MOTION_QUERY, () => {
      const root = document.documentElement
      root.classList.add('is-motion')
      ScrollTrigger.config({ ignoreMobileResize: true })
      /* lerp .07 + wheelMultiplier .85: a softer, slightly slower glide than Lenis defaults */
      const lenis = new Lenis({ lerp: 0.07, wheelMultiplier: 0.85, smoothWheel: true })
      lenis.on('scroll', ScrollTrigger.update)
      const raf = (t: number) => lenis.raf(t * 1000)
      gsap.ticker.add(raf)
      gsap.ticker.lagSmoothing(0)
      /* pins on a smooth-scrolled page jitter unless they are fixed */
      ScrollTrigger.defaults({ pinType: 'fixed' })
      setState({ motion: true, lenis })
      return () => {
        gsap.ticker.remove(raf)
        gsap.ticker.lagSmoothing(500, 33)
        lenis.destroy()
        root.classList.remove('is-motion')
        setState(OFF)
      }
    })
    return () => mm.revert()
  }, [])

  return <MotionContext value={state}>{children}</MotionContext>
}
