import { useEffect, useState } from 'react'
import { scrollToSection } from './scroll'
import { plural } from './time'

const SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'connections', label: 'Connections' },
  { id: 'assistant', label: 'Assistant' },
  { id: 'categorization', label: 'Categorization' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

function currentSection(): SectionId {
  const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
  if (atBottom && window.scrollY > 0) return SECTIONS[SECTIONS.length - 1].id
  let current: SectionId = SECTIONS[0].id
  for (const s of SECTIONS) {
    const el = document.getElementById(s.id)
    if (el && el.getBoundingClientRect().top < 160) current = s.id
  }
  return current
}

export function SettingsNav({ brokenCount }: { brokenCount: number }) {
  const [active, setActive] = useState<SectionId>(SECTIONS[0].id)

  useEffect(() => {
    const onScroll = () => setActive(currentSection())
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      aria-label="Settings sections"
      className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-line pb-2 min-[1280px]:sticky min-[1280px]:top-6 min-[1280px]:flex-col min-[1280px]:items-stretch min-[1280px]:gap-0.5 min-[1280px]:border-r min-[1280px]:border-b-0 min-[1280px]:pr-3.5 min-[1280px]:pb-0"
    >
      {SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          aria-current={active === s.id ? 'location' : undefined}
          onClick={(e) => {
            e.preventDefault()
            setActive(s.id)
            scrollToSection(s.id)
          }}
          className={`flex items-center gap-2 rounded-sm border px-2.5 py-2 text-[13px] ${
            active === s.id ? 'border-line-strong bg-surface font-semibold text-ink' : 'border-transparent font-medium text-ink-2 hover:text-ink'
          }`}
        >
          {s.label}
          {s.id === 'connections' && brokenCount > 0 && (
            <span
              title={plural(brokenCount, 'broken connection')}
              className="figures ml-auto rounded-[8px] border border-broken px-1.5 text-[10.5px] font-bold text-broken"
            >
              <span aria-hidden>{brokenCount}</span>
              <span className="sr-only">, {plural(brokenCount, 'broken connection')}</span>
            </span>
          )}
        </a>
      ))}
    </nav>
  )
}
