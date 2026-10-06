import { Ask } from '../landing/Ask'
import { Changelog } from '../landing/Changelog'
import { Hero } from '../landing/Hero'
import { How } from '../landing/How'
import { Platform } from '../landing/Platform'
import { Security } from '../landing/Security'
import { Start } from '../landing/Start'
import { Views } from '../landing/Views'

/** The landing (r4/ds/index.html): the sections in page order. The counter numbers their SectionTags. */
export function Landing() {
  return (
    <main className="[counter-reset:dsec]">
      <Hero />
      <Platform />
      <Views />
      <How />
      <Ask />
      <Security />
      <Changelog />
      <Start />
    </main>
  )
}
