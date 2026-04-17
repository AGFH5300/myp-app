import Link from 'next/link'

const subjects = [
  ['calculate', 'Mathematics', '1,200+ Questions', 'Extended and Standard level coverage, including complex problem-solving and real-world application contexts.', 'md:col-span-2'],
  ['science', 'Sciences', '850+ Questions', 'Biology, Chemistry, and Physics integrated assessments.', ''],
  ['public', 'Individuals & Societies', '600+ Questions', 'Source analysis and essay framing techniques.', ''],
  ['menu_book', 'Language & Literature', '450+ Questions', 'Textual analysis and comparative commentary practice.', ''],
] as const

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fbf9f4] text-[#1b1c19]">
      <header className="sticky top-0 z-50 bg-[#fbf9f4]">
        <div className="tsm-shell flex items-center justify-between py-6">
          <div className="flex items-center gap-8">
            <Link href="/" className="font-headline text-2xl italic text-[#00152a]">The Scholarly Manuscript</Link>
            <nav className="hidden md:flex gap-6 ml-8">
              {['Curriculum', 'Subjects', 'Resources'].map((item) => <a key={item} className="font-headline text-lg text-[#00152a]/60" href="#">{item}</a>)}
            </nav>
          </div>
          <div className="flex items-center gap-3 font-body text-sm">
            <Link href="/auth/login" className="px-4 py-2 text-[#00152a]">Log In</Link>
            <Link href="/auth/sign-up" className="tsm-btn-primary">Sign Up</Link>
          </div>
        </div>
        <div className="h-px bg-[#f5f3ee]" />
      </header>

      <main>
        <section className="tsm-shell py-24">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5">
              <span className="font-label text-sm uppercase tracking-[.05em] text-[#43474d] font-semibold">MYP eAssessment Preparation</span>
              <h1 className="font-headline mt-6 text-5xl md:text-6xl lg:text-7xl text-[#00152a] leading-[1.1]">Master your <span className="italic text-[#735b2b]">MYP eAssessments.</span></h1>
              <p className="font-body text-lg text-[#43474d] mt-8 max-w-lg">Practice with precision. Filter by subject, year, session, and topic to build a customized study regimen that reflects true exam conditions.</p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4"><button className="tsm-btn-primary">Start Practicing</button><button className="tsm-btn-secondary">View Demo</button></div>
            </div>
            <div className="lg:col-span-7 h-[520px] rounded-lg tsm-ghost-border bg-[#f5f3ee] shadow-[0_12px_32px_rgba(27,28,25,0.06)] p-6">
              <div className="h-14 border-b border-[#c3c6ce66] flex items-center justify-between"><span className="font-body text-sm text-[#00152a]">Exam Filter Criteria</span><span className="font-label text-xs uppercase tracking-widest text-[#43474d]">Mathematics</span></div>
            </div>
          </div>
        </section>

        <section className="bg-[#f5f3ee] py-24">
          <div className="tsm-shell">
            <div className="flex justify-between items-end mb-16 gap-8"><div><h2 className="font-headline text-4xl text-[#00152a]">Curated by Subject</h2><p className="font-body text-lg text-[#43474d] mt-4">Focus your efforts. Select a discipline to access categorized past papers and topic-specific question banks.</p></div></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {subjects.map(([icon, title, count, desc, span]) => (
                <div key={title} className={`${span} bg-white rounded-lg tsm-ghost-border p-8 h-[320px] flex flex-col`}>
                  <div className="mb-auto"><div className="w-12 h-12 rounded-full bg-[#f0eee9] flex items-center justify-center"><span className="material-symbols-outlined text-[#00152a]">{icon}</span></div><h3 className="font-headline text-2xl text-[#00152a] mt-6">{title}</h3><p className="font-body text-sm text-[#43474d] mt-2">{desc}</p></div>
                  <div className="border-t border-[#c3c6ce66] pt-4 mt-8 font-label text-xs uppercase tracking-widest text-[#43474d]">{count}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#c3c6ce66] py-12">
        <div className="tsm-shell text-center"><p className="font-label text-xs uppercase tracking-widest text-[#00152a]">© 2024 The Scholarly Manuscript. All rights reserved.</p></div>
      </footer>
    </div>
  )
}
