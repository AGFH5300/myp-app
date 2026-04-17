export default function OnboardingPage() {
  const subjects = [
    ['calculate', 'Mathematics', true],
    ['science', 'Sciences', true],
    ['public', 'Individuals & Societies', false],
    ['menu_book', 'Language & Literature', false],
    ['translate', 'Language Acquisition', false],
  ]

  return (
    <main className="min-h-screen bg-[#fbf9f4] text-[#1b1c19] flex items-center justify-center p-6 md:p-12 lg:p-24">
      <div className="max-w-4xl w-full grid lg:grid-cols-12 gap-12 lg:gap-24">
        <div className="lg:col-span-5">
          <h1 className="font-headline text-5xl md:text-6xl text-[#00152a]">Curate Your Study.</h1>
          <p className="font-body text-lg text-[#43474d] mt-4">Select your academic year and focus disciplines to tailor your eAssessment preparation materials.</p>
          <div className="mt-8"><div className="flex justify-between text-sm uppercase text-[#43474d]"><span>Step 1 of 2</span><span>Year & Subjects</span></div><div className="h-1 mt-2 bg-[#eae8e3]"><div className="h-full w-1/2 bg-[#735b2b]" /></div></div>
        </div>
        <div className="lg:col-span-7 space-y-10">
          <section><h2 className="font-headline text-2xl text-[#00152a] mb-4">Academic Year</h2><div className="grid sm:grid-cols-2 gap-4"><button className="p-6 bg-white border border-[#c3c6ce66] text-left">MYP 4</button><button className="p-6 bg-[#d1e4ff] border border-[#d1e4ff] text-left">MYP 5</button></div></section>
          <section><div className="flex justify-between items-baseline mb-4"><h2 className="font-headline text-2xl text-[#00152a]">Disciplines</h2><span className="font-label text-sm uppercase text-[#43474d]">Select Multiple</span></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-4">{subjects.map(([icon, name, selected]) => <button key={name as string} className={`h-32 p-4 border rounded-lg flex flex-col items-center justify-center gap-3 ${selected ? 'bg-[#f5f3ee] border-[#00152a]' : 'bg-white border-[#c3c6ce66]'}`}><span className="material-symbols-outlined text-3xl text-[#00152a]">{icon as string}</span><span className="font-body text-sm text-center">{name as string}</span></button>)}</div></section>
          <div className="flex justify-end"><button className="bg-[#00152a] text-white px-8 py-3">Continue</button></div>
        </div>
      </div>
    </main>
  )
}
