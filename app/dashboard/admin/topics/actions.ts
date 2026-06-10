'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type TopicActionResult = { ok: true; message: string } | { ok: false; message: string }

const genericError = 'Could not update topic. Please try again.'

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

function fail(message = genericError): TopicActionResult {
  return { ok: false, message }
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

function revalidateTopicViews() {
  revalidatePath('/dashboard/admin/topics')
  revalidatePath('/dashboard/admin/question-bank')
  revalidatePath('/dashboard/papers')
}

export async function createTopic(formData: FormData): Promise<TopicActionResult> {
  const supabase = await requireAdmin()
  const subjectId = textValue(formData, 'subject_id')
  const parentTopicId = textValue(formData, 'parent_topic_id') || null
  const name = textValue(formData, 'name')

  if (!subjectId || !name) return fail('Topic name and subject are required.')

  if (parentTopicId) {
    const { data: parent } = await supabase.from('topics').select('id,subject_id').eq('id', parentTopicId).maybeSingle()
    if (!parent || parent.subject_id !== subjectId) return fail('Subtopics must belong to the selected subject and topic group.')
  }

  const slug = await uniqueSlug(supabase, name, subjectId, parentTopicId)
  const sortOrder = await nextSortOrder(supabase, subjectId, parentTopicId)
  const { error } = await supabase.from('topics').insert({
    subject_id: subjectId,
    parent_topic_id: parentTopicId,
    name,
    slug,
    sort_order: sortOrder,
    is_active: true,
  })

  if (error) return fail()
  revalidateTopicViews()
  return { ok: true, message: parentTopicId ? 'Subtopic added' : 'Topic group added' }
}

export async function renameTopic(formData: FormData): Promise<TopicActionResult> {
  const supabase = await requireAdmin()
  const topicId = textValue(formData, 'topic_id')
  const name = textValue(formData, 'name')
  if (!topicId || !name) return fail('Choose a topic and enter a new name.')

  const { data: topic } = await supabase.from('topics').select('id,subject_id,parent_topic_id').eq('id', topicId).maybeSingle()
  if (!topic?.subject_id) return fail('Topic not found.')

  const slug = await uniqueSlug(supabase, name, topic.subject_id, topic.parent_topic_id ?? null, topicId)
  const { error } = await supabase.from('topics').update({ name, slug }).eq('id', topicId)
  if (error) return fail()

  revalidateTopicViews()
  return { ok: true, message: topic.parent_topic_id ? 'Subtopic renamed' : 'Topic group renamed' }
}

export async function toggleTopicActive(formData: FormData): Promise<TopicActionResult> {
  const supabase = await requireAdmin()
  const topicId = textValue(formData, 'topic_id')
  const nextActive = textValue(formData, 'next_active') === 'true'
  if (!topicId) return fail('Topic not found.')

  const { data: topic } = await supabase.from('topics').select('id,parent_topic_id').eq('id', topicId).maybeSingle()
  if (!topic) return fail('Topic not found.')

  if (!nextActive && !topic.parent_topic_id) {
    const { count } = await supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .eq('parent_topic_id', topicId)
      .eq('is_active', true)
    if ((count ?? 0) > 0) return fail('Deactivate active subtopics first, then deactivate the topic group.')
  }

  const { error } = await supabase.from('topics').update({ is_active: nextActive }).eq('id', topicId)
  if (error) return fail()

  revalidateTopicViews()
  const noun = topic.parent_topic_id ? 'Subtopic' : 'Topic group'
  return { ok: true, message: `${noun} ${nextActive ? 'reactivated' : 'deactivated'}` }
}

export async function reorderTopic(formData: FormData): Promise<TopicActionResult> {
  const supabase = await requireAdmin()
  const topicId = textValue(formData, 'topic_id')
  const direction = textValue(formData, 'direction') === 'up' ? -1 : 1
  if (!topicId) return fail('Topic not found.')

  const { data: topic } = await supabase.from('topics').select('id,subject_id,parent_topic_id,sort_order').eq('id', topicId).maybeSingle()
  if (!topic?.subject_id) return fail('Topic not found.')

  const query = supabase
    .from('topics')
    .select('id,sort_order,name')
    .eq('subject_id', topic.subject_id)
    .order('sort_order')
    .order('name')

  const { data: siblings } = topic.parent_topic_id ? await query.eq('parent_topic_id', topic.parent_topic_id) : await query.is('parent_topic_id', null)
  const index = (siblings ?? []).findIndex((item) => item.id === topicId)
  const swap = siblings?.[index + direction]
  if (!swap) return fail('Topic is already in that position.')

  const currentOrder = topic.sort_order ?? 0
  const swapOrder = swap.sort_order ?? 0
  const { error: firstError } = await supabase.from('topics').update({ sort_order: swapOrder }).eq('id', topicId)
  const { error: secondError } = await supabase.from('topics').update({ sort_order: currentOrder }).eq('id', swap.id)
  if (firstError || secondError) return fail()

  revalidatePath('/dashboard/admin/topics')
  revalidatePath('/dashboard/papers')
  return { ok: true, message: topic.parent_topic_id ? 'Subtopic reordered' : 'Topic group reordered' }
}

export async function mergeSubtopics(formData: FormData): Promise<TopicActionResult> {
  const supabase = await requireAdmin()
  const sourceId = textValue(formData, 'source_topic_id')
  const targetId = textValue(formData, 'target_topic_id')
  if (!sourceId || !targetId || sourceId === targetId) return fail('Choose two different subtopics to merge.')

  const { data: topics } = await supabase
    .from('topics')
    .select('id,subject_id,parent_topic_id')
    .in('id', [sourceId, targetId])

  const source = topics?.find((topic) => topic.id === sourceId)
  const target = topics?.find((topic) => topic.id === targetId)
  if (!source?.parent_topic_id || !target?.parent_topic_id || source.subject_id !== target.subject_id || source.parent_topic_id !== target.parent_topic_id) {
    return fail('Merge is restricted to subtopics in the same topic group.')
  }

  const { data: sourceRows } = await supabase.from('question_topics').select('question_id,is_primary,confidence').eq('topic_id', sourceId)
  const { data: targetRows } = await supabase.from('question_topics').select('question_id,is_primary').eq('topic_id', targetId)
  const targetQuestionIds = new Set((targetRows ?? []).map((row) => row.question_id))
  const rowsToInsert = (sourceRows ?? [])
    .filter((row) => !targetQuestionIds.has(row.question_id))
    .map((row) => ({ question_id: row.question_id, topic_id: targetId, is_primary: row.is_primary ?? false, confidence: row.confidence ?? 'manual' }))

  if (rowsToInsert.length) {
    const { error } = await supabase.from('question_topics').insert(rowsToInsert)
    if (error) return fail()
  }

  const primaryQuestionIds = (sourceRows ?? [])
    .filter((row) => row.is_primary && targetQuestionIds.has(row.question_id))
    .map((row) => row.question_id)
  if (primaryQuestionIds.length) {
    const { error } = await supabase.from('question_topics').update({ is_primary: true }).eq('topic_id', targetId).in('question_id', primaryQuestionIds)
    if (error) return fail()
  }

  const { error: deleteError } = await supabase.from('question_topics').delete().eq('topic_id', sourceId)
  if (deleteError) return fail()

  const { error: deactivateError } = await supabase.from('topics').update({ is_active: false }).eq('id', sourceId)
  if (deactivateError) return fail()

  revalidateTopicViews()
  return { ok: true, message: 'Subtopics merged' }
}
