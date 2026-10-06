import { LogoMark } from '@repo/ui/brand'
import { Link, useLocation } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { GITHUB, pill } from './ds'
import { HashLink } from './HashLink'

const NAV_LINK =
  'text-ink-2 transition-colors duration-200 hover:text-ink aria-[current=page]:text-ink aria-[current=page]:underline aria-[current=page]:decoration-[1.5px] aria-[current=page]:underline-offset-[6px]'

/** Fixed on every page: clear at the very top, a canvas bar with a rule once the page has scrolled. */
export function SiteNav() {
  const home = useLocation({ select: (l) => l.pathname === '/' })
  const [solid, setSolid] = useState(false)

  useEffect(() => {
    const update = () => setSolid(window.scrollY > 4)
    update()
    addEventListener('scroll', update, { passive: true })
    return () => removeEventListener('scroll', update)
  }, [])

  const brand = (
    <>
      <LogoMark className="size-6 flex-none" />
      <span className="max-[420px]:hidden">
        fluide<i className="-ml-[0.12em] text-ink-3 not-italic">_</i>
      </span>
    </>
  )
  const brandClass =
    'inline-flex items-center gap-2.5 font-display text-[22px] leading-none font-extrabold tracking-[-0.02em] text-ink [font-stretch:125%]'

  return (
    <header
      data-solid={solid || undefined}
      className="fixed inset-x-0 top-0 z-60 flex h-[72px] items-center justify-between px-[max(24px,calc(50vw-600px))] [word-spacing:.05em] transition-[background-color,box-shadow] duration-300 data-solid:bg-canvas data-solid:shadow-[0_1px_0_var(--line-strong)] max-[560px]:px-4"
    >
      {home ? (
        <a className={brandClass} href="#top" aria-label="Fluide home">
          {brand}
        </a>
      ) : (
        <Link className={brandClass} to="/" aria-label="Fluide home">
          {brand}
        </Link>
      )}
      <nav
        aria-label="Primary"
        className="absolute left-1/2 flex -translate-x-1/2 gap-[34px] text-[14.5px] font-semibold max-[1000px]:static max-[1000px]:mr-5 max-[1000px]:ml-auto max-[1000px]:translate-x-0 max-[1000px]:gap-5 max-[560px]:mr-3 max-[560px]:gap-3.5 max-[560px]:text-sm max-[400px]:mr-2.5 max-[400px]:gap-2.5 max-[400px]:text-[13px]"
      >
        <Link to="/manifesto" className={NAV_LINK}>
          Manifesto
        </Link>
        <Link to="/docs" className={NAV_LINK}>
          Docs
        </Link>
        <HashLink to="/" hash="changelog" className={NAV_LINK}>
          Changelog
        </HashLink>
      </nav>
      <div className="flex items-center gap-[22px]">
        <a className={`${pill('outline')} max-[760px]:hidden`} href={GITHUB}>
          Source on GitHub
        </a>
        <HashLink
          to="/docs"
          hash="install"
          className={`${pill('solid')} max-[560px]:h-[34px] max-[560px]:px-3.5 max-[560px]:text-[13px] max-[400px]:px-3`}
        >
          Self-host it
        </HashLink>
      </div>
    </header>
  )
}
