"use client"

import { useMemo, useState } from 'react'
import Link from 'next/link'

interface Question {
  id: string
  question_number: string
  question_text: string
  question_type: string
  marks: number
  options: string[] | null
}

interface Paper {
  title: string
  subjects: { name: string } | null
}

export function PracticeSession({ paper, questions }: { paper: Paper; questions: Question[]; attemptId: string; existingResponses: any[] }) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const q = questions[index]
  const progress = useMemo(() => (questions.length ? ((index + 1) / questions.length) * 100 : 0), [index, questions.length])

  if (!q) return <div className="font-body">No questions found.</div>

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div><h1 className="font-headline text-3xl text-[#00152a]">{paper.title}</h1><p className="font-body text-sm text-[#43474d] mt-1">{paper.subjects?.name}</p></div>
        <Link href="/dashboard" className="tsm-btn-secondary">Exit</Link>
      </header>
      <div className="h-1 bg-[#e4e2dd] mb-8"><div className="h-full bg-[#735b2b]" style={{ width: `${progress}%` }} /></div>
      <div className="grid lg:grid-cols-[1fr_260px] gap-6">
        <article className="bg-white border border-[#c3c6ce66] p-8">
          <div className="flex items-center gap-3 mb-4"><span className="font-label text-xs uppercase tracking-widest text-[#43474d]">Question {q.question_number}</span><span className="font-body text-sm text-[#735b2b]">{q.marks} marks</span></div>
          <p className="font-body text-lg text-[#00152a] whitespace-pre-wrap">{q.question_text}</p>
          {q.question_type === 'multiple_choice' && q.options?.length ? (
            <div className="mt-8 space-y-3">
              {q.options.map((opt) => (
                <label key={opt} className="block p-4 border border-[#c3c6ce66] bg-[#f5f3ee]">
                  <input type="radio" name={q.id} className="mr-3" checked={answers[q.id] === opt} onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))} />
                  <span className="font-body">{opt}</span>
                </label>
              ))}
            </div>
          ) : (
            <textarea className="w-full mt-8 min-h-40 border border-[#c3c6ce66] p-4 bg-white" value={answers[q.id] || ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
          )}
          <div className="mt-8 flex justify-between">
            <button className="tsm-btn-secondary" onClick={() => setIndex((v) => Math.max(0, v - 1))}>Previous</button>
            <button className="tsm-btn-primary" onClick={() => setIndex((v) => Math.min(questions.length - 1, v + 1))}>{index === questions.length - 1 ? 'Review' : 'Next'}</button>
          </div>
        </article>
        <aside className="bg-[#f5f3ee] border border-[#c3c6ce66] p-6"><h2 className="font-headline text-xl text-[#00152a] mb-4">Question Index</h2><div className="grid grid-cols-5 gap-2">{questions.map((item, i) => <button key={item.id} onClick={() => setIndex(i)} className={`h-9 border text-sm ${i === index ? 'bg-[#00152a] text-white border-[#00152a]' : 'bg-white border-[#c3c6ce66]'}`}>{i + 1}</button>)}</div></aside>
      </div>
    </div>
  )
}
