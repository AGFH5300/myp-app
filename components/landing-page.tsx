import Link from 'next/link'
import { AppIcon } from '@/components/app-icon'
import { BrandWordmark } from '@/components/brand-wordmark'

const highlights = [
  ['calendar_month', '2016–2025 archive', 'Browse a real MYP eAssessment archive by year and session.'],
  ['menu_book', 'Real papers only', 'Open real paper PDFs, question records, and markschemes.'],
  ['tune', 'Focused filters', 'Filter by subject, year, session (May/November), and tagged topics.'],
] as const

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fbf9f4] text-[#1b1c19]">
      <header className="sticky top-0 z-50 bg-[#fbf9f4] border-b border-[#f0eee9]">
        <div className="tsm-shell flex items-center justify-between py-6">
          <BrandWordmark className="text-2xl" />
          <div className="flex items-center gap-3 font-body text-sm">
            <Link href="/auth/login" className="px-4 py-2 text-[#00152a] hover:text-[#735b2b]">Log In</Link>
            <Link href="/auth/sign-up" className="tsm-btn-primary">Create Account</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="tsm-shell py-24">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <span className="font-label text-sm uppercase tracking-[.05em] text-[#43474d] font-semibold">MYP Atlas · Phase 1</span>
              <h1 className="font-headline mt-6 text-5xl md:text-6xl lg:text-7xl text-[#00152a] leading-[1.1]">MYP eAssessment past papers, not a practice bank.</h1>
              <p className="font-body text-lg text-[#43474d] mt-8 max-w-2xl">MYP Atlas is built for real eAssessment preparation with real materials only: past papers, real questions, and real markschemes from 2016 to 2025.</p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <Link href="/auth/sign-up" className="tsm-btn-primary inline-flex items-center gap-2">Get Started <AppIcon name="arrow_forward" className="size-4" /></Link>
                <Link href="/auth/login" className="tsm-btn-secondary inline-flex items-center gap-2">Go to Workspace <AppIcon name="chevron_right" className="size-4" /></Link>
              </div>
            </div>
            <div className="lg:col-span-5 rounded-lg border border-[#c3c6ce66] bg-white p-8 shadow-[0_12px_32px_rgba(27,28,25,0.06)]">
              <h2 className="font-headline text-3xl text-[#00152a]">What you can do now</h2>
              <ul className="mt-6 space-y-4">
                {[
                  'Browse papers by subject, year, and session (May/November).',
                  'Open paper details, question records, and markscheme links/text.',
                  'Filter by topic tags when topics are available.',
                  'Bookmark papers and questions for quick return.',
                ].map((item) => (
                  <li key={item} className="font-body text-sm text-[#43474d] flex gap-2"><AppIcon name="check" className="size-4 mt-0.5 text-[#735b2b]" />{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-[#f5f3ee] py-20">
          <div className="tsm-shell grid md:grid-cols-3 gap-6">
            {highlights.map(([icon, title, copy]) => (
              <article key={title} className="bg-white border border-[#c3c6ce66] p-6 rounded-md">
                <AppIcon name={icon} className="size-5 text-[#00152a]" />
                <h3 className="font-headline text-2xl mt-4 text-[#00152a]">{title}</h3>
                <p className="font-body text-sm mt-3 text-[#43474d]">{copy}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#c3c6ce66] py-12">
        <div className="tsm-shell flex flex-col md:flex-row gap-4 items-center justify-between">
          <BrandWordmark className="text-lg" />
          <p className="font-label text-xs uppercase tracking-widest text-[#00152a]">© 2026 MYP Atlas</p>
        </div>
      </footer>
    </div>
  )
}
