import Link from 'next/link'
import { AppIcon } from '@/components/app-icon'
import { BrandWordmark } from '@/components/brand-wordmark'

const pillars = [
  {
    title: 'Real eAssessment sources only',
    copy: 'Every entry is tied to a real past paper, question record, and markscheme reference.',
    icon: 'menu_book',
  },
  {
    title: 'Structured discovery',
    copy: 'Find by subject, year, session, topic, and question instead of hunting through folders.',
    icon: 'explore',
  },
  {
    title: 'Targeted revision workflow',
    copy: 'Save and revisit specific papers and questions for weak areas and focused practice.',
    icon: 'target',
  },
] as const

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fbf9f4] text-[#1b1c19]">
      <header className="sticky top-0 z-50 border-b border-[#f0eee9] bg-[#fbf9f4]/95 backdrop-blur">
        <div className="tsm-shell flex items-center justify-between py-6">
          <BrandWordmark className="text-2xl" />
          <div className="flex items-center gap-3 font-body text-sm">
            <Link href="/auth/login" className="px-4 py-2 text-[#00152a] hover:text-[#735b2b]">Log In</Link>
            <Link href="/auth/sign-up" className="tsm-btn-primary">Create Account</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="tsm-shell py-20 lg:py-24">
          <div className="grid items-stretch gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="font-label text-xs uppercase tracking-[.16em] text-[#43474d]">MYP Atlas · Real eAssessment Archive</p>
              <h1 className="mt-6 font-headline text-5xl leading-[1.05] text-[#00152a] md:text-6xl lg:text-7xl">Past paper PDFs are everywhere. Precision search across them is not.</h1>
              <p className="mt-8 max-w-2xl font-body text-lg leading-relaxed text-[#43474d]">Many students already have paper collections. The real difficulty is locating one specific question for one weak topic at the right level and session. MYP Atlas is a structured archive for real MYP eAssessments from 2016 to 2025, with paper-level and question-level discovery.</p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link href="/auth/sign-up" className="tsm-btn-primary inline-flex items-center gap-2">Start with email verification <AppIcon name="arrow_forward" className="size-4" /></Link>
                <Link href="/dashboard/papers" className="tsm-btn-secondary inline-flex items-center gap-2">Browse archive <AppIcon name="chevron_right" className="size-4" /></Link>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-md border border-[#c3c6ce66] bg-white p-8 shadow-[0_20px_44px_rgba(27,28,25,0.08)] lg:col-span-5">
              <div className="absolute -right-8 -top-10 h-44 w-44 rounded-full bg-[#ece7db]" />
              <div className="relative">
                <h2 className="font-headline text-3xl text-[#00152a]">What MYP Atlas solves</h2>
                <ul className="mt-6 space-y-4">
                  {[
                    'Search by subject, year, and May/November sessions.',
                    'Open real paper records with markscheme links/text.',
                    'Jump directly into published questions and topic tags.',
                    'Bookmark exact question records for targeted revision.',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 font-body text-sm text-[#43474d]"><AppIcon name="check_circle" className="mt-0.5 size-4 text-[#735b2b]" />{item}</li>
                  ))}
                </ul>
                <blockquote className="mt-8 border-l-2 border-[#735b2b] pl-4 font-headline text-xl leading-snug text-[#00152a]">“Built for finding the right question quickly — not for generating artificial practice content.”</blockquote>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#f3f0e8] py-16 lg:py-20">
          <div className="tsm-shell grid gap-6 md:grid-cols-3">
            {pillars.map((pillar) => (
              <article key={pillar.title} className="rounded-md border border-[#c3c6ce66] bg-white p-6">
                <AppIcon name={pillar.icon} className="size-5 text-[#00152a]" />
                <h3 className="mt-4 font-headline text-2xl text-[#00152a]">{pillar.title}</h3>
                <p className="mt-3 font-body text-sm leading-relaxed text-[#43474d]">{pillar.copy}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#c3c6ce66] py-12">
        <div className="tsm-shell flex flex-col items-center justify-between gap-4 md:flex-row">
          <BrandWordmark className="text-lg" />
          <p className="font-label text-xs uppercase tracking-widest text-[#00152a]">© 2026 MYP Atlas</p>
        </div>
      </footer>
    </div>
  )
}
