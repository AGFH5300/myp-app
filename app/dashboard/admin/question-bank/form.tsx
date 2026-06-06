import Link from 'next/link'
import { createQuestion, updateQuestion } from './actions'

type PaperRelation<T> = T | T[] | null
type Paper = { id: string; title: string; year: number; level: string | null; subjects?: PaperRelation<{ name?: string | null }>; exam_sessions?: PaperRelation<{ session_month?: string | null }> }
type Subject = { id: string; name: string }
type Topic = { id: string; name: string }
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

function relationLabel(relation: unknown, key: 'name' | 'session_month') {
  const item = Array.isArray(relation) ? relation[0] : relation
  return (item as Record<string, string | null | undefined> | null | undefined)?.[key] || ''
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
  const selectedTopics = new Set(question?.question_topics?.map((row) => row.topic_id) ?? [])
  const primaryTopicId = question?.question_topics?.find((row) => row.is_primary)?.topic_id || ''
  const action = mode === 'new' ? createQuestion : updateQuestion

  return (
    <form action={action} className="space-y-8" encType="multipart/form-data">
      {question ? <input type="hidden" name="question_id" value={question.id} /> : null}

      <section className="rounded-md border border-[#c3c6ce66] bg-white p-6">
        <h2 className="font-headline text-2xl text-[#00152a]">Paper</h2>
        <p className="mt-1 font-body text-sm text-[#43474d]">Choose an existing past paper, or enter a new paper title to create one.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="font-body text-sm text-[#43474d]">
            Existing paper
            <select name="paper_id" defaultValue={question?.paper_id || ''} className="tsm-input mt-1 w-full">
              <option value="">Create a new paper</option>
              {papers.map((paper) => (
                <option key={paper.id} value={paper.id}>{paper.title} · {relationLabel(paper.subjects, 'name')} · {paper.level || 'No level'} · {paper.year}</option>
              ))}
            </select>
          </label>
          <label className="font-body text-sm text-[#43474d]">
            New paper title
            <input name="new_paper_title" className="tsm-input mt-1 w-full" placeholder="Only fill this to create a paper" />
          </label>
          <label className="font-body text-sm text-[#43474d]">
            New paper subject
            <select name="new_paper_subject_id" className="tsm-input mt-1 w-full" defaultValue={subjects.find((subject) => subject.name === 'Mathematics')?.id || ''}>
              <option value="">Choose subject</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
          </label>
          <label className="font-body text-sm text-[#43474d]">
            New paper level
            <input name="new_paper_level" className="tsm-input mt-1 w-full" defaultValue="Maths Extended" />
          </label>
          <label className="font-body text-sm text-[#43474d]">
            New paper year
            <input name="new_paper_year" type="number" min="2016" max="2025" className="tsm-input mt-1 w-full" defaultValue="2025" />
          </label>
          <label className="font-body text-sm text-[#43474d]">
            New paper session
            <select name="new_paper_session" className="tsm-input mt-1 w-full" defaultValue="May">
              <option value="May">May</option>
              <option value="November">November</option>
            </select>
          </label>
          <label className="font-body text-sm text-[#43474d]">
            Source PDF storage path
            <input name="new_paper_source_pdf_path" className="tsm-input mt-1 w-full" placeholder="optional private path" />
          </label>
          <label className="font-body text-sm text-[#43474d]">
            Mark scheme PDF storage path
            <input name="new_paper_markscheme_pdf_path" className="tsm-input mt-1 w-full" placeholder="optional private path" />
          </label>
          <label className="flex items-center gap-2 font-body text-sm text-[#43474d]">
            <input type="checkbox" name="new_paper_is_published" defaultChecked /> Publish new paper
          </label>
        </div>
      </section>

      <section className="rounded-md border border-[#c3c6ce66] bg-white p-6">
        <h2 className="font-headline text-2xl text-[#00152a]">Question details</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="font-body text-sm text-[#43474d]">
            Question number
            <input name="question_number" required className="tsm-input mt-1 w-full" defaultValue={question?.question_number || ''} />
          </label>
          <label className="font-body text-sm text-[#43474d]">
            Display order
            <input name="question_order" type="number" className="tsm-input mt-1 w-full" defaultValue={question?.question_order ?? ''} />
          </label>
          <label className="font-body text-sm text-[#43474d]">
            Marks
            <input name="marks" type="number" min="0" className="tsm-input mt-1 w-full" defaultValue={question?.marks ?? ''} />
          </label>
          <div className="flex items-center gap-5 pt-5 font-body text-sm text-[#43474d]">
            <label className="flex items-center gap-2"><input type="checkbox" name="is_published" defaultChecked={question?.is_published ?? false} /> Published</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="is_reviewed" defaultChecked={question?.is_reviewed ?? false} /> Reviewed</label>
          </div>
          <label className="md:col-span-2 font-body text-sm text-[#43474d]">
            Question text / placeholder
            <textarea name="prompt_text" className="tsm-input mt-1 min-h-28 w-full" defaultValue={question?.prompt_text || ''} placeholder="Use a short placeholder if the question is image-only." />
          </label>
          <label className="md:col-span-2 font-body text-sm text-[#43474d]">
            Mark scheme text / placeholder
            <textarea name="markscheme_text" className="tsm-input mt-1 min-h-28 w-full" defaultValue={question?.markscheme_text || ''} />
          </label>
        </div>
      </section>

      <section className="rounded-md border border-[#c3c6ce66] bg-white p-6">
        <h2 className="font-headline text-2xl text-[#00152a]">Images and private asset paths</h2>
        <p className="mt-1 font-body text-sm text-[#43474d]">Upload to the private question-assets bucket, or paste an existing storage path/URL.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="font-body text-sm text-[#43474d]">
            Upload question image
            <input name="question_image_file" type="file" accept="image/*" className="mt-1 block w-full text-sm" />
          </label>
          <label className="font-body text-sm text-[#43474d]">
            Upload mark scheme image
            <input name="markscheme_image_file" type="file" accept="image/*" className="mt-1 block w-full text-sm" />
          </label>
          <label className="font-body text-sm text-[#43474d]">
            Question image storage path
            <input name="question_image_path" className="tsm-input mt-1 w-full" defaultValue={question?.question_image_path || ''} placeholder="questions/file.png" />
          </label>
          <label className="font-body text-sm text-[#43474d]">
            Mark scheme image storage path
            <input name="markscheme_image_path" className="tsm-input mt-1 w-full" defaultValue={question?.markscheme_image_path || ''} placeholder="markschemes/file.png" />
          </label>
          <label className="font-body text-sm text-[#43474d]">
            Public/fallback question image URL
            <input name="image_url" className="tsm-input mt-1 w-full" defaultValue={question?.image_url || ''} />
          </label>
          <label className="font-body text-sm text-[#43474d]">
            Public/fallback mark scheme image URL
            <input name="markscheme_image_url" className="tsm-input mt-1 w-full" defaultValue={question?.markscheme_image_url || ''} />
          </label>
        </div>
        {(questionPreviewUrl || markschemePreviewUrl) ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {questionPreviewUrl ? <img src={questionPreviewUrl} alt="Question preview" className="max-h-80 rounded-md border border-[#c3c6ce66] bg-white object-contain" /> : null}
            {markschemePreviewUrl ? <img src={markschemePreviewUrl} alt="Mark scheme preview" className="max-h-80 rounded-md border border-[#c3c6ce66] bg-white object-contain" /> : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-md border border-[#c3c6ce66] bg-white p-6">
        <h2 className="font-headline text-2xl text-[#00152a]">Topic tags</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {topics.map((topic) => (
            <div key={topic.id} className="flex items-center justify-between gap-3 rounded-sm bg-[#f5f3ee] px-3 py-2 font-body text-sm text-[#43474d]">
              <label className="flex items-center gap-2"><input type="checkbox" name="topic_ids" value={topic.id} defaultChecked={selectedTopics.has(topic.id)} /> {topic.name}</label>
              <label className="flex items-center gap-1 text-xs"><input type="radio" name="primary_topic_id" value={topic.id} defaultChecked={primaryTopicId === topic.id} /> Primary</label>
            </div>
          ))}
        </div>
        <label className="mt-4 block font-body text-sm text-[#43474d]">
          Create a new topic tag
          <input name="new_topic_name" className="tsm-input mt-1 w-full" placeholder="e.g. Quadratic functions" />
        </label>
      </section>

      <div className="flex flex-wrap gap-3">
        <button className="tsm-btn-primary">{mode === 'new' ? 'Create question' : 'Save question'}</button>
        <Link href="/dashboard/admin/question-bank" className="tsm-btn-secondary">Cancel</Link>
      </div>
    </form>
  )
}
