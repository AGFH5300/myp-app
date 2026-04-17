import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function ResultsPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: attempt } = await supabase
    .from('attempts')
    .select('id,score,max_score,created_at,questions(question_number,papers(title))')
    .eq('id', attemptId)
    .eq('student_id', user?.id)
    .maybeSingle()

  if (!attempt) notFound()

  const percent = attempt.max_score ? Math.round(((attempt.score ?? 0) / attempt.max_score) * 100) : 0

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="font-headline text-4xl text-[#00152a]">Attempt Result</h1>
      <p className="font-body text-[#43474d] mt-2 mb-8">{attempt.questions?.papers?.title} · Question {attempt.questions?.question_number}</p>
      <div className="bg-white border border-[#c3c6ce66] p-10 text-center">
        <p className="font-headline text-6xl text-[#00152a]">{percent}%</p>
        <p className="font-body text-[#43474d] mt-2">You scored {attempt.score ?? 0} out of {attempt.max_score ?? 0} marks.</p>
        <div className="mt-8 flex justify-center gap-4"><Link href="/dashboard/attempts" className="tsm-btn-secondary">Back to Attempts</Link><Link href="/dashboard" className="tsm-btn-primary">Back to Dashboard</Link></div>
      </div>
    </div>
  )
}
