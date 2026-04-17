import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function BookmarksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select('id,created_at,paper_id,question_id,papers(id,title),questions(id,question_number,prompt_text,papers(id,title))')
    .eq('student_id', user?.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="font-headline text-4xl text-[#00152a]">Bookmarks</h1>
      <p className="font-body text-[#43474d] mt-2 mb-8">Saved papers and questions.</p>
      <div className="space-y-4">
        {!bookmarks?.length && <div className="bg-white border border-[#c3c6ce66] p-6 font-body text-[#43474d]">No bookmarks yet.</div>}
        {bookmarks?.map((bookmark) => {
          const question = bookmark.questions
          const questionPaper = question?.papers
          const paper = bookmark.papers || questionPaper
          return (
            <div key={bookmark.id} className="bg-white border border-[#c3c6ce66] p-6 flex items-center justify-between gap-4 rounded-md">
              <div>
                <h2 className="font-headline text-xl text-[#00152a]">{question ? `Q${question.question_number} · ${paper?.title || 'Paper'}` : paper?.title || 'Paper bookmark'}</h2>
                <p className="font-body text-sm text-[#43474d] mt-2 line-clamp-2">{question?.prompt_text || 'Saved paper bookmark'}</p>
              </div>
              <div className="flex gap-2">
                {paper?.id && <Link href={`/dashboard/papers/${paper.id}`} className="tsm-btn-secondary">Paper</Link>}
                {question?.id && <Link href={`/dashboard/questions/${question.id}`} className="tsm-btn-primary">Question</Link>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
