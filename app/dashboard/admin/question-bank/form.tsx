"use client"

import Image from 'next/image'
import Link from 'next/link'
import { ChangeEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { createQuestion, updateQuestion } from './actions'

type PaperRelation<T> = T | T[] | null
type Paper = { id: string; title: string; year: number; level: string | null; subjects?: PaperRelation<{ id?: string | null; name?: string | null }>; exam_sessions?: PaperRelation<{ session_month?: string | null }> }
type Subject = { id: string; name: string }
type Topic = { id: string; name: string; subject_id?: string | null; parent_topic_id?: string | null; level?: string | null; sort_order?: number | null; is_active?: boolean | null }
type QuestionTopic = { topic_id: string; is_primary?: boolean | null }
type QuestionAsset = { id: string; asset_type: 'question' | 'markscheme'; storage_path: string | null; public_url: string | null; label: string | null; sort_order: number | null; preview_url?: string | null }
type Question = {
  id: string
  paper_id: string
  question_number: string
  question_order: number | null
  marks: number | null
  prompt_text: string | null
  markscheme_text: string | null
  image_url: string | null
  markscheme_image_url: string | null
  question_image_path: string | null
  markscheme_image_path: string | null
  is_published: boolean
  is_reviewed: boolean
  question_topics?: QuestionTopic[] | null
}

type StepState = 'complete' | 'current' | 'locked' | 'missing'
type LocalPreview = { name: string; url: string }

function relationLabel(relation: unknown, key: 'id' | 'name' | 'session_month') {
  const item = Array.isArray(relation) ? relation[0] : relation
  return (item as Record<string, string | null | undefined> | null | undefined)?.[key] || ''
}

function paperLabel(paper: Paper) {
  const rawSession = relationLabel(paper.exam_sessions, 'session_month') || 'Session'
  const session = rawSession.toLowerCase().startsWith('nov') ? 'Nov' : rawSession.toLowerCase().startsWith('may') ? 'May' : rawSession
  return `${paper.title} — ${session} ${paper.year}`
}

function topicMatchesMainScope(topic: Topic, subjectId: string) {
  return topic.is_active !== false && Boolean(subjectId) && topic.subject_id === subjectId
}

function topicMatchesLegacyScope(topic: Topic, subjectId: string) {
  return topic.is_active !== false && topic.subject_id !== subjectId
}

function statusBadgeClasses(state: StepState) {
  if (state === 'complete') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (state === 'current') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (state === 'missing') return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-slate-200 bg-slate-100 text-slate-500'
}

function StepCard({ step, title, state, helper, children }: { step: number; title: string; state: StepState; helper: string; children: ReactNode }) {
  const locked = state === 'locked'
  const border = state === 'complete' ? 'border-emerald-300' : state === 'current' ? 'border-blue-300 shadow-sm' : state === 'missing' ? 'border-amber-300' : 'border-[#c3c6ce66] opacity-75'
  const label = state === 'complete' ? 'Complete' : state === 'current' ? 'Current step' : state === 'missing' ? 'Needs attention' : 'Locked'

  return (
    <section className={`rounded-md border bg-white p-6 ${border}`} data-disabled={locked ? 'true' : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-label text-xs uppercase tracking-[.16em] text-[#735b2b]">Step {step}</p>
          <h2 className="font-headline text-2xl text-[#00152a]">{title}</h2>
          <p className="mt-1 font-body text-sm text-[#43474d]">{helper}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 font-body text-xs font-semibold ${statusBadgeClasses(state)}`}>{state === 'complete' ? '✓ ' : ''}{label}</span>
      </div>
      {locked ? <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 font-body text-sm text-slate-600">Complete the earlier step to unlock this section.</p> : null}
      <div className={locked ? 'pointer-events-none mt-5 opacity-50' : 'mt-5'}>{children}</div>
    </section>
  )
}

function ChoiceCard({ active, title, helper, onClick }: { active: boolean; title: string; helper: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`cursor-pointer rounded-md border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-300 ${active ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-[#c3c6ce66] bg-white hover:border-blue-300 hover:bg-blue-50/40'}`}>
      <span className={`inline-flex rounded-full px-2 py-1 font-body text-xs font-semibold ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{active ? 'Selected' : 'Choose'}</span>
      <h3 className="mt-3 font-headline text-xl text-[#00152a]">{title}</h3>
      <p className="mt-1 font-body text-sm text-[#43474d]">{helper}</p>
    </button>
  )
}

function UploadBox({ name, label, helper, onFiles }: { name: string; label: string; helper: string; onFiles: (files: File[]) => void }) {
  const inputId = `${name}-input`

  return (
    <label htmlFor={inputId} className="block cursor-pointer rounded-md border-2 border-dashed border-blue-200 bg-blue-50/50 p-5 font-body text-sm text-[#43474d] transition hover:border-blue-400 hover:bg-blue-50 focus-within:ring-2 focus-within:ring-blue-300">
      <span className="block font-semibold text-[#00152a]">{label}</span>
      <span className="mt-1 block">{helper}</span>
      <span className="mt-4 inline-flex rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Upload images</span>
      <input id={inputId} name={name} type="file" accept="image/*" multiple className="sr-only" onChange={(event) => onFiles(Array.from(event.target.files ?? []))} />
    </label>
  )
}

function buildLocalPreviews(files: File[]) {
  return files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) }))
}

export function QuestionBankForm({
  mode,
  papers,
  subjects,
  topics,
  question,
  questionPreviewUrl,
  markschemePreviewUrl,
  questionAssets = [],
}: {
  mode: 'new' | 'edit'
  papers: Paper[]
  subjects: Subject[]
  topics: Topic[]
  question?: Question | null
  questionPreviewUrl?: string | null
  markschemePreviewUrl?: string | null
  questionAssets?: QuestionAsset[]
}) {
  const currentPaper = papers.find((paper) => paper.id === question?.paper_id)
  const defaultSubjectId = relationLabel(currentPaper?.subjects, 'id') || subjects.find((subject) => subject.name === 'Mathematics Extended')?.id || subjects.find((subject) => subject.name === 'Mathematics')?.id || subjects[0]?.id || ''
  const primaryTopicIdFromQuestion = question?.question_topics?.find((row) => row.is_primary)?.topic_id || ''
  const primaryTopic = topics.find((topic) => topic.id === primaryTopicIdFromQuestion)
  const action = mode === 'new' ? createQuestion : updateQuestion

  const [paperMode, setPaperMode] = useState<'existing' | 'new'>(question?.paper_id ? 'existing' : 'existing')
  const [subjectId, setSubjectId] = useState(defaultSubjectId)
  const [paperId, setPaperId] = useState(question?.paper_id || '')
  const selectedSubjectName = subjects.find((subject) => subject.id === subjectId)?.name || ''
  const [newPaperTitle, setNewPaperTitle] = useState('')
  const [newPaperYear, setNewPaperYear] = useState('2025')
  const [newPaperSession, setNewPaperSession] = useState('May')
  const [questionNumber, setQuestionNumber] = useState(question?.question_number || '')
  const [topicGroupId, setTopicGroupId] = useState(primaryTopic?.parent_topic_id || primaryTopic?.id || '')
  const [primaryTopicId, setPrimaryTopicId] = useState(primaryTopicIdFromQuestion)
  const [newTopicName, setNewTopicName] = useState('')
  const [published, setPublished] = useState(question?.is_published ?? false)
  const [reviewed, setReviewed] = useState(question?.is_reviewed ?? false)
  const [questionFiles, setQuestionFiles] = useState<LocalPreview[]>([])
  const [markschemeFiles, setMarkschemeFiles] = useState<LocalPreview[]>([])
  const selectedTopics = new Set(question?.question_topics?.map((row) => row.topic_id) ?? [])

  useEffect(() => () => {
    questionFiles.forEach((file) => URL.revokeObjectURL(file.url))
  }, [questionFiles])

  useEffect(() => () => {
    markschemeFiles.forEach((file) => URL.revokeObjectURL(file.url))
  }, [markschemeFiles])

  function updateQuestionFiles(files: File[]) {
    questionFiles.forEach((file) => URL.revokeObjectURL(file.url))
    setQuestionFiles(buildLocalPreviews(files))
  }

  function updateMarkschemeFiles(files: File[]) {
    markschemeFiles.forEach((file) => URL.revokeObjectURL(file.url))
    setMarkschemeFiles(buildLocalPreviews(files))
  }

  function updateSubject(event: ChangeEvent<HTMLSelectElement>) {
    setSubjectId(event.target.value)
    setPaperId('')
    setTopicGroupId('')
    setPrimaryTopicId('')
  }


  const filteredPapers = papers.filter((paper) => {
    const paperSubjectId = relationLabel(paper.subjects, 'id')
    return !subjectId || paperSubjectId === subjectId
  })

  const mainTopicGroups = useMemo(() => topics
    .filter((topic) => !topic.parent_topic_id && topicMatchesMainScope(topic, subjectId))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)), [topics, subjectId])

  const subtopics = useMemo(() => topics
    .filter((topic) => topic.parent_topic_id === topicGroupId && topicMatchesMainScope(topic, subjectId))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)), [topics, topicGroupId, subjectId])

  const legacyTopics = useMemo(() => topics
    .filter((topic) => topic.id !== primaryTopicId && topic.id !== topicGroupId && topicMatchesLegacyScope(topic, subjectId))
    .sort((a, b) => a.name.localeCompare(b.name)), [topics, primaryTopicId, topicGroupId, subjectId])

  const existingQuestionAssets = questionAssets.filter((asset) => asset.asset_type === 'question')
  const existingMarkschemeAssets = questionAssets.filter((asset) => asset.asset_type === 'markscheme')
  const hasExistingQuestionImage = Boolean(questionPreviewUrl || existingQuestionAssets.length)
  const hasQuestionImage = hasExistingQuestionImage || questionFiles.length > 0
  const step1Complete = paperMode === 'existing' ? Boolean(subjectId && paperId) : Boolean(subjectId && newPaperTitle && newPaperYear && newPaperSession)
  const step2Complete = Boolean(questionNumber.trim())
  const step3Complete = hasQuestionImage
  const step4Complete = Boolean(topicGroupId)
  const readyToSubmit = step1Complete && step2Complete && step3Complete && step4Complete

  const step1State: StepState = step1Complete ? 'complete' : 'current'
  const step2State: StepState = !step1Complete ? 'locked' : step2Complete ? 'complete' : 'current'
  const step3State: StepState = !step1Complete || !step2Complete ? 'locked' : step3Complete ? 'complete' : 'missing'
  const step4State: StepState = !step1Complete || !step2Complete || !step3Complete ? 'locked' : step4Complete ? 'complete' : 'current'

  return (
    <form action={action} className="space-y-8" onSubmit={(event) => { if (!readyToSubmit) event.preventDefault() }}>
      {question ? <input type="hidden" name="question_id" value={question.id} /> : null}
      <input type="hidden" name="paper_id" value={paperMode === 'existing' ? paperId : ''} />
      <input type="hidden" name="primary_topic_id" value={primaryTopicId || topicGroupId} />
      <input type="hidden" name="existing_question_asset_count" value={existingQuestionAssets.length} />
      <input type="hidden" name="existing_markscheme_asset_count" value={existingMarkschemeAssets.length} />
      <input type="hidden" name="new_paper_level" value={selectedSubjectName} />

      <StepCard step={1} title="Paper setup" state={step1State} helper="Choose whether this question belongs to an existing paper or a new paper record.">
        <div className="grid gap-4 md:grid-cols-2">
          <ChoiceCard active={paperMode === 'existing'} title="Add to existing paper" helper="Pick a subject, then choose one matching paper." onClick={() => setPaperMode('existing')} />
          <ChoiceCard active={paperMode === 'new'} title="Create new paper" helper="Create a simple paper record first, then attach this question." onClick={() => { setPaperMode('new'); setPaperId('') }} />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label htmlFor="admin-question-subject" className="font-body text-sm text-[#43474d]">Subject<select id="admin-question-subject" name="new_paper_subject_id" value={subjectId} onChange={updateSubject} className="tsm-input mt-1 w-full cursor-pointer" required><option value="">Choose subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
        </div>
        {paperMode === 'existing' ? (
          <div className="mt-5 rounded-md border border-blue-100 bg-blue-50/40 p-4">
            <label htmlFor="admin-question-paper" className="font-body text-sm text-[#43474d]">Matching existing paper<select id="admin-question-paper" value={paperId} onChange={(event) => setPaperId(event.target.value)} className="tsm-input mt-1 w-full cursor-pointer"><option value="">Choose a paper</option>{filteredPapers.map((paper) => <option key={paper.id} value={paper.id}>{paperLabel(paper)}</option>)}</select></label>
            {!filteredPapers.length ? <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 font-body text-sm text-amber-800">No papers found for this subject. Create a new paper first. <button type="button" className="cursor-pointer font-semibold underline" onClick={() => setPaperMode('new')}>Create a new paper instead.</button></div> : null}
          </div>
        ) : (
          <div className="mt-5 rounded-md border border-blue-100 bg-blue-50/40 p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <label htmlFor="admin-question-new-paper-year" className="font-body text-sm text-[#43474d]">Year<input id="admin-question-new-paper-year" name="new_paper_year" type="number" min="2016" max="2030" className="tsm-input mt-1 w-full" value={newPaperYear} onChange={(event) => setNewPaperYear(event.target.value)} /></label>
              <label htmlFor="admin-question-new-paper-session" className="font-body text-sm text-[#43474d]">Session<select id="admin-question-new-paper-session" name="new_paper_session" className="tsm-input mt-1 w-full" value={newPaperSession} onChange={(event) => setNewPaperSession(event.target.value)}><option value="May">May</option><option value="November">November</option></select></label>
              <label htmlFor="admin-question-new-paper-title" className="font-body text-sm text-[#43474d]">Paper title/code<input id="admin-question-new-paper-title" name="new_paper_title" className="tsm-input mt-1 w-full" value={newPaperTitle} onChange={(event) => setNewPaperTitle(event.target.value)} placeholder="M25 Maths Extended" /></label>
            </div>
            <details className="mt-4 rounded-sm border border-[#c3c6ce66] bg-white p-4">
              <summary className="cursor-pointer font-body font-semibold text-[#735b2b]">Advanced paper options</summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label htmlFor="admin-question-source-pdf" className="font-body text-sm text-[#43474d]">Source PDF path<input id="admin-question-source-pdf" name="new_paper_source_pdf_path" className="tsm-input mt-1 w-full" placeholder="optional private path" /></label>
                <label htmlFor="admin-question-markscheme-pdf" className="font-body text-sm text-[#43474d]">Mark scheme PDF path<input id="admin-question-markscheme-pdf" name="new_paper_markscheme_pdf_path" className="tsm-input mt-1 w-full" placeholder="optional private path" /></label>
                <label htmlFor="admin-question-new-paper-published" className="flex cursor-pointer items-center gap-2 font-body text-sm text-[#43474d]"><input id="admin-question-new-paper-published" type="checkbox" name="new_paper_is_published" defaultChecked /> Show paper to students</label>
              </div>
            </details>
          </div>
        )}
      </StepCard>

      <StepCard step={2} title="Question details" state={step2State} helper="Add the simple labels students and admins use to find this question.">
        <div className="grid gap-4 md:grid-cols-3">
          <label htmlFor="admin-question-number" className="font-body text-sm text-[#43474d]">Question number<input id="admin-question-number" name="question_number" required className="tsm-input mt-1 w-full" value={questionNumber} onChange={(event) => setQuestionNumber(event.target.value)} placeholder="1a" /><span className="mt-1 block text-xs text-[#6f737b]">Use the number students see in the paper, for example 1a or 3(b).</span></label>
          <label htmlFor="admin-question-marks" className="font-body text-sm text-[#43474d]">Marks<input id="admin-question-marks" name="marks" type="number" min="0" className="tsm-input mt-1 w-full" defaultValue={question?.marks ?? ''} /></label>
          <label htmlFor="admin-question-order" className="font-body text-sm text-[#43474d]">Display order<input id="admin-question-order" name="question_order" type="number" className="tsm-input mt-1 w-full" defaultValue={question?.question_order ?? ''} placeholder="Optional" /><span className="mt-1 block text-xs text-[#6f737b]">Display order controls where it appears within the paper.</span></label>
        </div>
      </StepCard>

      <StepCard step={3} title="Images" state={step3State} helper="Upload one or more question crops, plus any matching mark scheme images.">
        {!hasQuestionImage ? <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 font-body text-sm text-amber-800">At least one question image is required before topics and publishing unlock.</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <UploadBox name="question_image_file" label="Question images" helper="Upload multiple screenshots/crops if the question spans more than one image." onFiles={updateQuestionFiles} />
          <UploadBox name="markscheme_image_file" label="Mark scheme images" helper="Optional, but you can upload multiple matching mark scheme crops." onFiles={updateMarkschemeFiles} />
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div>
            <h3 className="font-body text-sm font-semibold text-[#00152a]">Question previews</h3>
            <div className="mt-3 grid gap-3">
              {existingQuestionAssets.map((asset, index) => asset.preview_url ? <PreviewCard key={asset.id} title={asset.label || `Question image ${index + 1}`} url={asset.preview_url} order={index + 1} /> : null)}
              {!existingQuestionAssets.length && questionPreviewUrl ? <PreviewCard title="Question image 1" url={questionPreviewUrl} order={1} /> : null}
              {questionFiles.map((file, index) => <PreviewCard key={file.url} title={`New question image ${index + 1}`} url={file.url} subtitle={file.name} order={existingQuestionAssets.length + index + 1} />)}
              {!hasExistingQuestionImage && !questionFiles.length ? <p className="rounded-md border border-dashed border-slate-200 p-4 font-body text-sm text-slate-500">No question images selected yet.</p> : null}
            </div>
          </div>
          <div>
            <h3 className="font-body text-sm font-semibold text-[#00152a]">Mark scheme previews</h3>
            <div className="mt-3 grid gap-3">
              {existingMarkschemeAssets.map((asset, index) => asset.preview_url ? <PreviewCard key={asset.id} title={asset.label || `Mark scheme image ${index + 1}`} url={asset.preview_url} order={index + 1} /> : null)}
              {!existingMarkschemeAssets.length && markschemePreviewUrl ? <PreviewCard title="Mark scheme image 1" url={markschemePreviewUrl} order={1} /> : null}
              {markschemeFiles.map((file, index) => <PreviewCard key={file.url} title={`New mark scheme image ${index + 1}`} url={file.url} subtitle={file.name} order={existingMarkschemeAssets.length + index + 1} />)}
              {!existingMarkschemeAssets.length && !markschemePreviewUrl && !markschemeFiles.length ? <p className="rounded-md border border-dashed border-slate-200 p-4 font-body text-sm text-slate-500">No mark scheme images selected yet.</p> : null}
            </div>
          </div>
        </div>
        <details className="mt-5 rounded-sm bg-[#f5f3ee] p-4">
          <summary className="cursor-pointer font-body font-semibold text-[#735b2b]">Advanced image and text options</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label htmlFor="admin-question-image-path" className="font-body text-sm text-[#43474d]">Direct question image path<input id="admin-question-image-path" name="question_image_path" className="tsm-input mt-1 w-full" defaultValue={question?.question_image_path || ''} placeholder="questions/file.png" /></label>
            <label htmlFor="admin-question-markscheme-path" className="font-body text-sm text-[#43474d]">Direct mark scheme image path<input id="admin-question-markscheme-path" name="markscheme_image_path" className="tsm-input mt-1 w-full" defaultValue={question?.markscheme_image_path || ''} placeholder="markschemes/file.png" /></label>
            <label htmlFor="admin-question-image-url" className="font-body text-sm text-[#43474d]">Fallback public question image URL<input id="admin-question-image-url" name="image_url" className="tsm-input mt-1 w-full" defaultValue={question?.image_url || ''} /></label>
            <label htmlFor="admin-question-markscheme-url" className="font-body text-sm text-[#43474d]">Fallback public mark scheme image URL<input id="admin-question-markscheme-url" name="markscheme_image_url" className="tsm-input mt-1 w-full" defaultValue={question?.markscheme_image_url || ''} /></label>
            <label htmlFor="admin-question-prompt-text" className="md:col-span-2 font-body text-sm text-[#43474d]">Question placeholder text<textarea id="admin-question-prompt-text" name="prompt_text" className="tsm-input mt-1 min-h-24 w-full" defaultValue={question?.prompt_text || ''} placeholder="Use only if there is no image yet." /></label>
            <label htmlFor="admin-question-markscheme-text" className="md:col-span-2 font-body text-sm text-[#43474d]">Mark scheme placeholder text<textarea id="admin-question-markscheme-text" name="markscheme_text" className="tsm-input mt-1 min-h-24 w-full" defaultValue={question?.markscheme_text || ''} /></label>
          </div>
        </details>
      </StepCard>

      <StepCard step={4} title="Topics & publish" state={step4State} helper="Choose a topic group, then the exact subtopic. Publish only when checked.">
        <div className="grid gap-4 md:grid-cols-2">
          <label htmlFor="admin-question-topic-group" className="font-body text-sm text-[#43474d]">Topic group<select id="admin-question-topic-group" name="topic_group_id" value={topicGroupId} onChange={(event) => { setTopicGroupId(event.target.value); setPrimaryTopicId('') }} className="tsm-input mt-1 w-full cursor-pointer"><option value="">Choose topic group</option>{mainTopicGroups.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
          <label htmlFor="admin-question-primary-topic" className="font-body text-sm text-[#43474d]">Exact subtopic<select id="admin-question-primary-topic" name="topic_ids" value={primaryTopicId || topicGroupId} onChange={(event) => setPrimaryTopicId(event.target.value)} className="tsm-input mt-1 w-full cursor-pointer"><option value={topicGroupId}>Use the topic group</option>{subtopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
          <label htmlFor="admin-question-new-topic" className="md:col-span-2 font-body text-sm text-[#43474d]">Optional: create new subtopic under selected group<input id="admin-question-new-topic" name="new_topic_name" className="tsm-input mt-1 w-full" value={newTopicName} onChange={(event) => setNewTopicName(event.target.value)} placeholder="e.g. Inequalities and feasible regions" /></label>
        </div>
        {!mainTopicGroups.length ? <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 font-body text-sm text-amber-800">No active topic groups match this subject. Create the group first, or use the legacy secondary section only for old data.</p> : null}
        <details className="mt-5 rounded-sm bg-[#f5f3ee] p-4">
          <summary className="cursor-pointer font-body font-semibold text-[#735b2b]">Legacy/global secondary topics</summary>
          <p className="mt-2 font-body text-sm text-[#43474d]">These are old/global topics. They are available only as secondary tags, not as the main topic.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {legacyTopics.map((topic) => <label key={topic.id} htmlFor={`admin-question-legacy-topic-${topic.id}`} className="flex cursor-pointer items-center gap-2 rounded-sm bg-white px-3 py-2 font-body text-sm text-[#43474d] hover:bg-blue-50"><input id={`admin-question-legacy-topic-${topic.id}`} type="checkbox" name="topic_ids" value={topic.id} defaultChecked={selectedTopics.has(topic.id)} /> {topic.name}</label>)}
            {!legacyTopics.length ? <p className="font-body text-sm text-[#43474d]">No legacy/global topics match this scope.</p> : null}
          </div>
        </details>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label htmlFor="admin-question-published" className={`cursor-pointer rounded-md border p-4 font-body text-sm transition hover:shadow-sm focus-within:ring-2 focus-within:ring-emerald-300 ${published ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}><span className="mb-2 inline-flex rounded-full bg-white px-2 py-1 text-xs font-semibold">{published ? 'Show to students' : 'Save as draft'}</span><span className="flex items-center gap-2"><input id="admin-question-published" type="checkbox" name="is_published" checked={published} onChange={(event) => setPublished(event.target.checked)} /> Published</span><span className="mt-1 block text-xs">Draft questions stay hidden from student practice pages.</span></label>
          <label htmlFor="admin-question-reviewed" className={`cursor-pointer rounded-md border p-4 font-body text-sm transition hover:shadow-sm focus-within:ring-2 focus-within:ring-blue-300 ${reviewed ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><span className="mb-2 inline-flex rounded-full bg-white px-2 py-1 text-xs font-semibold">{reviewed ? 'Checked and ready' : 'Not checked'}</span><span className="flex items-center gap-2"><input id="admin-question-reviewed" type="checkbox" name="is_reviewed" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /> Reviewed</span><span className="mt-1 block text-xs">Use this after the image, mark scheme, and topic have been checked.</span></label>
        </div>
      </StepCard>

      <div className="sticky bottom-4 z-10 rounded-md border border-[#c3c6ce66] bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={`font-body text-sm font-semibold ${readyToSubmit ? 'text-emerald-700' : 'text-amber-800'}`}>{readyToSubmit ? 'Ready to save: all required steps are complete.' : 'Not ready yet: complete the highlighted required steps.'}</p>
          <div className="flex flex-wrap gap-3">
            <SubmitButton readyToSubmit={readyToSubmit} label={mode === 'new' ? 'Create question' : 'Save question'} />
            <Link href="/dashboard/admin/question-bank" className="tsm-btn-secondary">Cancel</Link>
          </div>
        </div>
      </div>
    </form>
  )
}

function PreviewCard({ title, url, subtitle, order }: { title: string; url: string; subtitle?: string; order?: number }) {
  return (
    <div className="rounded-md border border-[#c3c6ce66] bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="font-body text-sm font-semibold text-[#00152a]">{title}</p>
          {order ? <p className="font-body text-xs font-semibold text-[#735b2b]">Order {order}</p> : null}
          {subtitle ? <p className="font-body text-xs text-[#6f737b]">{subtitle}</p> : null}
        </div>
        <a href={url} target="_blank" rel="noreferrer" className="cursor-pointer rounded-md border border-blue-200 px-3 py-1 font-body text-xs font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300">Open in new tab</a>
      </div>
      <Image src={url} alt={title} width={900} height={600} unoptimized className="max-h-80 w-full rounded-sm border border-[#f0eee9] bg-[#f8f6f1] object-contain" />
    </div>
  )
}

function SubmitButton({ readyToSubmit, label }: { readyToSubmit: boolean; label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="tsm-btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50" disabled={!readyToSubmit || pending}>
      {pending ? <span className="inline-block size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> : null}
      {pending ? 'Saving...' : label}
    </button>
  )
}
