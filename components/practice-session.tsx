"use client"

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AppIcon } from '@/components/app-icon'
import { SearchableSelect } from '@/components/searchable-select'

type Question = {
  id: string
  question_number: string
  prompt_text: string
  context_image_url: string | null
  image_url: string | null
  secondary_image_url: string | null
  answer_mode: string
  marks: number | null
  options_json: string[] | null
  is_published?: boolean | null
}

type Paper = { id: string; title: string; subjects: { name: string } | null }

export function PracticeSession({ paper, questions, studentId, bookmarkedQuestionIds }: { paper: Paper; questions: Question[]; studentId: string; bookmarkedQuestionIds: string[] }) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bookmarks, setBookmarks] = useState(new Set(bookmarkedQuestionIds))
  const [openSelectId, setOpenSelectId] = useState<string | null>(null)
  const q = questions[index]
  const progress = useMemo(() => (questions.length ? ((index + 1) / questions.length) * 100 : 0), [index, questions.length])

  if (!q) return <div className="font-body">No questions found for this paper yet.</div>

  function answerField() {
    const common = `w-full mt-8 border border-[#c3c6ce66] p-4 bg-white`
    const value = answers[q.id] || ''
    const onChange = (v: string) => setAnswers((a) => ({ ...a, [q.id]: v }))

    if (q.answer_mode === 'multiple_choice' && q.options_json?.length) {
      return <div className="mt-8 space-y-3">{q.options_json.map((opt, optionIndex) => {
        const optionId = `${q.id}-option-${optionIndex}`
        return <label key={opt} htmlFor={optionId} className="block cursor-pointer border border-[#c3c6ce66] bg-[#f5f3ee] p-4 hover:border-[#735b2b] focus-within:ring-2 focus-within:ring-[#735b2b]/30"><input id={optionId} type="radio" name={q.id} className="mr-3" checked={value === opt} onChange={() => onChange(opt)} /><span className="font-body">{opt}</span></label>
      })}</div>
    }
    if (q.answer_mode === 'dropdown' && q.options_json?.length) {
      return <div className="mt-8"><SearchableSelect id={`practice-answer-${q.id}`} label={`Answer for question ${q.question_number}`} value={value} onChange={onChange} placeholder="Select an option" clearLabel="Clear answer" emptyText="No matching options found." options={q.options_json.map((opt) => ({ value: opt, label: opt }))} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} /></div>
    }
    if (q.answer_mode === 'short_text') return <input aria-label={`Answer for question ${q.question_number}`} className={common} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Type your response" />
    if (q.answer_mode === 'numeric') return <input aria-label={`Answer for question ${q.question_number}`} type="number" className={common} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Enter a numeric answer" />
    if (q.answer_mode === 'long_text') return <textarea aria-label={`Answer for question ${q.question_number}`} className={`${common} min-h-40`} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Write your detailed response" />

    return <div className="mt-8 border border-dashed border-[#c3c6ce] p-6 bg-[#f5f3ee] font-body text-sm text-[#43474d]">This response mode ({q.answer_mode}) is not interactive yet. A richer input module can be plugged in here.</div>
  }

  async function toggleBookmark() {
    const supabase = createClient()
    if (bookmarks.has(q.id)) {
      await supabase.from('bookmarks').delete().eq('student_id', studentId).eq('question_id', q.id)
      setBookmarks((prev) => {
        const next = new Set(prev)
        next.delete(q.id)
        return next
      })
      return
    }
    await supabase.from('bookmarks').insert({ student_id: studentId, question_id: q.id })
    setBookmarks((prev) => new Set(prev).add(q.id))
  }

  async function submitCurrentAndNext() {
    if (saving) return
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const answerText = answers[q.id] || ''

    const { data: attempt, error: attemptError } = await supabase
      .from('attempts')
      .insert({ student_id: studentId, question_id: q.id, score: null, max_score: q.marks ?? 0, answer_text: answerText })
      .select('id')
      .single()

    if (attemptError || !attempt) {
      setError(attemptError?.message || 'Unable to save attempt.')
      setSaving(false)
      return
    }

    
    setSaving(false)
    if (index < questions.length - 1) setIndex((v) => v + 1)
    else window.location.href = '/dashboard/attempts'
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div><h1 className="font-headline text-3xl text-[#00152a]">{paper.title}</h1><p className="font-body text-sm text-[#43474d] mt-1">{paper.subjects?.name}</p></div>
        <Link href="/dashboard" className="tsm-btn-secondary">Exit</Link>
      </header>
      <div className="h-1 bg-[#e4e2dd] mb-8"><div className="h-full bg-[#735b2b]" style={{ width: `${progress}%` }} /></div>
      <div className="grid lg:grid-cols-[1fr_260px] gap-6">
        <article className="bg-white border border-[#c3c6ce66] p-8">
          <div className="flex items-center justify-between gap-3 mb-4"><div className="flex items-center gap-3"><span className="font-label text-xs uppercase tracking-widest text-[#43474d]">Question {q.question_number}</span><span className="font-body text-sm text-[#735b2b]">{q.marks ?? 0} marks</span></div><button type="button" className="inline-flex cursor-pointer items-center gap-2 rounded-sm text-sm text-[#735b2b] underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#735b2b]/30" onClick={toggleBookmark}><AppIcon name="bookmark" className={`size-4 ${bookmarks.has(q.id) ? 'fill-[#735b2b]' : ''}`} />{bookmarks.has(q.id) ? 'Bookmarked' : 'Bookmark'}</button></div>
          <div className="space-y-4">
            {q.context_image_url && <Image src={q.context_image_url} alt={`Question ${q.question_number} context`} width={1200} height={800} unoptimized className="h-auto max-w-full rounded-md" />}
            {q.image_url && <Image src={q.image_url} alt={`Question ${q.question_number}`} width={1200} height={800} unoptimized className="h-auto max-w-full rounded-md" />}
            {q.secondary_image_url && <Image src={q.secondary_image_url} alt={`Question ${q.question_number} secondary`} width={1200} height={800} unoptimized className="h-auto max-w-full rounded-md" />}
            {!q.context_image_url && !q.image_url && !q.secondary_image_url && q.prompt_text && <p className="font-body text-lg text-[#00152a] whitespace-pre-wrap">{q.prompt_text}</p>}
          </div>
          {answerField()}
          {error && <p className="text-sm text-red-700 mt-4">{error}</p>}
          <div className="mt-8 flex justify-between">
            <button type="button" className="tsm-btn-secondary" onClick={() => setIndex((v) => Math.max(0, v - 1))}>Previous</button>
            <button type="button" className="tsm-btn-primary disabled:cursor-not-allowed disabled:opacity-60" onClick={submitCurrentAndNext} disabled={saving}>{saving ? 'Saving...' : index === questions.length - 1 ? 'Finish' : 'Save & Next'}</button>
          </div>
        </article>
        <aside className="bg-[#f5f3ee] border border-[#c3c6ce66] p-6"><h2 className="font-headline text-xl text-[#00152a] mb-4">Question Index</h2><div className="grid grid-cols-5 gap-2">{questions.map((item, i) => <button key={item.id} type="button" onClick={() => setIndex(i)} aria-label={`Go to question ${i + 1}`} aria-current={i === index ? 'step' : undefined} className={`h-9 cursor-pointer border text-sm transition hover:border-[#735b2b] focus:outline-none focus:ring-2 focus:ring-[#735b2b]/30 ${i === index ? 'bg-[#00152a] text-white border-[#00152a]' : 'bg-white border-[#c3c6ce66]'}`}>{i + 1}</button>)}</div></aside>
      </div>
    </div>
  )
}
