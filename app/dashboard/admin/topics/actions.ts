'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') redirect('/dashboard')
  return supabase
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function topicPath(formData: FormData, message: string, error = false) {
  const params = new URLSearchParams()
  const subjectId = textValue(formData, 'current_subject_id') || textValue(formData, 'subject_id')
  const groupId = textValue(formData, 'current_group_id') || textValue(formData, 'parent_topic_id')
  if (subjectId) params.set('subject', subjectId)
  if (groupId) params.set('group', groupId)
  params.set(error ? 'error' : 'notice', message)
  return `/dashboard/admin/topics?${params.toString()}`
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'topic'
}

async function uniqueSlug(supabase: Awaited<ReturnType<typeof requireAdmin>>, name: string, subjectId: string, parentTopicId: string | null, ignoreTopicId?: string) {
  const baseSlug = slugify(name)
  const { data: siblings } = await supabase
    .from('topics')
    .select('id,slug,parent_topic_id,subject_id')
    .eq('subject_id', subjectId)

  const used = new Set((siblings ?? [])
    .filter((topic) => topic.id !== ignoreTopicId && (topic.parent_topic_id ?? null) === parentTopicId)
    .map((topic) => topic.slug)
    .filter((slug): slug is string => Boolean(slug)))

  if (!used.has(baseSlug)) return baseSlug
  let index = 2
  while (used.has(`${baseSlug}-${index}`)) index += 1
  return `${baseSlug}-${index}`
}

async function nextSortOrder(supabase: Awaited<ReturnType<typeof requireAdmin>>, subjectId: string, parentTopicId: string | null) {
  const query = supabase
    .from('topics')
    .select('sort_order,parent_topic_id')
    .eq('subject_id', subjectId)
    .order('sort_order', { ascending: false })
    .limit(20)

  const { data } = parentTopicId ? await query.eq('parent_topic_id', parentTopicId) : await query.is('parent_topic_id', null)
  const maxSort = Math.max(0, ...(data ?? []).map((topic) => topic.sort_order ?? 0))
  return maxSort + 10
}

export async function createTopic(formData: FormData) {
  const supabase = await requireAdmin()
  const subjectId = textValue(formData, 'subject_id')
  const parentTopicId = textValue(formData, 'parent_topic_id') || null
  const name = textValue(formData, 'name')

  if (!subjectId || !name) redirect(topicPath(formData, 'Topic name and subject are required.', true))

  if (parentTopicId) {
    const { data: parent } = await supabase.from('topics').select('id,subject_id').eq('id', parentTopicId).maybeSingle()
    if (!parent || parent.subject_id !== subjectId) redirect(topicPath(formData, 'Subtopics must belong to the selected subject and topic group.', true))
  }

  const slug = await uniqueSlug(supabase, name, subjectId, parentTopicId)
  const sortOrder = await nextSortOrder(supabase, subjectId, parentTopicId)
  const { error } = await supabase.from('topics').insert({
    subject_id: subjectId,
    parent_topic_id: parentTopicId,
    name,
    slug,
    level: null,
    sort_order: sortOrder,
    is_active: true,
  })

  if (error) redirect(topicPath(formData, error.message, true))
  revalidatePath('/dashboard/admin/topics')
  revalidatePath('/dashboard/admin/question-bank')
  redirect(topicPath(formData, parentTopicId ? 'Subtopic created.' : 'Topic group created.'))
}

export async function renameTopic(formData: FormData) {
  const supabase = await requireAdmin()
  const topicId = textValue(formData, 'topic_id')
  const name = textValue(formData, 'name')
  if (!topicId || !name) redirect(topicPath(formData, 'Choose a topic and enter a new name.', true))

  const { data: topic } = await supabase.from('topics').select('id,subject_id,parent_topic_id').eq('id', topicId).maybeSingle()
  if (!topic?.subject_id) redirect(topicPath(formData, 'Topic not found.', true))

  const slug = await uniqueSlug(supabase, name, topic.subject_id, topic.parent_topic_id ?? null, topicId)
  const { error } = await supabase.from('topics').update({ name, slug }).eq('id', topicId)
  if (error) redirect(topicPath(formData, error.message, true))

  revalidatePath('/dashboard/admin/topics')
  revalidatePath('/dashboard/admin/question-bank')
  revalidatePath('/dashboard/papers')
  redirect(topicPath(formData, 'Topic renamed.'))
}

export async function toggleTopicActive(formData: FormData) {
  const supabase = await requireAdmin()
  const topicId = textValue(formData, 'topic_id')
  const nextActive = textValue(formData, 'next_active') === 'true'
  if (!topicId) redirect(topicPath(formData, 'Topic not found.', true))

  if (!nextActive) {
    const { count } = await supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .eq('parent_topic_id', topicId)
      .eq('is_active', true)
    if ((count ?? 0) > 0) redirect(topicPath(formData, 'Deactivate active subtopics first, then deactivate the topic group.', true))
  }

  const { error } = await supabase.from('topics').update({ is_active: nextActive }).eq('id', topicId)
  if (error) redirect(topicPath(formData, error.message, true))

  revalidatePath('/dashboard/admin/topics')
  revalidatePath('/dashboard/admin/question-bank')
  revalidatePath('/dashboard/papers')
  redirect(topicPath(formData, nextActive ? 'Topic reactivated.' : 'Topic deactivated.'))
}

export async function reorderTopic(formData: FormData) {
  const supabase = await requireAdmin()
  const topicId = textValue(formData, 'topic_id')
  const direction = textValue(formData, 'direction') === 'up' ? -1 : 1
  if (!topicId) redirect(topicPath(formData, 'Topic not found.', true))

  const { data: topic } = await supabase.from('topics').select('id,subject_id,parent_topic_id,sort_order').eq('id', topicId).maybeSingle()
  if (!topic?.subject_id) redirect(topicPath(formData, 'Topic not found.', true))

  const query = supabase
    .from('topics')
    .select('id,sort_order,name')
    .eq('subject_id', topic.subject_id)
    .order('sort_order')
    .order('name')

  const { data: siblings } = topic.parent_topic_id ? await query.eq('parent_topic_id', topic.parent_topic_id) : await query.is('parent_topic_id', null)
  const index = (siblings ?? []).findIndex((item) => item.id === topicId)
  const swap = siblings?.[index + direction]
  if (!swap) redirect(topicPath(formData, 'Topic is already in that position.', true))

  const currentOrder = topic.sort_order ?? 0
  const swapOrder = swap.sort_order ?? 0
  const { error: firstError } = await supabase.from('topics').update({ sort_order: swapOrder }).eq('id', topicId)
  const { error: secondError } = await supabase.from('topics').update({ sort_order: currentOrder }).eq('id', swap.id)
  if (firstError || secondError) redirect(topicPath(formData, firstError?.message || secondError?.message || 'Could not reorder topic.', true))

  revalidatePath('/dashboard/admin/topics')
  revalidatePath('/dashboard/papers')
  redirect(topicPath(formData, 'Topic order updated.'))
}

export async function mergeSubtopics(formData: FormData) {
  const supabase = await requireAdmin()
  const sourceId = textValue(formData, 'source_topic_id')
  const targetId = textValue(formData, 'target_topic_id')
  if (!sourceId || !targetId || sourceId === targetId) redirect(topicPath(formData, 'Choose two different subtopics to merge.', true))

  const { data: topics } = await supabase
    .from('topics')
    .select('id,subject_id,parent_topic_id')
    .in('id', [sourceId, targetId])

  const source = topics?.find((topic) => topic.id === sourceId)
  const target = topics?.find((topic) => topic.id === targetId)
  if (!source?.parent_topic_id || !target?.parent_topic_id || source.subject_id !== target.subject_id || source.parent_topic_id !== target.parent_topic_id) {
    redirect(topicPath(formData, 'Merge is restricted to subtopics in the same topic group.', true))
  }

  const { data: sourceRows } = await supabase.from('question_topics').select('question_id,is_primary,confidence').eq('topic_id', sourceId)
  const { data: targetRows } = await supabase.from('question_topics').select('question_id,is_primary').eq('topic_id', targetId)
  const targetQuestionIds = new Set((targetRows ?? []).map((row) => row.question_id))
  const rowsToInsert = (sourceRows ?? [])
    .filter((row) => !targetQuestionIds.has(row.question_id))
    .map((row) => ({ question_id: row.question_id, topic_id: targetId, is_primary: row.is_primary ?? false, confidence: row.confidence ?? 'manual' }))

  if (rowsToInsert.length) {
    const { error } = await supabase.from('question_topics').insert(rowsToInsert)
    if (error) redirect(topicPath(formData, error.message, true))
  }

  const primaryQuestionIds = (sourceRows ?? [])
    .filter((row) => row.is_primary && targetQuestionIds.has(row.question_id))
    .map((row) => row.question_id)
  if (primaryQuestionIds.length) {
    const { error } = await supabase.from('question_topics').update({ is_primary: true }).eq('topic_id', targetId).in('question_id', primaryQuestionIds)
    if (error) redirect(topicPath(formData, error.message, true))
  }

  const { error: deleteError } = await supabase.from('question_topics').delete().eq('topic_id', sourceId)
  if (deleteError) redirect(topicPath(formData, deleteError.message, true))

  const { error: deactivateError } = await supabase.from('topics').update({ is_active: false }).eq('id', sourceId)
  if (deactivateError) redirect(topicPath(formData, deactivateError.message, true))

  revalidatePath('/dashboard/admin/topics')
  revalidatePath('/dashboard/admin/question-bank')
  revalidatePath('/dashboard/papers')
  redirect(topicPath(formData, 'Subtopics merged. The source topic was deactivated.'))
}
