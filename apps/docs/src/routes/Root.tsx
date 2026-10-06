import { Outlet, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import { SiteFooter } from '../components/SiteFooter'
import { SiteNav } from '../components/SiteNav'
import { MotionProvider } from '../motion/MotionProvider'
import { PAGES } from '../pages'

export function Root() {
  const pathname = useLocation({ select: (l) => l.pathname })

  // prerendered pages arrive with their head; keep it right on client-side navigation
  useEffect(() => {
    const page = PAGES[pathname]
    if (!page) return
    document.title = page.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', page.description)
  }, [pathname])

  return (
    <MotionProvider>
      <SiteNav />
      <Outlet />
      <SiteFooter />
    </MotionProvider>
  )
}
