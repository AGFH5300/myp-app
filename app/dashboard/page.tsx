export default function DashboardPage() {
  const subjects = [
    ['science', 'Sciences', 'Criterion B & C Focus', 82],
    ['functions', 'Mathematics', 'Extended Concepts', 68],
  ]

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div className="md:w-2/3"><h1 className="font-headline text-5xl text-[#00152a]">Your Workspace</h1><p className="font-body text-lg text-[#43474d] mt-4">Focus on completing the Language and Literature module today. Consistent analysis builds enduring comprehension.</p></div>
        <p className="hidden md:block font-headline italic text-lg text-[#735b2b]">Tuesday, October 24</p>
      </header>
      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <section className="bg-white border border-[#c3c6ce66] p-8 md:p-12 min-h-[280px] relative overflow-hidden">
            <span className="font-label text-xs uppercase tracking-widest text-[#00152a]">Last Active Session</span>
            <h2 className="font-headline text-3xl text-[#00152a] mt-4">Language & Literature: Paper 1 Analysis</h2>
            <p className="font-body text-sm text-[#43474d] mt-4 mb-8">You were reviewing narrative techniques in mid-century fiction. 4 questions remain in this set.</p>
            <div className="flex gap-4"><button className="tsm-btn-primary">Resume Practice</button><button className="font-body text-sm text-[#735b2b]">Review Notes</button></div>
          </section>
          <section>
            <div className="flex justify-between mb-6 border-b border-[#c3c6ce33] pb-2"><h3 className="font-headline text-2xl text-[#00152a]">Curriculum Focus</h3><a className="font-label text-xs uppercase tracking-widest text-[#735b2b]" href="#">View All Index</a></div>
            <div className="grid md:grid-cols-2 gap-6">{subjects.map(([icon, title, subtitle, pct]) => <div key={title as string} className="bg-[#f5f3ee] p-6 border border-transparent hover:border-[#c3c6ce66]"><div className="flex justify-between mb-6"><span className="material-symbols-outlined text-[#00152a]">{icon as string}</span><span className="font-headline italic text-sm text-[#735b2b]">{pct}% Mastery</span></div><h4 className="font-headline text-xl text-[#00152a]">{title as string}</h4><p className="font-body text-sm text-[#43474d] my-3">{subtitle as string}</p><div className="h-0.5 bg-[#e4e2dd]"><div className="h-full bg-[#00152a]" style={{width:`${pct}%`}}/></div></div>)}</div>
          </section>
        </div>
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-white border border-[#c3c6ce66] p-6"><h3 className="font-headline text-xl text-[#00152a] mb-4 pb-4 border-b border-[#c3c6ce33]">Performance Insights</h3><div className="space-y-4 font-body text-sm"><div className="flex justify-between"><span className="text-[#43474d]">Analytical Thinking</span><span className="font-headline text-[#00152a]">High</span></div><div className="flex justify-between pt-4 border-t border-[#c3c6ce33]"><span className="text-[#43474d]">Source Evaluation</span><span className="font-headline text-[#735b2b]">Needs Review</span></div></div></section>
          <section className="bg-[#f5f3ee] p-6"><h3 className="font-headline text-lg text-[#00152a] mb-4">Curated Revisions</h3><div className="space-y-3">{['Explain the effect of catalysts on...','Analyze the demographic shift during...'].map((q)=><div key={q} className="p-4 bg-white border border-[#c3c6ce33]"><p className="font-body text-sm text-[#00152a] truncate">{q}</p></div>)}</div></section>
        </div>
      </div>
    </div>
  )
}
