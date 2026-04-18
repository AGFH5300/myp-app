import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: recentBookmarks }, { data: recentViews }, { data: paperCounts }, { data: recentPapers }, { data: recentQuestions }] = await Promise.all([
    supabase.from('profiles').select('selected_subject_ids, preferred_session, preferred_year, practice_focus').eq('id', user?.id).maybeSingle(),
    supabase.from('bookmarks').select('id, paper_id, question_id, created_at').eq('student_id', user?.id).order('created_at', { ascending: false }).limit(6),
    supabase.from('paper_views').select('id, viewed_at, papers(id,title,year)').eq('student_id', user?.id).order('viewed_at', { ascending: false }).limit(4),
    supabase.from('papers').select('id, year, exam_sessions(session_month)').eq('is_published', true),
    supabase.from('papers').select('id,title,year,created_at,exam_sessions(session_month),subjects(name)').eq('is_published', true).order('created_at', { ascending: false }).limit(5),
    supabase.from('recent_question_views').select('id, viewed_at, questions(id,question_number,papers(id,title,year))').eq('student_id', user?.id).order('viewed_at', { ascending: false }).limit(5),
  ])

  const countByYearSession = (paperCounts ?? []).reduce<Record<string, number>>((acc, paper) => {
    const key = `${paper.year} ${paper.exam_sessions?.session_month ?? ''}`.trim()
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-8">
      <header className="rounded-md border border-[#c3c6ce66] bg-white p-8 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        <p className="font-label text-xs uppercase tracking-[.16em] text-[#43474d]">MYP Atlas workspace</p>
        <h1 className="mt-3 font-headline text-5xl text-[#00152a]">Dashboard</h1>
        <p className="mt-3 font-body text-lg text-[#43474d]">Continue with real MYP eAssessment papers, question records, and markschemes.</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-md border border-[#c3c6ce66] bg-white p-6">
          <h2 className="font-headline text-2xl text-[#00152a]">Continue where you left off</h2>
          <p className="mt-3 font-body text-sm text-[#43474d]">{recentViews?.[0]?.papers?.title ? `Last viewed paper: ${recentViews[0].papers.title} (${recentViews[0].papers.year})` : 'No recent paper views yet.'}</p>
          <p className="mt-2 font-body text-sm text-[#43474d]">{recentQuestions?.[0]?.questions?.id ? `Last opened question: Q${recentQuestions[0].questions.question_number} from ${recentQuestions[0].questions.papers?.title}` : 'No recent question views yet.'}</p>
          <div className="mt-5 flex gap-3"><Link href="/dashboard/papers" className="tsm-btn-primary">Browse papers</Link><Link href="/dashboard/bookmarks" className="tsm-btn-secondary">Open bookmarks</Link></div>
        </article>

        <article className="rounded-md border border-[#c3c6ce66] bg-[#f5f3ee] p-6">
          <h2 className="font-headline text-2xl text-[#00152a]">Your focus settings</h2>
          <p className="mt-3 font-body text-sm text-[#43474d]">Preferred session: {profile?.preferred_session ?? 'No preference set'} · Preferred year: {profile?.preferred_year ?? 'No preference set'}</p>
          <p className="mt-2 font-body text-sm text-[#43474d]">Practice focus note: {profile?.practice_focus || 'Not set yet.'}</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-md border border-[#c3c6ce66] bg-white p-6">
          <h2 className="font-headline text-2xl text-[#00152a]">Archive coverage by year/session</h2>
          <div className="mt-4 grid grid-cols-2 gap-2 font-body text-sm">
            {Object.keys(countByYearSession).slice(0, 8).map((key) => <div key={key} className="flex justify-between rounded-sm bg-[#f5f3ee] px-3 py-2"><span>{key}</span><span>{countByYearSession[key]}</span></div>)}
            {!Object.keys(countByYearSession).length && <p className="text-[#43474d]">No published papers yet.</p>}
          </div>
        </article>
        <article className="rounded-md border border-[#c3c6ce66] bg-white p-6">
          <h2 className="font-headline text-2xl text-[#00152a]">Recent bookmarks</h2>
          <p className="mt-2 font-body text-sm text-[#43474d]">{recentBookmarks?.length ?? 0} saved items for quick revision.</p>
          <Link href="/dashboard/bookmarks" className="mt-3 inline-block font-body text-sm text-[#735b2b]">View all bookmarks →</Link>
        </article>
      </section>

      <section className="rounded-md border border-[#c3c6ce66] bg-white p-6">
        <h2 className="font-headline text-2xl text-[#00152a]">Latest published paper sets</h2>
        <div className="mt-4 space-y-3">
          {recentPapers?.map((paper) => (
            <Link key={paper.id} href={`/dashboard/papers/${paper.id}`} className="block rounded-sm bg-[#f5f3ee] p-4">
              <p className="font-headline text-lg text-[#00152a]">{paper.title}</p>
              <p className="font-body text-sm text-[#43474d]">{paper.subjects?.name} · {paper.year} {paper.exam_sessions?.session_month}</p>
            </Link>
          ))}
          {!recentPapers?.length && <p className="font-body text-sm text-[#43474d]">No papers uploaded yet.</p>}
        </div>
      </section>
    </div>
  )
}
