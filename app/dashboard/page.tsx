import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AppIcon } from '@/components/app-icon'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: subjects }, { data: recentBookmarks }, { data: recentAttempts }] = await Promise.all([
    supabase.from('subjects').select('id,name,description,icon').order('name').limit(4),
    supabase.from('bookmarks').select('id, questions(question_text,question_number)').eq('student_id', user?.id).order('created_at', { ascending: false }).limit(3),
    supabase.from('attempts').select('id, score, max_score, created_at, questions(question_number, papers(title))').eq('student_id', user?.id).order('created_at', { ascending: false }).limit(1),
  ])

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div className="md:w-2/3"><h1 className="font-headline text-5xl text-[#00152a]">Your Workspace</h1><p className="font-body text-lg text-[#43474d] mt-4">Stay consistent and build exam confidence across your MYP Atlas subjects.</p></div>
      </header>
      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <section className="bg-white border border-[#c3c6ce66] p-8 md:p-12 min-h-[220px] relative overflow-hidden">
            <span className="font-label text-xs uppercase tracking-widest text-[#00152a]">Last Attempt</span>
            <h2 className="font-headline text-3xl text-[#00152a] mt-4">{recentAttempts?.[0]?.questions?.papers?.title || 'No attempts yet'}</h2>
            <p className="font-body text-sm text-[#43474d] mt-4 mb-8">{recentAttempts?.[0] ? `You scored ${recentAttempts[0].score ?? 0}/${recentAttempts[0].max_score ?? 0}. Continue practicing to improve your readiness.` : 'Start your first practice session from the subject index.'}</p>
            <div className="flex gap-4"><Link className="tsm-btn-primary" href="/dashboard/subjects">Open Subjects</Link><Link className="font-body text-sm text-[#735b2b] inline-flex items-center gap-1" href="/dashboard/attempts"><AppIcon name="history" className="size-4" />Saved Attempts</Link></div>
          </section>
          <section>
            <div className="flex justify-between mb-6 border-b border-[#c3c6ce33] pb-2"><h3 className="font-headline text-2xl text-[#00152a]">Curriculum Focus</h3><Link className="font-label text-xs uppercase tracking-widest text-[#735b2b]" href="/dashboard/subjects">View All Subjects</Link></div>
            <div className="grid md:grid-cols-2 gap-6">{subjects?.map((subject) => <div key={subject.id} className="bg-[#f5f3ee] p-6 border border-transparent hover:border-[#c3c6ce66]"><div className="flex justify-between mb-6"><AppIcon name={subject.icon || 'menu_book'} className="size-5 text-[#00152a]" /><span className="font-headline italic text-sm text-[#735b2b]">In Progress</span></div><h4 className="font-headline text-xl text-[#00152a]">{subject.name}</h4><p className="font-body text-sm text-[#43474d] my-3">{subject.description || 'Build criterion-based mastery.'}</p><Link href={`/dashboard/subjects/${subject.id}`} className="font-body text-sm text-[#00152a] inline-flex items-center gap-1">Open <AppIcon name="chevron_right" className="size-4" /></Link></div>)}</div>
          </section>
        </div>
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-white border border-[#c3c6ce66] p-6"><h3 className="font-headline text-xl text-[#00152a] mb-4 pb-4 border-b border-[#c3c6ce33]">Performance Insights</h3><div className="space-y-4 font-body text-sm"><div className="flex justify-between"><span className="text-[#43474d]">Saved bookmarks</span><span className="font-headline text-[#00152a]">{recentBookmarks?.length ?? 0}</span></div><div className="flex justify-between pt-4 border-t border-[#c3c6ce33]"><span className="text-[#43474d]">Completed attempts</span><span className="font-headline text-[#735b2b]">{recentAttempts?.filter((a) => a.score !== null).length ?? 0}</span></div></div></section>
          <section className="bg-[#f5f3ee] p-6"><div className="flex items-center gap-2 mb-4"><AppIcon name="bookmark" className="size-4 text-[#735b2b]" /><h3 className="font-headline text-lg text-[#00152a]">Bookmarked Questions</h3></div><div className="space-y-3">{recentBookmarks?.length ? recentBookmarks.map((item) => <div key={item.id} className="p-4 bg-white border border-[#c3c6ce33]"><p className="font-body text-sm text-[#00152a] truncate">Q{item.questions?.question_number}: {item.questions?.question_text}</p></div>) : <div className="p-4 bg-white border border-[#c3c6ce33] font-body text-sm text-[#43474d]">No bookmarks yet.</div>}</div></section>
        </div>
      </div>
    </div>
  )
}
