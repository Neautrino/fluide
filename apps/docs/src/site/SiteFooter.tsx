import { LogoMark } from '@repo/ui/brand'
import { Link, useLocation } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Reveal, useRevealScope } from '../motion/reveal'
import { GITHUB } from './ds'
import { HashLink } from './HashLink'

const SECTIONS = [
  ['platform', 'Platform'],
  ['views', 'Views'],
  ['how', 'How it works'],
  ['ask', 'Assistant'],
  ['security', 'Security'],
  ['changelog', 'Changelog'],
] as const

const SELF_HOST = [
  ['requirements', 'Requirements'],
  ['install', 'Install'],
  ['update', 'Update'],
  ['backups', 'Backups and restore'],
] as const

const LINK = 'text-ink-2 transition-colors duration-200 hover:text-ink focus-visible:outline-ink'

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="font-mono text-[11.5px] leading-[normal] font-semibold tracking-[0.08em] text-ink-3 uppercase">{title}</h2>
      <ul className="mt-3.5 flex flex-col gap-2.5 text-[14px] leading-[1.5]">{children}</ul>
    </div>
  )
}

/** On the landing the first column links to the page's sections, and the footer enters like they do. */
export function SiteFooter() {
  const home = useLocation({ select: (l) => l.pathname === '/' })
  const reveal = useRevealScope<HTMLElement>(home)

  return (
    <footer {...reveal} className="bg-surface-inverse px-6 pt-16 pb-10 text-[13px]">
      <div data-theme="dark" className="mx-auto max-w-[1180px] text-ink-3">
        <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] gap-8 max-[1000px]:grid-cols-2">
          <Reveal kind="block">
            <div className="max-[1000px]:col-span-full">
              <HashLink
                to="/"
                hash="top"
                aria-label="Fluide home"
                className="inline-flex items-center gap-2.5 font-display text-[19px] font-extrabold tracking-[-0.02em] text-ink [font-stretch:125%]"
              >
                <LogoMark className="size-[21px] flex-none" />
                <span>
                  fluide<i className="-ml-[0.12em] text-ink-3 not-italic">_</i>
                </span>
              </HashLink>
              <p className="mt-3.5 max-w-[22em] text-sm leading-normal text-ink-2">
                A read-only ledger for your US bank accounts, on your own computer.
              </p>
            </div>
          </Reveal>
          {/* a subgrid, so the three link columns stay on the outer grid's tracks */}
          <Reveal kind="each">
            <nav aria-label="Footer" className="col-span-3 grid grid-cols-subgrid gap-y-8 max-[1000px]:col-span-full">
              <Column title={home ? 'On this page' : 'Fluide'}>
                {SECTIONS.map(([id, label]) => (
                  <li key={id}>
                    <HashLink className={LINK} to="/" hash={id}>
                      {label}
                    </HashLink>
                  </li>
                ))}
              </Column>
              <Column title="Self-host">
                {SELF_HOST.map(([id, label]) => (
                  <li key={id}>
                    <HashLink className={LINK} to="/docs" hash={id}>
                      {label}
                    </HashLink>
                  </li>
                ))}
              </Column>
              <Column title="About">
                <li>
                  <Link className={LINK} to="/manifesto">
                    Manifesto
                  </Link>
                </li>
                <li>
                  <HashLink className={LINK} to="/docs" hash="security-model">
                    Security model
                  </HashLink>
                </li>
                <li>
                  <HashLink className={LINK} to="/docs" hash="what-leaves">
                    What leaves your computer
                  </HashLink>
                </li>
                <li>
                  <a className={LINK} href={GITHUB}>
                    Source on GitHub
                  </a>
                </li>
                <li>
                  <a className={LINK} href={`${GITHUB}/issues`}>
                    Report an issue
                  </a>
                </li>
              </Column>
            </nav>
          </Reveal>
        </div>
        <Reveal kind="block">
          <div className="mt-[52px] border-t border-line pt-5 text-[12.5px]">
            Bank names and logos belong to their owners. Fluide isn't affiliated with them.
          </div>
        </Reveal>
      </div>
    </footer>
  )
}
