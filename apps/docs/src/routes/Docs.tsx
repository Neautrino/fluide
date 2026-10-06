import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { DISPLAY } from '../site/ds'
import { SectionTag } from '../site/SectionTag'

/* The self-hosting guide. Commands are exact, since they have to work when pasted. */

const TOC = [
  ['requirements', 'Requirements'],
  ['install', 'Install'],
  ['first-start', 'First start'],
  ['update', 'Update'],
  ['stop', 'Stop'],
  ['security-model', 'Security model'],
  ['what-leaves', 'What leaves your computer'],
  ['backups', 'Backups'],
  ['restore', 'Restore'],
] as const

const OUTBOUND: [goesTo: string, when: ReactNode, what: string][] = [
  ['Plaid', 'When you link or sync a bank', 'Requests made with your Plaid keys; Plaid returns your bank accounts and transactions.'],
  [
    'Your categorization model',
    'Only when one is set up and you run categorization, or press Test',
    'The descriptions of transactions no rule matched, and your category names. Test sends 25 made-up descriptions instead.',
  ],
  [
    'Your chat model',
    'Only when one is set up and you use the Assistant, or press Test',
    'Your question and the results of the read-only ledger queries the Assistant runs, such as account balances, account masks and up to 50 transactions per query. A local server, for example Ollama, keeps this on your computer.',
  ],
  ['The model provider whose list you load', 'Only when you press Load models', "A request for that provider's list of models, with your key."],
  [
    'LangSmith',
    <>
      Only if you set its tracing environment variables (for example <C>LANGSMITH_TRACING</C> and <C>LANGSMITH_API_KEY</C>)
    </>,
    'Traces of Assistant runs.',
  ],
  [
    'GitHub',
    <>
      At most once a day, when you open Settings, unless <C>FLUIDE_UPDATE_CHECK=off</C>
    </>,
    'A request for the latest Fluide release. GitHub sees your IP address and the version of Fluide asking.',
  ],
]

function C({ children }: { children: ReactNode }) {
  return <code className="rounded-md bg-canvas px-1.5 py-px font-mono text-[.88em] font-medium text-ink">{children}</code>
}

function B({ children }: { children: ReactNode }) {
  return <b className="font-semibold text-ink">{children}</b>
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-3.5">{children}</p>
}

function List({ ordered, children }: { ordered?: boolean; children: ReactNode }) {
  const Tag = ordered ? 'ol' : 'ul'
  return <Tag className={`mt-3.5 flex flex-col gap-2 pl-[22px] ${ordered ? 'list-decimal' : 'list-disc'}`}>{children}</Tag>
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`h-${id}`} className="pt-2 [section+&]:mt-14 [section+&]:border-t [section+&]:border-line [section+&]:pt-12">
      <h2 id={`h-${id}`} className={`${DISPLAY} text-[30px] leading-[1.05] tracking-[-0.03em] text-ink max-[560px]:text-[26px]`}>
        {title}
      </h2>
      {children}
    </section>
  )
}

/** A command block. Copy copies the commands without the "$ " prompts or the "# …" comments. */
function Cmd({ lines }: { lines: [command: string, comment?: string][] }) {
  const pre = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])

  const copy = () => {
    const text = (pre.current?.textContent ?? '')
      .split('\n')
      .map((l) => l.replace(/^\$ /, '').replace(/\s+#.*$/, ''))
      .filter((l) => l.trim())
      .join('\n')
    navigator.clipboard?.writeText(text).then(() => setCopied(true), () => {})
  }

  return (
    <div className="relative mt-4 rounded-lg bg-surface-inverse px-[18px] pt-11 pb-4">
      <button
        type="button"
        data-theme="dark"
        aria-label="Copy commands"
        onClick={copy}
        className={`absolute top-2.5 right-2.5 h-[26px] rounded-md border bg-canvas px-2.5 font-sans text-xs font-semibold focus-visible:outline-ink ${
          copied ? 'border-positive text-positive' : 'border-line text-ink-2 hover:border-ink-3 hover:text-ink'
        }`}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre ref={pre} data-theme="dark" className="m-0 overflow-x-auto font-mono text-[13.5px] leading-[1.75] font-medium whitespace-pre text-ink [scrollbar-width:thin]">
        {lines.map(([command, comment], i) => (
          <Fragment key={i}>
            {i > 0 && '\n'}
            <span className="text-ink-3 select-none">$ </span>
            {command}
            {comment && (
              <>
                {'   '}
                <span className="text-ink-3"># {comment}</span>
              </>
            )}
          </Fragment>
        ))}
      </pre>
    </div>
  )
}

export function Docs() {
  const [active, setActive] = useState<string | null>(null)

  // the contents list follows the section on screen
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id)
      },
      { rootMargin: '-96px 0px -70% 0px' },
    )
    for (const s of document.querySelectorAll('#docs-article section[id]')) io.observe(s)
    return () => io.disconnect()
  }, [])

  return (
    <main className="bg-surface">
      <header className="border-b border-line bg-linear-to-b from-canvas to-surface px-6 pt-[152px] pb-12 max-[560px]:px-5 max-[560px]:pt-[120px] max-[560px]:pb-9">
        <div className="mx-auto max-w-[1180px]">
          <SectionTag numbered={false} className="mb-[22px]">
            Docs
          </SectionTag>
          <h1 className={`${DISPLAY} text-[clamp(36px,4.2vw,62px)] leading-[.98] text-ink`}>Run Fluide on your computer.</h1>
          <p className="mt-[18px] max-w-[38em] text-lg leading-[1.55] text-ink-2">
            Install it with Docker, keep it up to date, back it up, and see exactly what it sends where.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1180px] grid-cols-[220px_minmax(0,1fr)] gap-16 px-6 pt-12 pb-[120px] max-[900px]:grid-cols-1 max-[900px]:gap-7 max-[560px]:px-5 max-[560px]:pt-8 max-[560px]:pb-24">
        <nav aria-label="On this page" className="sticky top-24 self-start max-[900px]:static">
          <h2 className="font-mono text-[11.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">On this page</h2>
          <ol className="mt-3.5 flex flex-col gap-0.5 border-l border-line max-[900px]:flex-row max-[900px]:flex-wrap max-[900px]:gap-1.5 max-[900px]:border-l-0">
            {TOC.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  data-on={active === id || undefined}
                  className="-ml-px block border-l-2 border-transparent py-1.5 pl-3.5 text-sm text-ink-2 transition-colors duration-200 hover:text-ink data-on:border-ink data-on:font-semibold data-on:text-ink max-[900px]:m-0 max-[900px]:rounded-full max-[900px]:border max-[900px]:border-line max-[900px]:px-2.5 max-[900px]:data-on:border-ink"
                >
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article id="docs-article" className="max-w-[760px] min-w-0 text-base leading-[1.65] text-ink-2">
          <Section id="requirements" title="Requirements">
            <List>
              <li>
                <B>Docker Engine 28.3.3 or newer</B>, with Docker Compose v2 (<C>docker compose</C>).
              </li>
              <li>
                <B>A Plaid account and its API keys.</B> Each install brings its own keys. Fluide uses Plaid's production environment, with
                real banks, by default, which needs Plaid to approve your Plaid account. To try it with Plaid's test banks, set{' '}
                <C>PLAID_ENV=sandbox</C> in <C>.env</C> and use your sandbox keys.
              </li>
            </List>
            <P>Fluide links US banks only. It never moves money: the only Plaid product it asks for is Transactions.</P>
          </Section>

          <Section id="install" title="Install">
            <Cmd
              lines={[
                ['git clone https://github.com/Neautrino/fluide.git'],
                ['cd fluide'],
                ['cp .env.example .env', 'optional: set PLAID_ENV'],
                ['docker compose up -d --build'],
              ]}
            />
            <P>
              Open <C>http://localhost:8080</C>, then:
            </P>
            <List ordered>
              <li>
                Go to <B>Settings → Provider keys</B> and enter your Plaid client id and secret.
              </li>
              <li>
                Click <B>Connect US bank</B> and link an account through Plaid. You sign in to your bank in Plaid's own window.
              </li>
              <li>
                Optional: in <B>Settings → Assistant</B>, pick a categorization model (TypeSafe, OpenCode Zen, OpenRouter or your own
                compatible host) and a chat model (OpenAI, Claude, Gemini, OpenCode Zen, OpenRouter or any OpenAI-compatible server, such as
                a local Ollama), and test each connection.
              </li>
            </List>
            <P>
              <C>PLAID_ENV</C> in <C>.env</C> picks the Plaid environment, <C>production</C> (the default) or <C>sandbox</C>, and must match
              the keys you enter.
            </P>
          </Section>

          <Section id="first-start" title="What happens on first start">
            <List ordered>
              <li>
                The database passwords and a 32-byte encryption key are generated, each in its own storage volume. Existing ones are never
                overwritten.
              </li>
              <li>The database is created.</li>
              <li>
                The database is brought up to date, and the app's own database user is created without admin rights. This runs on every
                start and does nothing when everything is already current.
              </li>
              <li>
                The app starts and serves Fluide on <C>http://localhost:8080</C>.
              </li>
            </List>
            <P>You don't create any of these passwords or keys yourself.</P>
          </Section>

          <Section id="update" title="Update">
            <Cmd lines={[['git pull && docker compose up -d --build']]} />
            <P>The database is brought up to date for the new version before the app starts.</P>
            <P>
              When a newer release is out, <B>Settings → General</B> shows "Update available" with a link to the release notes and this
              command to copy. Fluide never updates itself.
            </P>
          </Section>

          <Section id="stop" title="Stop">
            <Cmd lines={[['docker compose down']]} />
            <P>
              Your data stays in Docker's volumes and is there again on the next <C>docker compose up -d</C>.
            </P>
            <div className="mt-[18px] flex gap-3 rounded-lg border border-line-strong bg-warning-wash px-4 py-3.5">
              <b className="flex-none font-semibold text-warning">Careful</b>
              <p className="m-0 text-[15px] text-ink-2">
                <C>docker compose down -v</C> deletes the volumes: the database <B>and</B> the encryption key. Without a backup, everything
                is gone.
              </p>
            </div>
          </Section>

          <Section id="security-model" title="Security model">
            <List>
              <li>
                The app answers on <C>127.0.0.1:8080</C> only, so it's reachable from the computer it runs on, not from your network.
              </li>
              <li>
                The database isn't published at all; it sits on a private network inside the install. The app connects to it as a user
                without admin, create-database or create-user rights. Only the step that brings the database up to date uses the admin
                account.
              </li>
              <li>
                Bank access tokens and provider keys (your Plaid client id and secret) are encrypted at rest with AES-256-GCM. The encryption
                key lives in its own volume, apart from the database.
              </li>
              <li>
                The server refuses requests addressed to any other host name (protection against DNS rebinding) and refuses cross-site write
                requests.
              </li>
              <li>The app runs as a regular user, with a read-only filesystem and no special system permissions.</li>
              <li>
                <B>There is no login yet.</B> Anyone and any program that can reach <C>localhost:8080</C> on that computer can use Fluide.
                Don't expose or forward the port.
              </li>
              <li>
                Access from your network or from elsewhere isn't supported yet. <C>FLUIDE_ALLOWED_HOSTS</C> (extra host names to accept) is
                only for advanced setups behind your own reverse proxy that does the sign-in.
              </li>
            </List>
          </Section>

          <Section id="what-leaves" title="What leaves your computer">
            <div className="overflow-x-auto">
              <table className="mt-[18px] w-full border-collapse text-[14.5px] leading-[1.55] max-[560px]:min-w-[560px]">
                <thead>
                  <tr>
                    {['Goes to', 'When', 'What'].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="border-b border-line-strong px-3 py-2.5 text-left font-mono text-[11.5px] font-semibold tracking-[0.06em] text-ink-3 uppercase"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {OUTBOUND.map(([goesTo, when, what]) => (
                    <tr key={goesTo}>
                      <td className="w-[22%] border-b border-line px-3 py-3.5 align-top font-semibold text-ink">{goesTo}</td>
                      <td className="border-b border-line px-3 py-3.5 align-top">{when}</td>
                      <td className="border-b border-line px-3 py-3.5 align-top">{what}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="backups" title="Backups">
            <P>
              A usable backup needs <B>both</B> the database and the encryption key. The database holds bank connections and provider keys
              only in encrypted form; without the matching key they can't be read, and you would have to enter your Plaid keys again and
              re-link every bank. Keep the two files apart.
            </P>
            <P>
              Back up while the database is running (<C>docker compose up -d</C>, or <C>docker compose up -d --wait db</C>):
            </P>
            <Cmd
              lines={[
                ['docker compose exec -T db pg_dump -U postgres fluide > fluide.sql'],
                ['docker compose run --rm --no-deps -T --entrypoint cat secrets-init /secrets/vault/key > vault.key'],
              ]}
            />
            <P>
              The first command saves the database to <C>fluide.sql</C>; the second saves the encryption key to <C>vault.key</C>.
            </P>
          </Section>

          <Section id="restore" title="Restore">
            <P>
              On a fresh copy, before a full <C>docker compose up -d</C>:
            </P>
            <Cmd
              lines={[
                ['docker compose up -d --wait db'],
                ["docker compose run --rm --no-deps -T --entrypoint sh secrets-init -c 'cat > /secrets/vault/key' < vault.key"],
                ['docker compose exec -T db psql -U postgres -d fluide < fluide.sql'],
                ['docker compose up -d'],
              ]}
            />
            <List ordered>
              <li>Start only the database. This first creates new passwords, a new encryption key and an empty database.</li>
              <li>Replace the new encryption key with your backed-up one.</li>
              <li>
                Load your backup into the empty database. Errors saying the app's database user doesn't exist are expected; the next step
                creates it.
              </li>
              <li>
                Start everything. The database is found up to date, and the app's user is created with its new password and permissions.
              </li>
            </List>
            <P>
              If this install has already been started, its database isn't empty any more: run <C>docker compose down -v</C> first, which
              deletes its current data and encryption key.
            </P>
          </Section>

          <p className="mt-16 border-t border-line pt-6 text-sm text-ink-3">
            This page follows the{' '}
            <a
              href="https://github.com/Neautrino/fluide#readme"
              className="text-ink underline decoration-ink-3 underline-offset-[3px] hover:decoration-ink"
            >
              README on GitHub
            </a>
            . If they ever differ, the README is right.
          </p>
        </article>
      </div>
    </main>
  )
}
