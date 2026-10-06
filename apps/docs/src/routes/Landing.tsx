import { Ask } from '../sections/Ask'
import { Changelog } from '../sections/Changelog'
import { Hero } from '../sections/Hero'
import { How } from '../sections/How'
import { Platform } from '../sections/Platform'
import { Security } from '../sections/Security'
import { Start } from '../sections/Start'
import { Views } from '../sections/Views'

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
