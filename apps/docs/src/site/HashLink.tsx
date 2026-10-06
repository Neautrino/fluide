import { Link, useLocation } from '@tanstack/react-router'
import type { ReactNode } from 'react'

type Props = { to: '/' | '/manifesto' | '/docs'; hash: string; className?: string; 'aria-label'?: string; children: ReactNode }

/**
 * A link to a section of a page: a plain `#anchor` on that page itself, a router Link from anywhere else.
 * A router Link to the page you're on would be marked `aria-current="page"`, and with a hash in the URL it
 * would render differently on the client than in the prerendered HTML.
 */
export function HashLink({ to, hash, className, 'aria-label': label, children }: Props) {
  const here = useLocation({ select: (l) => l.pathname === to })
  return here ? (
    <a href={`#${hash}`} className={className} aria-label={label}>
      {children}
    </a>
  ) : (
    <Link to={to} hash={hash} className={className} aria-label={label}>
      {children}
    </Link>
  )
}
