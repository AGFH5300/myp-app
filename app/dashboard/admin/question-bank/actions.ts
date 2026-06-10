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
  const level = stringValue(formData, 'new_paper_level') || null

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
  const primaryTopicId = stringValue(formData, 'primary_topic_id')
  const uniqueTopicIds = Array.from(new Set(selectedTopicIds.filter(Boolean)))

  await supabase.from('question_topics').delete().eq('question_id', questionId)
  if (!uniqueTopicIds.length) return

  const primary = uniqueTopicIds.includes(primaryTopicId) ? primaryTopicId : uniqueTopicIds[0]
  const rows = uniqueTopicIds.map((topicId) => ({
    question_id: questionId,
    topic_id: topicId,
    is_primary: topicId === primary,
    confidence: 'manual',
  }))

  const { error } = await supabase.from('question_topics').insert(rows)
  if (error) throw new Error('Could not save topic tags.')
}

function uploadedFiles(formData: FormData, key: string) {
  return formData.getAll(key).filter((value): value is File => value instanceof File && value.size > 0)
}

async function uploadQuestionAssets(supabase: Awaited<ReturnType<typeof requireAdmin>>, files: File[], folder: 'questions' | 'markschemes') {
  const paths: string[] = []
  for (const file of files) {
    const path = await uploadQuestionAsset(supabase, file, folder)
    if (path) paths.push(path)
  }
  return paths
}

type InsertedAsset = { id: string; storage_path: string | null }

async function insertQuestionAssets(
  supabase: Awaited<ReturnType<typeof requireAdmin>>,
  questionId: string,
  assetType: 'question' | 'markscheme',
  paths: string[],
) {
  if (!paths.length) return [] as InsertedAsset[]

  const labelPrefix = assetType === 'question' ? 'Question image' : 'Mark scheme image'
  const { data, error } = await supabase
    .from('question_assets')
    .insert(paths.map((path, index) => ({
      question_id: questionId,
      asset_type: assetType,
      storage_path: path,
      label: `${labelPrefix} ${index + 1}`,
      sort_order: index,
    })))
    .select('id,storage_path')

  if (error || !data) throw new Error('Could not save uploaded image records.')
  return data as InsertedAsset[]
}

function formStrings(formData: FormData, key: string) {
  return formData.getAll(key).filter((value): value is string => typeof value === 'string' && value.length > 0)
}

async function applyAssetOrder(
  supabase: Awaited<ReturnType<typeof requireAdmin>>,
  questionId: string,
  assetType: 'question' | 'markscheme',
  orderKey: string,
  fileKey: string,
  insertedAssets: InsertedAsset[],
  formData: FormData,
) {
  const submittedOrder = formStrings(formData, orderKey)
  const fileKeys = formStrings(formData, fileKey)
  const insertedByToken = new Map(fileKeys.map((key, index) => [`new:${key}`, insertedAssets[index]]))
  const existingIds = submittedOrder.filter((token) => token.startsWith('existing:')).map((token) => token.replace('existing:', ''))

  const { data: existingAssets, error: existingError } = await supabase
    .from('question_assets')
    .select('id,storage_path,public_url')
    .eq('question_id', questionId)
    .eq('asset_type', assetType)
    .in('id', existingIds.length ? existingIds : ['00000000-0000-0000-0000-000000000000'])

  if (existingError) throw new Error('Could not read existing image records.')
  const existingById = new Map((existingAssets ?? []).map((asset) => [asset.id as string, asset as { id: string; storage_path: string | null; public_url: string | null }]))
  const labelPrefix = assetType === 'question' ? 'Question image' : 'Mark scheme image'
  const orderedAssets = submittedOrder
    .map((token) => token.startsWith('new:') ? insertedByToken.get(token) : existingById.get(token.replace('existing:', '')))
    .filter((asset): asset is InsertedAsset & { public_url?: string | null } => Boolean(asset))

  for (const [index, asset] of orderedAssets.entries()) {
    const { error } = await supabase
      .from('question_assets')
      .update({ sort_order: index, label: `${labelPrefix} ${index + 1}` })
      .eq('id', asset.id)
      .eq('question_id', questionId)
    if (error) throw new Error('Could not save image order.')
  }

  return orderedAssets[0]?.storage_path || orderedAssets[0]?.public_url || null
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

async function createQuestionRecord(supabase: Awaited<ReturnType<typeof requireAdmin>>, formData: FormData) {
  const paperId = await ensurePaper(supabase, formData)
  const questionAssetPaths = await uploadQuestionAssets(supabase, uploadedFiles(formData, 'question_image_file'), 'questions')
  const markschemeAssetPaths = await uploadQuestionAssets(supabase, uploadedFiles(formData, 'markscheme_image_file'), 'markschemes')
  const questionAssetPath = questionAssetPaths[0] || null
  const markschemeAssetPath = markschemeAssetPaths[0] || null

  const { data: question, error } = await supabase
    .from('questions')
    .insert(questionPayload(formData, paperId, questionAssetPath, markschemeAssetPath))
    .select('id,paper_id,question_number,question_order')
    .single()

  if (error || !question) throw new Error('Could not create question.')

  const insertedQuestionAssets = await insertQuestionAssets(supabase, question.id, 'question', questionAssetPaths)
  const insertedMarkschemeAssets = await insertQuestionAssets(supabase, question.id, 'markscheme', markschemeAssetPaths)
  const firstQuestionAssetPath = await applyAssetOrder(supabase, question.id, 'question', 'question_asset_order', 'question_file_key', insertedQuestionAssets, formData)
  const firstMarkschemeAssetPath = await applyAssetOrder(supabase, question.id, 'markscheme', 'markscheme_asset_order', 'markscheme_file_key', insertedMarkschemeAssets, formData)
  await supabase.from('questions').update({
    question_image_path: firstQuestionAssetPath || questionAssetPath || stringValue(formData, 'question_image_path') || null,
    markscheme_image_path: firstMarkschemeAssetPath || markschemeAssetPath || stringValue(formData, 'markscheme_image_path') || null,
  }).eq('id', question.id)
  await syncTopics(supabase, question.id, formData)
  revalidatePath('/dashboard/admin/question-bank')
  revalidatePath(`/dashboard/admin/question-bank/${question.id}/edit`)
  return {
    questionId: question.id as string,
    paperId: question.paper_id as string,
    questionNumber: question.question_number as string | null,
    questionOrder: question.question_order as number | null,
  }
}

export async function createQuestion(formData: FormData) {
  const supabase = await requireAdmin()
  try {
    const { questionId } = await createQuestionRecord(supabase, formData)
    return { ok: true as const, questionId, message: 'Question created' }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not create question.' }
  }
}

export async function createQuestionForPdfFlow(formData: FormData) {
  const supabase = await requireAdmin()
  try {
    const created = await createQuestionRecord(supabase, formData)
    const { data: paper } = await supabase
      .from('papers')
      .select('id,title,year,level,subjects(id,name),exam_sessions(session_month)')
      .eq('id', created.paperId)
      .maybeSingle()

    return { ok: true as const, ...created, paper: paper ?? null, message: 'Question created' }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not create question.' }
  }
}

export async function updateQuestion(formData: FormData) {
  const supabase = await requireAdmin()
  try {
    const questionId = stringValue(formData, 'question_id')
    const paperId = await ensurePaper(supabase, formData)
    const questionAssetPaths = await uploadQuestionAssets(supabase, uploadedFiles(formData, 'question_image_file'), 'questions')
    const markschemeAssetPaths = await uploadQuestionAssets(supabase, uploadedFiles(formData, 'markscheme_image_file'), 'markschemes')
    const questionAssetPath = questionAssetPaths[0] || null
    const markschemeAssetPath = markschemeAssetPaths[0] || null

    const { error } = await supabase
      .from('questions')
      .update(questionPayload(formData, paperId, questionAssetPath, markschemeAssetPath))
      .eq('id', questionId)

    if (error) throw new Error('Could not update question.')

    const insertedQuestionAssets = await insertQuestionAssets(supabase, questionId, 'question', questionAssetPaths)
    const insertedMarkschemeAssets = await insertQuestionAssets(supabase, questionId, 'markscheme', markschemeAssetPaths)
    const firstQuestionAssetPath = await applyAssetOrder(supabase, questionId, 'question', 'question_asset_order', 'question_file_key', insertedQuestionAssets, formData)
    const firstMarkschemeAssetPath = await applyAssetOrder(supabase, questionId, 'markscheme', 'markscheme_asset_order', 'markscheme_file_key', insertedMarkschemeAssets, formData)
    await supabase.from('questions').update({
      question_image_path: firstQuestionAssetPath || questionAssetPath || stringValue(formData, 'question_image_path') || null,
      markscheme_image_path: firstMarkschemeAssetPath || markschemeAssetPath || stringValue(formData, 'markscheme_image_path') || null,
    }).eq('id', questionId)
    await syncTopics(supabase, questionId, formData)
    revalidatePath('/dashboard/admin/question-bank')
    revalidatePath(`/dashboard/admin/question-bank/${questionId}/edit`)
    revalidatePath(`/practice/question/${questionId}`)
    return { ok: true as const, questionId, message: 'Question updated' }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Could not update question.' }
  }
}
