import Link from 'next/link'
import { AppIcon } from '@/components/app-icon'
import { BrandWordmark } from '@/components/brand-wordmark'

const archiveTrail = [
  { year: '2016', note: 'Earliest indexed eAssessments in the current archive.' },
  { year: '2019', note: 'Session metadata normalized for faster cross-year browsing.' },
  { year: '2022', note: 'Question-level indexing expanded across core subjects.' },
  { year: '2025', note: 'Latest paper records and markscheme references added.' },
] as const

const studentFlow = [
  {
    title: 'Start from a real need',
    copy: 'A student notices they miss command terms in Biology, or struggle with transformations in Mathematics.',
  },
  {
    title: 'Filter with intent',
    copy: 'They narrow by subject, session, and year instead of opening ten unrelated files first.',
  },
  {
    title: 'Work question by question',
    copy: 'They save exact items to revisit, so each revision block has a clear target and source.',
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
          <div className="grid items-end gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="font-label text-xs uppercase tracking-[.16em] text-[#43474d]">MYP Atlas · eAssessment Archive</p>
              <h1 className="mt-6 max-w-3xl font-headline text-5xl leading-[1.05] text-[#00152a] md:text-6xl lg:text-7xl">
                From paper piles to precise practice.
              </h1>
              <p className="mt-7 max-w-2xl font-body text-lg leading-relaxed text-[#43474d]">
                Most students can access past papers. The harder part is finding the one question that matches today&apos;s weak spot.
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link href="/auth/sign-up" className="tsm-btn-primary inline-flex items-center gap-2">Start your archive <AppIcon name="arrow_forward" className="size-4" /></Link>
                <Link href="/dashboard/papers" className="tsm-btn-secondary inline-flex items-center gap-2">Browse papers <AppIcon name="chevron_right" className="size-4" /></Link>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-md border border-[#c3c6ce66] bg-white p-7 shadow-[0_20px_44px_rgba(27,28,25,0.08)] lg:col-span-5">
              <div className="absolute -right-10 -top-14 h-52 w-52 rounded-full bg-[#efe8d7]" />
              <div className="relative space-y-5">
                <p className="font-label text-xs uppercase tracking-[.14em] text-[#43474d]">Inside the archive</p>
                <ul className="space-y-3 font-body text-sm leading-relaxed text-[#43474d]">
                  <li className="flex items-start gap-2"><AppIcon name="check_circle" className="mt-0.5 size-4 text-[#735b2b]" />Real paper records and markscheme references.</li>
                  <li className="flex items-start gap-2"><AppIcon name="check_circle" className="mt-0.5 size-4 text-[#735b2b]" />Filters for year, session, subject, and topic context.</li>
                  <li className="flex items-start gap-2"><AppIcon name="check_circle" className="mt-0.5 size-4 text-[#735b2b]" />Question-level discovery built for targeted revision.</li>
                </ul>
                <div className="rounded-sm border border-[#d5d8df] bg-[#f8f9fb] p-4">
                  <p className="font-headline text-xl leading-snug text-[#00152a]">Access is common. Structure is rare.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#ece8de] bg-[#f6f2e8] py-14 lg:py-16">
          <div className="tsm-shell grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h2 className="font-headline text-4xl text-[#00152a] md:text-5xl">An archive designed for revision decisions, not file storage.</h2>
              <p className="mt-5 max-w-2xl font-body text-base leading-relaxed text-[#43474d]">
                Paper folders answer one question: “Do I have it?” Revision asks harder ones: “Is it the right level? The right session? The right topic for what I keep missing?”
              </p>
            </div>
            <aside className="rounded-md border border-[#c3c6ce66] bg-white p-6">
              <p className="font-label text-xs uppercase tracking-[.14em] text-[#43474d]">Editorial note</p>
              <p className="mt-4 font-body text-sm leading-relaxed text-[#43474d]">
                MYP Atlas is intentionally grounded in real past materials. It helps students work from authentic assessment language rather than generic drill sets.
              </p>
            </aside>
          </div>
        </section>

        <section className="tsm-shell py-16 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <article className="rounded-md border border-[#c3c6ce66] bg-white p-8">
              <p className="font-label text-xs uppercase tracking-[.14em] text-[#43474d]">How students actually use it</p>
              <div className="mt-6 space-y-7">
                {studentFlow.map((step, index) => (
                  <div key={step.title} className="grid grid-cols-[2rem_1fr] gap-4">
                    <span className="font-headline text-3xl leading-none text-[#735b2b]">0{index + 1}</span>
                    <div>
                      <h3 className="font-headline text-2xl text-[#00152a]">{step.title}</h3>
                      <p className="mt-2 font-body text-sm leading-relaxed text-[#43474d]">{step.copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="relative overflow-hidden rounded-md border border-[#c3c6ce66] bg-[#eef2f7] p-8">
              <div className="absolute bottom-0 right-0 h-40 w-40 translate-x-10 translate-y-10 rounded-full bg-[#dce4ef]" />
              <div className="relative">
                <p className="font-label text-xs uppercase tracking-[.14em] text-[#43474d]">Browse by year and session</p>
                <h3 className="mt-4 max-w-md font-headline text-3xl leading-tight text-[#00152a]">Move across the archive like a timeline, not a maze.</h3>
                <div className="mt-8 space-y-4">
                  {archiveTrail.map((entry) => (
                    <div key={entry.year} className="grid grid-cols-[4.5rem_1fr] items-start gap-4 border-t border-[#c3c6ce66] pt-4 first:border-t-0 first:pt-0">
                      <span className="font-headline text-2xl text-[#00152a]">{entry.year}</span>
                      <p className="font-body text-sm leading-relaxed text-[#43474d]">{entry.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="bg-white py-16 lg:py-20">
          <div className="tsm-shell grid gap-8 lg:grid-cols-2">
            <article className="rounded-md border border-[#c3c6ce66] bg-[#fcfbf8] p-8">
              <p className="font-label text-xs uppercase tracking-[.14em] text-[#43474d]">Raw PDFs</p>
              <h3 className="mt-4 font-headline text-3xl text-[#00152a]">You can have everything and still not find what you need.</h3>
              <ul className="mt-6 space-y-3 font-body text-sm leading-relaxed text-[#43474d]">
                <li>• Duplicate folders and unclear file names.</li>
                <li>• Long scanning time before meaningful practice starts.</li>
                <li>• Weak links between topics and the right paper questions.</li>
              </ul>
            </article>
            <article className="rounded-md border border-[#c3c6ce66] bg-[#f2f5f8] p-8">
              <p className="font-label text-xs uppercase tracking-[.14em] text-[#43474d]">Structured discovery</p>
              <h3 className="mt-4 font-headline text-3xl text-[#00152a]">Find one relevant question in minutes, then keep moving.</h3>
              <ul className="mt-6 space-y-3 font-body text-sm leading-relaxed text-[#43474d]">
                <li>• Filter by subject, session, year, and topic context.</li>
                <li>• Open linked question records with markscheme references.</li>
                <li>• Save exact items for future focused sessions.</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="bg-[#eef0ec] py-20 lg:py-24">
          <div className="tsm-shell">
            <div className="relative overflow-hidden rounded-md border border-[#c3c6ce66] bg-[linear-gradient(135deg,#f7f8f4,#e9ede6)] p-10 md:p-14">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(115,91,43,0.12),transparent_42%),radial-gradient(circle_at_76%_80%,rgba(0,21,42,0.1),transparent_40%)]" />
              <div className="relative max-w-3xl">
                <p className="font-label text-xs uppercase tracking-[.14em] text-[#43474d]">Study atmosphere</p>
                <h2 className="mt-4 font-headline text-4xl leading-tight text-[#00152a] md:text-5xl">Quiet interface. Serious materials. Clear decisions.</h2>
                <p className="mt-6 font-body text-base leading-relaxed text-[#43474d]">
                  The experience is intentionally calm so attention stays on interpreting authentic exam language, patterns, and expectations.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="tsm-shell py-16 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <article className="rounded-md border border-[#c3c6ce66] bg-white p-8">
              <p className="font-label text-xs uppercase tracking-[.14em] text-[#43474d]">Question-level exploration</p>
              <h3 className="mt-4 font-headline text-3xl text-[#00152a]">Treat each question as a reference point.</h3>
              <p className="mt-5 max-w-xl font-body text-sm leading-relaxed text-[#43474d]">
                View question text, keep source context nearby, and bookmark items that repeatedly expose the same weakness. Over time, this builds a revision trail you can actually act on.
              </p>
            </article>

            <aside className="flex flex-col justify-between rounded-md border border-[#c3c6ce66] bg-[#f8f6f1] p-8">
              <div>
                <p className="font-label text-xs uppercase tracking-[.14em] text-[#43474d]">Ready to begin</p>
                <h3 className="mt-4 font-headline text-3xl leading-tight text-[#00152a]">Build a study archive that behaves like an atlas.</h3>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <Link href="/auth/sign-up" className="tsm-btn-primary text-center">Create account</Link>
                <Link href="/auth/login" className="tsm-btn-secondary text-center">Log in</Link>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#c3c6ce66] bg-[#fbf9f4] py-12">
        <div className="tsm-shell grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <BrandWordmark className="text-lg" />
            <p className="mt-3 max-w-lg font-body text-sm leading-relaxed text-[#43474d]">
              A searchable MYP eAssessment archive for focused, source-based revision.
            </p>
          </div>
          <p className="font-label text-xs uppercase tracking-widest text-[#00152a]">© 2026 MYP Atlas</p>
        </div>
      </footer>
    </div>
  )
}
