import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AdSlot } from '@/components/ad-slot'
import { adSlots } from '@/lib/ads'

export default async function BookmarksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select('id,created_at,questions(id,question_number,question_text,papers(id,title))')
    .eq('student_id', user?.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="font-headline text-4xl text-[#00152a]">Bookmarks</h1>
      <p className="font-body text-[#43474d] mt-2 mb-8">Quick access to questions you marked for revision.</p>
      <div className="space-y-4">
        {!bookmarks?.length && <div className="bg-white border border-[#c3c6ce66] p-6 font-body text-[#43474d]">No bookmarked questions yet.</div>}
        {bookmarks?.map((bookmark) => (
          <div key={bookmark.id} className="bg-white border border-[#c3c6ce66] p-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-headline text-xl text-[#00152a]">{bookmark.questions?.papers?.title || 'Paper'} · Q{bookmark.questions?.question_number}</h2>
              <p className="font-body text-sm text-[#43474d] mt-2 line-clamp-2">{bookmark.questions?.question_text}</p>
            </div>
            {bookmark.questions?.papers?.id && <Link href={`/dashboard/practice/${bookmark.questions.papers.id}`} className="tsm-btn-secondary">Open Paper</Link>}
          </div>
        ))}
      </div>
      <div className="mt-8"><AdSlot slot={adSlots.listFooter} label="Sponsored" /></div>
    </div>
  )
}
