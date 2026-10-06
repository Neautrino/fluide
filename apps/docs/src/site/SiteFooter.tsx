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
  ['backups', 'Backups'],
] as const

const LINK = 'text-[#b9bcc2] transition-colors duration-200 hover:text-white focus-visible:outline-[#ececea]'

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="font-mono text-[11.5px] leading-[normal] font-semibold tracking-[0.08em] text-[#6e7178] uppercase">{title}</h4>
      <ul className="mt-3.5 flex flex-col gap-2.5 text-[14px] leading-[1.5]">{children}</ul>
    </div>
  )
}

/**
 * The dark site footer (option 2 of r4/cta/cta.css .f2--dark, DS01 skin of r4/ds/ds.css). On the landing
 * its first column links to the sections on the page and it enters like the sections do.
 */
export function SiteFooter() {
  const home = useLocation({ select: (l) => l.pathname === '/' })
  const reveal = useRevealScope<HTMLElement>(home)

  return (
    <footer {...reveal} className="bg-[#0b0b0c] px-6 pt-16 pb-10 text-[13px] text-[#8a8d93]">
      <div className="mx-auto max-w-[1180px]">
        <Reveal kind="each">
          <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] gap-8 max-[1000px]:grid-cols-2">
            <div className="max-[1000px]:col-span-full">
              <span className="inline-flex items-center gap-2.5 font-display text-[19px] font-extrabold tracking-[-0.02em] text-[#ececea] [font-stretch:125%]">
                <LogoMark className="size-[21px] flex-none" />
                <span>
                  fluide<i className="-ml-[0.12em] text-[#75777e] not-italic">_</i>
                </span>
              </span>
              <p className="mt-3.5 max-w-[22em] text-sm leading-normal text-[#b9bcc2]">
                A read-only ledger for your US bank accounts, on your own computer.
              </p>
            </div>
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
          </div>
        </Reveal>
        <Reveal kind="block">
          <div className="mt-[52px] flex flex-wrap justify-between gap-x-6 gap-y-2.5 border-t border-[#3a3a3e] pt-5 text-[12.5px]">
            <span>Read-only · self-hosted · US banks through Plaid</span>
            <span className="text-[#6e7178]">Bank names and logos belong to their owners. Fluide isn't affiliated with them.</span>
          </div>
        </Reveal>
      </div>
    </footer>
  )
}
