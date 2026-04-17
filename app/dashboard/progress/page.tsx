import { createClient } from '@/lib/supabase/server'

export default async function ProgressPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: progress } = await supabase.from('student_progress').select('*, subjects(name)').eq('user_id', user?.id)

  return (
    <div>
      <h1 className="font-headline text-4xl text-[#00152a]">Academic Progress</h1>
      <p className="font-body text-[#43474d] mt-2 mb-8">Track your mastery trajectory across disciplines.</p>
      <div className="space-y-4">
        {progress?.map((p) => {
          const accuracy = p.total_questions_attempted ? Math.round((p.total_questions_correct / p.total_questions_attempted) * 100) : 0
          return <div key={p.id} className="bg-white border border-[#c3c6ce66] p-6"><div className="flex justify-between"><h2 className="font-headline text-2xl text-[#00152a]">{p.subjects?.name}</h2><span className="font-headline italic text-[#735b2b]">{accuracy}%</span></div><div className="h-1 mt-4 bg-[#e4e2dd]"><div className="h-full bg-[#00152a]" style={{ width: `${accuracy}%` }} /></div></div>
        })}
      </div>
    </div>
  )
}
