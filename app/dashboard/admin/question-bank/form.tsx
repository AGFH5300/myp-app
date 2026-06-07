"use client"

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { createQuestion, updateQuestion } from './actions'

type PaperRelation<T> = T | T[] | null
type Paper = { id: string; title: string; year: number; level: string | null; subjects?: PaperRelation<{ id?: string | null; name?: string | null }>; exam_sessions?: PaperRelation<{ session_month?: string | null }> }
type Subject = { id: string; name: string }
type Topic = { id: string; name: string; subject_id?: string | null; parent_topic_id?: string | null; level?: string | null; sort_order?: number | null; is_active?: boolean | null }
type QuestionTopic = { topic_id: string; is_primary?: boolean | null }
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

function relationLabel(relation: unknown, key: 'id' | 'name' | 'session_month') {
  const item = Array.isArray(relation) ? relation[0] : relation
  return (item as Record<string, string | null | undefined> | null | undefined)?.[key] || ''
}

function paperLabel(paper: Paper) {
  const session = relationLabel(paper.exam_sessions, 'session_month') || 'Session'
  return `${paper.title} — ${session} ${paper.year}`
}

function topicMatchesScope(topic: Topic, subjectId: string, level: string) {
  const subjectMatches = !topic.subject_id || !subjectId || topic.subject_id === subjectId
  const levelMatches = !topic.level || !level || topic.level === level
  return topic.is_active !== false && subjectMatches && levelMatches
}

export function QuestionBankForm({
  mode,
  papers,
  subjects,
  topics,
  question,
  questionPreviewUrl,
  markschemePreviewUrl,
}: {
  mode: 'new' | 'edit'
  papers: Paper[]
  subjects: Subject[]
  topics: Topic[]
  question?: Question | null
  questionPreviewUrl?: string | null
  markschemePreviewUrl?: string | null
}) {
  const currentPaper = papers.find((paper) => paper.id === question?.paper_id)
  const defaultSubjectId = relationLabel(currentPaper?.subjects, 'id') || subjects.find((subject) => subject.name === 'Mathematics')?.id || subjects[0]?.id || ''
  const defaultLevel = currentPaper?.level || 'Maths Extended'
  const [subjectId, setSubjectId] = useState(defaultSubjectId)
  const [level, setLevel] = useState(defaultLevel)
  const [paperId, setPaperId] = useState(question?.paper_id || '')
  const [topicGroupId, setTopicGroupId] = useState(() => {
    const primaryTopicId = question?.question_topics?.find((row) => row.is_primary)?.topic_id || ''
    const primaryTopic = topics.find((topic) => topic.id === primaryTopicId)
    return primaryTopic?.parent_topic_id || primaryTopic?.id || ''
  })
  const [primaryTopicId, setPrimaryTopicId] = useState(question?.question_topics?.find((row) => row.is_primary)?.topic_id || '')
  const action = mode === 'new' ? createQuestion : updateQuestion
  const selectedTopics = new Set(question?.question_topics?.map((row) => row.topic_id) ?? [])

  const filteredPapers = papers.filter((paper) => {
    const paperSubjectId = relationLabel(paper.subjects, 'id')
    return (!subjectId || paperSubjectId === subjectId) && (!level || paper.level === level)
  })

  const topicGroups = useMemo(() => topics
    .filter((topic) => !topic.parent_topic_id && topicMatchesScope(topic, subjectId, level))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)), [topics, subjectId, level])

  const subtopics = useMemo(() => topics
    .filter((topic) => topic.parent_topic_id === topicGroupId && topicMatchesScope(topic, subjectId, level))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)), [topics, topicGroupId, subjectId, level])

  return (
    <form action={action} className="space-y-8" encType="multipart/form-data">
      {question ? <input type="hidden" name="question_id" value={question.id} /> : null}
      <input type="hidden" name="primary_topic_id" value={primaryTopicId || topicGroupId} />

      <section className="rounded-md border border-[#c3c6ce66] bg-white p-6">
        <p className="font-label text-xs uppercase tracking-[.16em] text-[#735b2b]">Step 1</p>
        <h2 className="font-headline text-2xl text-[#00152a]">Paper</h2>
        <p className="mt-1 font-body text-sm text-[#43474d]">Choose the subject and course first. The paper list will only show matching past papers.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="font-body text-sm text-[#43474d]">
            Subject
            <select name="new_paper_subject_id" value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setPaperId('') }} className="tsm-input mt-1 w-full">
              <option value="">Choose subject</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
          </label>
          <label className="font-body text-sm text-[#43474d]">
            Level / course
            <input name="new_paper_level" className="tsm-input mt-1 w-full" value={level} onChange={(event) => { setLevel(event.target.value); setPaperId('') }} placeholder="Maths Extended" />
          </label>
          <label className="md:col-span-2 font-body text-sm text-[#43474d]">
            Existing paper
            <select name="paper_id" value={paperId} onChange={(event) => setPaperId(event.target.value)} className="tsm-input mt-1 w-full">
              <option value="">Create a new paper</option>
              {filteredPapers.map((paper) => <option key={paper.id} value={paper.id}>{paperLabel(paper)}</option>)}
            </select>
          </label>
        </div>
        <details className="mt-5 rounded-sm bg-[#f5f3ee] p-4">
          <summary className="cursor-pointer font-body font-semibold text-[#00152a]">Create a new paper instead</summary>
          <p className="mt-2 font-body text-sm text-[#43474d]">Only fill these in when the paper is not already in the list.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="font-body text-sm text-[#43474d]">Paper title/code<input name="new_paper_title" className="tsm-input mt-1 w-full" placeholder="M25 Maths Extended" /></label>
            <label className="font-body text-sm text-[#43474d]">Year<input name="new_paper_year" type="number" min="2016" max="2030" className="tsm-input mt-1 w-full" defaultValue="2025" /></label>
            <label className="font-body text-sm text-[#43474d]">Session<select name="new_paper_session" className="tsm-input mt-1 w-full" defaultValue="May"><option value="May">May</option><option value="November">November</option></select></label>
          </div>
          <details className="mt-4 rounded-sm border border-[#c3c6ce66] bg-white p-4">
            <summary className="cursor-pointer font-body font-semibold text-[#735b2b]">Advanced paper options</summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="font-body text-sm text-[#43474d]">Source PDF path<input name="new_paper_source_pdf_path" className="tsm-input mt-1 w-full" placeholder="optional private path" /></label>
              <label className="font-body text-sm text-[#43474d]">Mark scheme PDF path<input name="new_paper_markscheme_pdf_path" className="tsm-input mt-1 w-full" placeholder="optional private path" /></label>
              <label className="flex items-center gap-2 font-body text-sm text-[#43474d]"><input type="checkbox" name="new_paper_is_published" defaultChecked /> Show paper to students</label>
            </div>
          </details>
        </details>
      </section>

      <section className="rounded-md border border-[#c3c6ce66] bg-white p-6">
        <p className="font-label text-xs uppercase tracking-[.16em] text-[#735b2b]">Step 2</p>
        <h2 className="font-headline text-2xl text-[#00152a]">Question</h2>
        <p className="mt-1 font-body text-sm text-[#43474d]">Add the question label students will see on practice cards.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="font-body text-sm text-[#43474d]">Question number<input name="question_number" required className="tsm-input mt-1 w-full" defaultValue={question?.question_number || ''} placeholder="1a" /></label>
          <label className="font-body text-sm text-[#43474d]">Marks<input name="marks" type="number" min="0" className="tsm-input mt-1 w-full" defaultValue={question?.marks ?? ''} /></label>
          <label className="font-body text-sm text-[#43474d]">Display order<input name="question_order" type="number" className="tsm-input mt-1 w-full" defaultValue={question?.question_order ?? ''} placeholder="Optional" /></label>
        </div>
      </section>

      <section className="rounded-md border border-[#c3c6ce66] bg-white p-6">
        <p className="font-label text-xs uppercase tracking-[.16em] text-[#735b2b]">Step 3</p>
        <h2 className="font-headline text-2xl text-[#00152a]">Images</h2>
        <p className="mt-1 font-body text-sm text-[#43474d]">Upload the cropped question image and the matching mark scheme image.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="font-body text-sm text-[#43474d]">Question image<input name="question_image_file" type="file" accept="image/*" className="mt-1 block w-full text-sm" /></label>
          <label className="font-body text-sm text-[#43474d]">Mark scheme image<input name="markscheme_image_file" type="file" accept="image/*" className="mt-1 block w-full text-sm" /></label>
        </div>
        {(questionPreviewUrl || markschemePreviewUrl) ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {questionPreviewUrl ? <img src={questionPreviewUrl} alt="Question preview" className="max-h-80 rounded-md border border-[#c3c6ce66] bg-white object-contain" /> : null}
            {markschemePreviewUrl ? <img src={markschemePreviewUrl} alt="Mark scheme preview" className="max-h-80 rounded-md border border-[#c3c6ce66] bg-white object-contain" /> : null}
          </div>
        ) : null}
        <details className="mt-5 rounded-sm bg-[#f5f3ee] p-4">
          <summary className="cursor-pointer font-body font-semibold text-[#735b2b]">Advanced image and text options</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="font-body text-sm text-[#43474d]">Direct question image path<input name="question_image_path" className="tsm-input mt-1 w-full" defaultValue={question?.question_image_path || ''} placeholder="questions/file.png" /></label>
            <label className="font-body text-sm text-[#43474d]">Direct mark scheme image path<input name="markscheme_image_path" className="tsm-input mt-1 w-full" defaultValue={question?.markscheme_image_path || ''} placeholder="markschemes/file.png" /></label>
            <label className="font-body text-sm text-[#43474d]">Fallback public question image URL<input name="image_url" className="tsm-input mt-1 w-full" defaultValue={question?.image_url || ''} /></label>
            <label className="font-body text-sm text-[#43474d]">Fallback public mark scheme image URL<input name="markscheme_image_url" className="tsm-input mt-1 w-full" defaultValue={question?.markscheme_image_url || ''} /></label>
            <label className="md:col-span-2 font-body text-sm text-[#43474d]">Question placeholder text<textarea name="prompt_text" className="tsm-input mt-1 min-h-24 w-full" defaultValue={question?.prompt_text || ''} placeholder="Use only if there is no image yet." /></label>
            <label className="md:col-span-2 font-body text-sm text-[#43474d]">Mark scheme placeholder text<textarea name="markscheme_text" className="tsm-input mt-1 min-h-24 w-full" defaultValue={question?.markscheme_text || ''} /></label>
          </div>
        </details>
      </section>

      <section className="rounded-md border border-[#c3c6ce66] bg-white p-6">
        <p className="font-label text-xs uppercase tracking-[.16em] text-[#735b2b]">Step 4</p>
        <h2 className="font-headline text-2xl text-[#00152a]">Topics & publish</h2>
        <p className="mt-1 font-body text-sm text-[#43474d]">Choose one main topic group, then the exact subtopic for this question.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="font-body text-sm text-[#43474d]">Topic group<select name="topic_group_id" value={topicGroupId} onChange={(event) => { setTopicGroupId(event.target.value); setPrimaryTopicId('') }} className="tsm-input mt-1 w-full"><option value="">Choose topic group</option>{topicGroups.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
          <label className="font-body text-sm text-[#43474d]">Primary subtopic<select name="topic_ids" value={primaryTopicId} onChange={(event) => setPrimaryTopicId(event.target.value)} className="tsm-input mt-1 w-full"><option value={topicGroupId}>Use the topic group</option>{subtopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
          <label className="md:col-span-2 font-body text-sm text-[#43474d]">Create new subtopic<input name="new_topic_name" className="tsm-input mt-1 w-full" placeholder="e.g. Inequalities and feasible regions" /></label>
        </div>
        <details className="mt-5 rounded-sm bg-[#f5f3ee] p-4">
          <summary className="cursor-pointer font-body font-semibold text-[#735b2b]">Optional secondary topics</summary>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {topics.filter((topic) => topic.id !== primaryTopicId && topic.id !== topicGroupId && topicMatchesScope(topic, subjectId, level)).map((topic) => (
              <label key={topic.id} className="flex items-center gap-2 rounded-sm bg-white px-3 py-2 font-body text-sm text-[#43474d]"><input type="checkbox" name="topic_ids" value={topic.id} defaultChecked={selectedTopics.has(topic.id)} /> {topic.name}</label>
            ))}
          </div>
        </details>
        <div className="mt-5 flex flex-wrap gap-5 font-body text-sm text-[#43474d]">
          <label className="flex items-center gap-2"><input type="checkbox" name="is_published" defaultChecked={question?.is_published ?? false} /> Show to students</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="is_reviewed" defaultChecked={question?.is_reviewed ?? false} /> Checked/ready</label>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button className="tsm-btn-primary">{mode === 'new' ? 'Create question' : 'Save question'}</button>
        <Link href="/dashboard/admin/question-bank" className="tsm-btn-secondary">Cancel</Link>
      </div>
    </form>
  )
}
