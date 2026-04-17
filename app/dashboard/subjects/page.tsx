import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function SubjectsPage() {
  const supabase = await createClient()
  const { data: subjects, error } = await supabase.from('subjects').select('id,name,description').order('name')

  return (
    <div>
      <h1 className="font-headline text-4xl text-[#00152a]">Subjects</h1>
      <p className="font-body text-[#43474d] mt-2 mb-8">Browse available MYP eAssessment papers by subject.</p>
      {error && <p className="text-sm text-red-700 mb-6">Unable to load subjects: {error.message}</p>}
      <div className="grid sm:grid-cols-2 gap-4">
        {subjects?.map((subject) => (
          <Link key={subject.id} href={`/dashboard/subjects/${subject.id}`} className="bg-white border border-[#c3c6ce66] p-6 rounded-md">
            <h2 className="font-headline text-2xl text-[#00152a]">{subject.name}</h2>
            <p className="font-body text-sm text-[#43474d] mt-2">{subject.description || 'Real MYP eAssessment papers and questions.'}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
