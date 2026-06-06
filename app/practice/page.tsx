import Link from 'next/link'
import { BrandWordmark } from '@/components/brand-wordmark'
import { createClient } from '@/lib/supabase/server'

export default async function PracticeHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: subjects } = await supabase
    .from('subjects')
    .select('id,name,description,papers!inner(id,is_published,questions!inner(id,is_published))')
    .eq('papers.is_published', true)
    .eq('papers.questions.is_published', true)
    .order('name')

  const uniqueSubjects = Array.from(new Map((subjects ?? []).map((subject) => [subject.name, subject])).values())

  return (
    <div className="min-h-screen bg-[#fbf9f4]">
      <header className="border-b border-[#f0eee9] bg-[#fbf9f4]/95">
        <div className="tsm-shell flex items-center justify-between py-6">
          <BrandWordmark className="text-2xl" href="/practice" />
          <Link href={user ? '/dashboard' : '/auth/login'} className="tsm-btn-secondary">{user ? 'Dashboard' : 'Log in'}</Link>
        </div>
      </header>
      <main className="tsm-shell py-12">
        <section className="max-w-3xl">
          <p className="font-label text-xs uppercase tracking-[.16em] text-[#735b2b]">Past paper practice</p>
          <h1 className="mt-4 font-headline text-5xl text-[#00152a]">Practise questions by topic.</h1>
          <p className="mt-4 font-body text-lg text-[#43474d]">Choose a subject, then a level and topic to open individual past paper questions.</p>
        </section>
        <section className="mt-10 grid gap-4 md:grid-cols-2">
          {uniqueSubjects.map((subject) => (
            <Link key={subject.id} href={`/practice/${encodeURIComponent(subject.name)}`} className="rounded-md border border-[#c3c6ce66] bg-white p-6 hover:border-[#735b2b]">
              <h2 className="font-headline text-3xl text-[#00152a]">{subject.name}</h2>
              <p className="mt-2 font-body text-sm text-[#43474d]">{subject.description || 'Open topic-based past paper questions.'}</p>
            </Link>
          ))}
          {!uniqueSubjects.length ? <p className="rounded-md border border-[#c3c6ce66] bg-white p-6 font-body text-[#43474d]">No published practice questions yet.</p> : null}
        </section>
      </main>
    </div>
  )
}
