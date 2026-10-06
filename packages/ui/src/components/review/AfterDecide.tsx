export function AfterDecide() {
  return (
    <section className="rounded-lg border border-line bg-surface px-4 py-4 shadow-1">
      <h3 className="font-display text-[17px] leading-tight font-bold text-ink">After you decide</h3>
      <ul className="mt-3 flex flex-col gap-2.5 text-[12.5px] leading-normal text-ink-2">
        <li>
          <b className="text-ink">Approve</b> files it and every other waiting item from this vendor under the suggested
          category, and saves a rule so the next ones are filed automatically.
        </li>
        <li>
          <b className="text-ink">Change category</b> files it and every other waiting item from this vendor under the
          category you pick, and saves a rule so the next ones are filed automatically.
        </li>
        <li>
          <b className="text-ink">Reject</b> leaves it uncategorized and still counted. No rule is saved.
        </li>
      </ul>
    </section>
  )
}
