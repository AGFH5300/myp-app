'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { uploadQuestionAsset } from '@/lib/question-assets'

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

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function numberValue(formData: FormData, key: string) {
  const value = Number(stringValue(formData, key))
  return Number.isFinite(value) ? value : null
}

async function ensurePaper(supabase: Awaited<ReturnType<typeof requireAdmin>>, formData: FormData) {
  const existingPaperId = stringValue(formData, 'paper_id')
  const newPaperTitle = stringValue(formData, 'new_paper_title')
  if (existingPaperId && !newPaperTitle) return existingPaperId

  const subjectId = stringValue(formData, 'new_paper_subject_id')
  const year = numberValue(formData, 'new_paper_year')
  const session = stringValue(formData, 'new_paper_session') || 'May'
  const level = stringValue(formData, 'new_paper_level') || 'Maths Extended'

  if (!newPaperTitle || !subjectId || !year) throw new Error('New papers need a title, subject, and year.')

  const { data: sessionRow, error: sessionError } = await supabase
    .from('exam_sessions')
    .upsert({ session_month: session, session_year: year, is_published: true }, { onConflict: 'session_month,session_year' })
    .select('id')
    .single()

  if (sessionError || !sessionRow) throw new Error('Could not create exam session.')

  const { data: paper, error: paperError } = await supabase
    .from('papers')
    .insert({
      subject_id: subjectId,
      exam_session_id: sessionRow.id,
      title: newPaperTitle,
      year,
      session,
      level,
      source_pdf_path: stringValue(formData, 'new_paper_source_pdf_path') || null,
      markscheme_pdf_path: stringValue(formData, 'new_paper_markscheme_pdf_path') || null,
      is_published: stringValue(formData, 'new_paper_is_published') === 'on',
      source_notes: 'Created from question bank admin.',
    })
    .select('id')
    .single()

  if (paperError || !paper) throw new Error('Could not create paper.')
  return paper.id
}

async function syncTopics(supabase: Awaited<ReturnType<typeof requireAdmin>>, questionId: string, formData: FormData) {
  const selectedTopicIds = formData.getAll('topic_ids').filter((value): value is string => typeof value === 'string' && value.length > 0)
  const newTopicName = stringValue(formData, 'new_topic_name')
  const primaryTopicId = stringValue(formData, 'primary_topic_id')
  const topicIds = [...selectedTopicIds]

  if (newTopicName) {
    const { data: topic, error } = await supabase
      .from('topics')
      .upsert({ name: newTopicName }, { onConflict: 'name' })
      .select('id')
      .single()

    if (error || !topic) throw new Error('Could not create topic.')
    topicIds.push(topic.id)
  }

  await supabase.from('question_topics').delete().eq('question_id', questionId)

  const uniqueTopicIds = Array.from(new Set(topicIds))
  if (!uniqueTopicIds.length) return

  const primary = primaryTopicId || uniqueTopicIds[0]
  const rows = uniqueTopicIds.map((topicId) => ({
    question_id: questionId,
    topic_id: topicId,
    is_primary: topicId === primary,
    confidence: 'manual',
  }))

  const { error } = await supabase.from('question_topics').insert(rows)
  if (error) throw new Error('Could not save topic tags.')
}

function questionPayload(formData: FormData, paperId: string, questionAssetPath: string | null, markschemeAssetPath: string | null) {
  const marks = numberValue(formData, 'marks')
  const questionOrder = numberValue(formData, 'question_order')
  const questionImagePath = questionAssetPath || stringValue(formData, 'question_image_path') || null
  const markschemeImagePath = markschemeAssetPath || stringValue(formData, 'markscheme_image_path') || null

  return {
    paper_id: paperId,
    question_number: stringValue(formData, 'question_number'),
    question_order: questionOrder,
    marks,
    prompt_text: stringValue(formData, 'prompt_text') || 'Question image provided in admin.',
    markscheme_text: stringValue(formData, 'markscheme_text') || null,
    image_url: stringValue(formData, 'image_url') || null,
    markscheme_image_url: stringValue(formData, 'markscheme_image_url') || null,
    question_image_path: questionImagePath,
    markscheme_image_path: markschemeImagePath,
    is_published: stringValue(formData, 'is_published') === 'on',
    is_reviewed: stringValue(formData, 'is_reviewed') === 'on',
  }
}

export async function createQuestion(formData: FormData) {
  const supabase = await requireAdmin()
  const paperId = await ensurePaper(supabase, formData)
  const questionFile = formData.get('question_image_file') instanceof File ? formData.get('question_image_file') as File : null
  const markschemeFile = formData.get('markscheme_image_file') instanceof File ? formData.get('markscheme_image_file') as File : null
  const questionAssetPath = await uploadQuestionAsset(supabase, questionFile, 'questions')
  const markschemeAssetPath = await uploadQuestionAsset(supabase, markschemeFile, 'markschemes')

  const { data: question, error } = await supabase
    .from('questions')
    .insert(questionPayload(formData, paperId, questionAssetPath, markschemeAssetPath))
    .select('id')
    .single()

  if (error || !question) throw new Error('Could not create question.')

  await syncTopics(supabase, question.id, formData)
  revalidatePath('/dashboard/admin/question-bank')
  redirect(`/dashboard/admin/question-bank/${question.id}/edit`)
}

export async function updateQuestion(formData: FormData) {
  const supabase = await requireAdmin()
  const questionId = stringValue(formData, 'question_id')
  const paperId = await ensurePaper(supabase, formData)
  const questionFile = formData.get('question_image_file') instanceof File ? formData.get('question_image_file') as File : null
  const markschemeFile = formData.get('markscheme_image_file') instanceof File ? formData.get('markscheme_image_file') as File : null
  const questionAssetPath = await uploadQuestionAsset(supabase, questionFile, 'questions')
  const markschemeAssetPath = await uploadQuestionAsset(supabase, markschemeFile, 'markschemes')

  const { error } = await supabase
    .from('questions')
    .update(questionPayload(formData, paperId, questionAssetPath, markschemeAssetPath))
    .eq('id', questionId)

  if (error) throw new Error('Could not update question.')

  await syncTopics(supabase, questionId, formData)
  revalidatePath('/dashboard/admin/question-bank')
  revalidatePath(`/dashboard/admin/question-bank/${questionId}/edit`)
  revalidatePath(`/practice/question/${questionId}`)
  redirect('/dashboard/admin/question-bank')
}
