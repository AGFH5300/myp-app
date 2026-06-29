import { redirect } from 'next/navigation'
import { GroupedPaperReader } from '@/components/grouped-paper-reader'
import { createClient } from '@/lib/supabase/server'

export default async function AdminPaperPreviewPage({ params }: { params: Promise<{ paperId: string }> }) {
  const { paperId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return <GroupedPaperReader paperId={paperId} backHref="/dashboard/admin/papers" adminPreview includeUnpublishedQuestions />
}
