import { createClient } from '@/lib/supabase/server'
import { SubjectCard } from '@/components/subject-card'

export default async function SubjectsPage() {
  const supabase = await createClient()
  const { data: subjects } = await supabase.from('subjects').select('*, papers(count)').order('name')

  return (
    <div>
      <h1 className="font-headline text-4xl text-[#00152a]">Curriculum Index</h1>
      <p className="font-body text-[#43474d] mt-2 mb-8">Select a discipline to continue your preparation.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects?.map((s) => <SubjectCard key={s.id} subject={s} paperCount={s.papers?.[0]?.count || 0} />)}
      </div>
    </div>
  )
}
