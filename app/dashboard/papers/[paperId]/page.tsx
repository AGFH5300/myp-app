import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PaperDetailPage({ params }: { params: Promise<{ paperId: string }> }) {
  const { paperId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: paper } = await supabase
    .from('papers')
    .select('id,title,year,pdf_url,markscheme_url,markscheme_text,subjects(name),exam_sessions(session_month,session_year)')
    .eq('id', paperId)
    .eq('is_published', true)
    .maybeSingle()

  if (!paper) notFound()

  const { data: questions } = await supabase
    .from('questions')
    .select('id,question_number,prompt_text,context_image_url,image_url,secondary_image_url,markscheme_text,markscheme_image_url,marks,is_published')
    .eq('paper_id', paperId)
    .eq('is_published', true)
    .order('question_number')

  if (user) {
    await supabase.from('paper_views').insert({ student_id: user.id, paper_id: paperId })
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-headline text-4xl text-[#00152a]">{paper.title}</h1>
        <p className="font-body text-[#43474d] mt-2">{paper.subjects?.name} · {paper.year} {paper.exam_sessions?.session_month}</p>
      </header>

      <section className="bg-white border border-[#c3c6ce66] p-6 rounded-md space-y-3">
        <h2 className="font-headline text-2xl text-[#00152a]">Paper resources</h2>
        {paper.pdf_url && <a className="font-body text-sm text-[#735b2b] underline" href={paper.pdf_url} target="_blank">Open paper PDF</a>}
        {paper.markscheme_url && <a className="font-body text-sm text-[#735b2b] underline block" href={paper.markscheme_url} target="_blank">Open markscheme PDF</a>}
        {paper.markscheme_text && <p className="font-body text-sm text-[#43474d] whitespace-pre-wrap">{paper.markscheme_text}</p>}
      </section>

      <section className="bg-white border border-[#c3c6ce66] p-6 rounded-md">
        <h2 className="font-headline text-2xl text-[#00152a] mb-4">Questions from this paper</h2>
        <div className="space-y-3">
          {questions?.map((question) => (
            <Link key={question.id} href={`/dashboard/questions/${question.id}`} className="block p-4 bg-[#f5f3ee] rounded-sm">
              <p className="font-headline text-lg text-[#00152a]">Q{question.question_number} · {question.marks} marks</p>
              <p className="font-body text-sm text-[#43474d] mt-1 line-clamp-2">{question.prompt_text || (question.image_url || question.context_image_url || question.secondary_image_url ? 'Image-based question' : '')}</p>
            </Link>
          ))}
          {!questions?.length && <p className="font-body text-sm text-[#43474d]">No published questions in this paper yet.</p>}
        </div>
      </section>
    </div>
  )
}
