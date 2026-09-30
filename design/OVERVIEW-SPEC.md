# Fluide Overview: agreed spec (founder-approved, 2026-09-30)

Paths (repo-relative):
- Page under work: design/pages/overview.html. Other pages: design/pages/*.html. Tokens: design/shared/tokens.css.
- Design system source of truth: design/index.html (sections 5–7).
- Visual reference the founder likes: ov-01-ledger-bento.html (kept in the founder's Obsidian vault, not in this repo). Its "Spend by month" card is the PLANNED look.

## Design-system rules (DS 01)
- Cards: `border:1px solid var(--line)`, `border-radius:var(--radius-lg)`, `box-shadow:var(--shadow-1)`, surface background.
- Black `--line-strong` 1px outlines ONLY on small pickable things: pastel tiles, round icon buttons, active nav, pills/chips, the stat tiles under charts (like ov-01's In/Out tiles). Never on content containers or tables.
- Card titles use the display font in sentence case (e.g. "Spend by month", "Upcoming", "Where it went"), as in ov-01 and DS 01. No small uppercase grey eyebrows as card titles. Freshness sits top-right as "● as of 2h ago".
- One solid black (`--surface-inverse`) card per page. On Overview that is the Needs-you strip.
- Hatch = not final. Dotted/dashed line = typical. Red only for broken (Chase). Sign shown by −/+ and words. Tabular figures, en-IN grouping, small paise that NEVER wrap onto a separate line. All money has class `amt`. Icons are inline SVG.
- Header ask box: soft `--line` border (DS 01), pill.

## Overview layout (top to bottom)
1. Header: eyebrow "Good morning, Subhendu · 1 day left in September", title "Overview"; ask box + '/' hint; 4 round buttons (sync, eye, half-circle theme, avatar S). No bell. Under it, 3 prompt chips (Why is Shopping up 38% this month? · Show the 4 items waiting for review · Biggest merchants this month). A chip opens a right drawer with the answer card.
2. Needs-you strip (the black card): problems only: "4 suggestions · ₹6,300 at stake · 1 possible transfer ₹25,000", red "Chase · reconnect", warning "ING · access ends in 12 days", quiet "5 others up to date ›", and a Review button.
3. Body = TWO INDEPENDENT COLUMNS (left 8/12, right 4/12). Each column is its own vertical stack, so cards flow up with no gaps. Do NOT use shared grid rows that force left and right cards to equal height.
   - Left column: (a) Cash on hand, (b) What you own & owe, (c) Latest transactions.
   - Right column: (a) Spend by month, (b) Upcoming, (c) Where it went.
4. Cash on hand: ₹1,24,300 (small .00), "+₹8,100 vs this day last month", "● as of 2h ago", "2 accounts ›", no account breakdown; wide daily closing-balance line for Sep (solid) vs Aug (dotted), labelled illustrative; ≤3 markers (salary + rent 1 Sep, hatched −₹25,000 possible transfer 28 Sep). Its content must not collide.
5. Spend by month: match the PLANNED screenshot / ov-01 exactly. Display-font title, "● as of 2h ago" top-right; y-axis 0 / 50k / 1L with light gridlines; value labels in L/k (88.2k, 1.04L, 97.8k, 1.13L, 1.01L); black bars Apr–Aug; Sep hatched with a dashed typical line; bold "Sep*" label; inverse pill "₹4,750 under typical" above Sep with a thin leader line to the bar; footnote "*Sep to day 29: ₹96,450 vs a typical ₹1,01,200 by this day (dashed line). Incl. ₹6,300 from 4 unreviewed · ₹25,000 possible transfer not counted."; then stat tiles as in ov-01 (outlined, round icon, "In · Sep +₹1,42,000", "Out · Sep −₹96,450"), plus Kept +₹45,550 (a third tile or one line under the tiles, whichever fits 4 columns cleanly).
6. What you own & owe: net worth ₹18,42,600, "+₹52,600 since end of Aug", "as of 1 Sep (oldest input)", small 12-month step line; 4 pastel tiles by kind: Cash ₹1,24,300 · Investments ₹19,85,700 · Cards −₹38,900 (13% of limit used meter) · Loans −₹2,28,500 (SBI car · EMI 7 Oct); one line "Held separately, not summed: €3,420.18 ING · $1,860.40 Chase (stale)". The card is only as tall as its content (no empty space).
7. Upcoming: display-font title + "expected" pill; "Expected out by 9 Oct −₹83,998"; rows with dashed date chips, name, account line, amount; ≈ on Regalia statement and Airtel; divider after Rent "next salary expected 1 Oct · amount not projected"; rows after payday slightly greyed.
8. Latest transactions: must reuse the SAME row component/visual language as design/pages/transactions.html (inspect it: day headings with date chips, merchant + account, category + provenance badge rule / model % / waiting %, amount with −/+ and small paise, hatched + struck possible-transfer row "not counted", dashed-outline waiting rows, EUR row labelled "EUR · not converted"). Header "12 new since Sunday · 9 by rule · 2 by model · 1 waiting"; inline [Confirm] on the transfer and [Review] on Amazon; "All transactions ›". No floating mid-column category gap.
9. Where it went: a DONUT/PIE chart (founder decision) with the centre figure "₹96,450 · out · Sep so far". Muted segments with one highlight (Shopping, black) and a "Shopping +38%" pill. Rent shown as fixed (its own labelled segment or a "Fixed: Rent ₹32,000" line). Legend list beside or below the donut: Rent 32,000 · Groceries 14,820 · Shopping 11,380 (+38% vs typical) · Other 11,190 · "5 more" 27,060 (Dining, Transport, Utilities, Health, Subscriptions); the arithmetic must hold (sum 96,450). Uncategorised money is its own row, labelled "not yet categorised", never folded into Other. No footnote saying otherwise.

## Data (the only source)
As in the dataset used by all pages: cash ₹1,24,300 (HDFC ₹98,200 + ICICI ₹26,100); net worth ₹18,42,600 = ₹21,10,000 − ₹2,67,400; In ₹1,42,000 / Out ₹96,450 / Kept ₹45,550; typical by day 29 ₹1,01,200 (₹4,750 under); months Apr 88,200 · May 1,04,300 · Jun 97,800 · Jul 1,12,600 · Aug 1,01,200 · Sep 96,450; categories Rent 32,000 · Groceries 14,820 · Shopping 11,380 · Other 11,190 · Dining 9,640 · Transport 6,210 · Utilities 4,950 · Health 3,400 · Subscriptions 2,860.
