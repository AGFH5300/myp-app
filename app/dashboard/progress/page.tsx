import { createClient } from '@/lib/supabase/server'
import { AdSlot } from '@/components/ad-slot'
import { adSlots } from '@/lib/ads'

export default async function ProgressPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: attempts } = await supabase
    .from('attempts')
    .select('id,score,max_score,created_at,questions(paper_id,papers(subject_id,subjects(name)))')
    .eq('student_id', user?.id)
    .order('created_at', { ascending: false })

  const bySubject = new Map<string, { name: string; score: number; max: number }>()
  attempts?.forEach((attempt) => {
    const subjectName = attempt.questions?.papers?.subjects?.name || 'General'
    const item = bySubject.get(subjectName) ?? { name: subjectName, score: 0, max: 0 }
    item.score += attempt.score ?? 0
    item.max += attempt.max_score ?? 0
    bySubject.set(subjectName, item)
  })

  const rows = [...bySubject.values()]

  return (
    <div>
      <h1 className="font-headline text-4xl text-[#00152a]">Activity overview</h1>
      <p className="font-body text-[#43474d] mt-2 mb-8">Review answer activity by subject from your saved attempts.</p>
      <div className="space-y-4">
        {!rows.length && <div className="bg-white border border-[#c3c6ce66] p-6 font-body text-[#43474d] rounded-md">No activity data yet. Save attempts from question practice to populate this view.</div>}
        {rows.map((p) => {
          const accuracy = p.max ? Math.round((p.score / p.max) * 100) : 0
          return (
            <div key={p.name} className="bg-white border border-[#c3c6ce66] p-6 rounded-md">
              <div className="flex justify-between"><h2 className="font-headline text-2xl text-[#00152a]">{p.name}</h2><span className="font-headline text-[#735b2b]">{accuracy}%</span></div>
              <div className="h-1 mt-4 bg-[#e4e2dd]"><div className="h-full bg-[#00152a]" style={{ width: `${accuracy}%` }} /></div>
            </div>
          )
        })}
      </div>
      <div className="mt-8"><AdSlot slot={adSlots.listFooter} label="Sponsored" /></div>
    </div>
  )
}
