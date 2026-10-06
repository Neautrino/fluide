/* DS01 class sets shared by the site's pages and sections (r4/ds/ds.css). */

/** Display face for headlines: Archivo 800 at 125% width, tight tracking. */
export const DISPLAY = 'font-display font-extrabold [font-stretch:125%] tracking-[-0.035em]'

/** The site's pill links: `solid` is DS01 .btn.primary (ink fill), `outline` is .btn (white, 1px ink). */
export function pill(variant: 'solid' | 'outline', size: 'md' | 'lg' = 'md') {
  const look =
    variant === 'solid'
      ? 'border-surface-inverse bg-surface-inverse text-ink-inverse hover:bg-[#26272b]'
      : 'border-line-strong bg-surface text-ink hover:bg-surface-2'
  const dims = size === 'lg' ? 'h-[46px] px-[22px] text-[14.5px]' : 'h-[38px] px-4 text-[13px]'
  return `inline-flex items-center gap-2 whitespace-nowrap rounded-full border font-sans font-bold transition-colors duration-200 ${look} ${dims}`
}

export const GITHUB = 'https://github.com/Neautrino/fluide'
