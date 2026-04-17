import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AttemptsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: attempts } = await supabase
    .from('attempts')
    .select('id,created_at,score,max_score,questions(question_number,papers(title,id))')
    .eq('student_id', user?.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="font-headline text-4xl text-[#00152a]">Saved Attempts</h1>
      <p className="font-body text-[#43474d] mt-2 mb-8">Review your latest submitted answers and results.</p>
      <div className="space-y-4">
        {!attempts?.length && <div className="bg-white border border-[#c3c6ce66] p-6 font-body text-[#43474d]">No attempts saved yet.</div>}
        {attempts?.map((attempt) => {
          const percent = attempt.max_score ? Math.round(((attempt.score ?? 0) / attempt.max_score) * 100) : 0
          return <div key={attempt.id} className="bg-white border border-[#c3c6ce66] p-6 flex items-center justify-between gap-4"><div><h2 className="font-headline text-xl text-[#00152a]">{attempt.questions?.papers?.title || 'Practice Attempt'} · Q{attempt.questions?.question_number}</h2><p className="font-body text-sm text-[#43474d] mt-2">Score: {attempt.score ?? 0}/{attempt.max_score ?? 0} ({percent}%)</p></div><div className="flex gap-3"><Link href={`/dashboard/results/${attempt.id}`} className="tsm-btn-secondary">Result</Link>{attempt.questions?.papers?.id && <Link href={`/dashboard/practice/${attempt.questions.papers.id}`} className="tsm-btn-primary">Practice Again</Link>}</div></div>
        })}
      </div>
    </div>
  )
}
