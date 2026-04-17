import { createClient } from '@/lib/supabase/server'
import { SubjectCard } from '@/components/subject-card'

export default async function SubjectsPage() {
  const supabase = await createClient()
  const { data: subjects, error } = await supabase.from('subjects').select('id,name,description,icon').order('name')

  return (
    <div>
      <h1 className="font-headline text-4xl text-[#00152a]">Subject Index</h1>
      <p className="font-body text-[#43474d] mt-2 mb-8">Select a discipline to continue your MYP Atlas preparation.</p>
      {error && <p className="text-sm text-red-700 mb-6">Unable to load subjects: {error.message}</p>}
      {!subjects?.length ? (
        <div className="bg-white border border-[#c3c6ce66] p-6 font-body text-[#43474d]">No subjects are available yet.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map((s) => <SubjectCard key={s.id} subject={s} paperCount={0} />)}
        </div>
      )}
    </div>
  )
}
