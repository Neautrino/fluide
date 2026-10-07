import { Reveal, useRevealScope } from '../motion/reveal'
import { HashLink } from '../site/HashLink'
import { SectionTag } from '../site/SectionTag'
import { DISPLAY, GITHUB, pill } from '../site/ds'
import './Changelog.css'

/** Entries from the app's commit history, dated as committed. */
const ENTRIES = [
  {
    date: '2026-10-07',
    label: 'October 7, 2026',
    title: 'Fluide 1.0',
    body: 'The first release: read-only bank sync, categorization and the assistant, in one docker-compose file.',
  },
  {
    date: '2026-10-03',
    label: 'October 3, 2026',
    title: 'Pages you can link to',
    body: 'Each view has its own address, so back, forward and bookmarks work.',
  },
  {
    date: '2026-10-02',
    label: 'October 2, 2026',
    title: 'Saved conversations',
    body: 'Assistant chats are kept, encrypted, in a list under the chat for 30 days.',
  },
  {
    date: '2026-10-02',
    label: 'October 2, 2026',
    title: 'Ask about any month',
    body: 'Last month, last year, or a month you name, like September.',
  },
]

const H3 = `${DISPLAY} tracking-[-0.02em] text-ink`

export function Changelog() {
  const reveal = useRevealScope<HTMLElement>()
  return (
    <section
      {...reveal}
      id="changelog"
      aria-labelledby="chg-t"
      className="px-6 pt-28 pb-30 text-ink max-[560px]:px-5 max-[560px]:pt-20 max-[560px]:pb-22"
    >
      <div className="mx-auto max-w-[1180px]">
        <Reveal kind="link">
          <SectionTag>Changelog</SectionTag>
        </Reveal>
        <Reveal kind="words">
          <h2
            id="chg-t"
            className={`${DISPLAY} mt-[22px] max-w-[18em] text-[clamp(30px,3.3vw,50px)] leading-none text-balance text-ink`}
          >
            Built in the open. <span className="font-bold text-ink-3">Every change is in the commit history.</span>
          </h2>
        </Reveal>
        <Reveal kind="link">
          <a className={`${pill('outline')} mt-6`} href={`${GITHUB}/commits/main`}>
            View all <span aria-hidden="true">→</span>
          </a>
        </Reveal>
        <Reveal kind="each">
          <div className="mt-16 grid grid-cols-4 max-[1000px]:grid-cols-2 max-[1000px]:gap-y-7 max-[560px]:grid-cols-1">
            {ENTRIES.map((e) => (
              <article
                key={e.title}
                className="min-h-[200px] border-l border-line-strong px-6 pb-7 max-[560px]:min-h-0 max-[560px]:pt-0 max-[560px]:pr-0 max-[560px]:pb-[22px] max-[560px]:pl-[18px]"
              >
                <time dateTime={e.date} className="block font-mono text-xs font-medium tracking-[0.02em] text-ink-3">
                  {e.label}
                </time>
                <h3 className={`${H3} mt-[18px] text-[17px] leading-[1.3]`}>{e.title}</h3>
                <p className="mt-1.5 text-[15px] leading-normal text-ink-3">{e.body}</p>
              </article>
            ))}
          </div>
        </Reveal>
        <Reveal kind="block">
          <div className="ua-ruler h-14 border-b border-line max-[1000px]:hidden" aria-hidden="true" />
        </Reveal>
        <Reveal kind="block">
          <div className="mt-14 flex flex-wrap items-center justify-between gap-6">
            <h3 className={`${H3} text-xl leading-[1.3]`}>
              Stay up to date. <span className="block text-ink-3">Settings tells you when a new version is out.</span>
            </h3>
            <HashLink to="/docs" hash="update" className={pill('outline', 'lg')}>
              How to update
            </HashLink>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
