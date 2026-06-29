import { GroupedPaperReader } from '@/components/grouped-paper-reader'
import { createClient } from '@/lib/supabase/server'

export default async function PaperDetailPage({ params }: { params: Promise<{ paperId: string }> }) {
  const { paperId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    await supabase.from('paper_views').insert({ student_id: user.id, paper_id: paperId })
  }

  return <GroupedPaperReader paperId={paperId} backHref="/dashboard/papers" />
}
