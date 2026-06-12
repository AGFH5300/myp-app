'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')
  return supabase
}

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function numberValue(formData: FormData, key: string) {
  const value = Number(stringValue(formData, key))
  return Number.isFinite(value) ? value : null
}

async function revalidatePaperRoutes(paperId: string) {
  revalidatePath('/dashboard/admin')
  revalidatePath('/dashboard/admin/papers')
  revalidatePath('/dashboard/admin/question-bank')
  revalidatePath('/dashboard/papers')
  revalidatePath(`/dashboard/papers/${paperId}`)
  revalidatePath(`/dashboard/admin/papers/${paperId}/preview`)
}

export async function updatePaperDetails(formData: FormData) {
  const supabase = await requireAdmin()
  try {
    const paperId = stringValue(formData, 'paper_id')
    const title = stringValue(formData, 'title')
    const subjectId = stringValue(formData, 'subject_id')
    const year = numberValue(formData, 'year')
    const session = stringValue(formData, 'session') || 'May'
    const paperCode = stringValue(formData, 'paper_code')
    const isPublished = stringValue(formData, 'is_published') === 'true'

    if (!paperId) return { ok: false as const, message: 'Missing paper.' }
    if (!title || !subjectId || !year) return { ok: false as const, message: 'Title, subject, and year are required.' }

    const { data: sessionRow, error: sessionError } = await supabase
      .from('exam_sessions')
      .upsert({ session_month: session, session_year: year, is_published: true }, { onConflict: 'session_month,session_year' })
      .select('id')
      .single()

    if (sessionError || !sessionRow) throw new Error('Could not save exam session.')

    const { error } = await supabase
      .from('papers')
      .update({
        title,
        subject_id: subjectId,
        year,
        session,
        exam_session_id: sessionRow.id,
        paper_code: paperCode || null,
        is_published: isPublished,
      })
      .eq('id', paperId)

    if (error) throw new Error('Could not update paper details.')
    await revalidatePaperRoutes(paperId)
    return { ok: true as const, message: 'Paper details updated' }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not update paper details.' }
  }
}

export async function updatePaperPublication(paperId: string, publish: boolean) {
  const supabase = await requireAdmin()
  try {
    if (!paperId) return { ok: false as const, message: 'Missing paper.' }
    const { error } = await supabase.from('papers').update({ is_published: publish }).eq('id', paperId)
    if (error) throw new Error(publish ? 'Could not publish paper.' : 'Could not unpublish paper.')
    await revalidatePaperRoutes(paperId)
    return { ok: true as const, message: publish ? 'Paper published' : 'Paper unpublished' }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not update paper.' }
  }
}
