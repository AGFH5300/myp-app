'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type ReaderImage = { url: string; alt: string }
export type FullPaperReaderQuestion = {
  id: string
  questionNumber: string
  questionOrder: number | null
  marks: number | null
  isPublished?: boolean | null
  promptText?: string | null
  questionImages: ReaderImage[]
  markschemeImages: ReaderImage[]
  markschemeText?: string | null
}

export type FullPaperReaderPaper = {
  id: string
  title: string
  subjectName?: string | null
  year?: number | null
  session?: string | null
  paperCode?: string | null
}

export function FullPaperReader({
  paper,
  questions,
  backHref,
  adminPreview = false,
}: {
  paper: FullPaperReaderPaper
  questions: FullPaperReaderQuestion[]
  backHref: string
  adminPreview?: boolean
}) {
  const [currentId, setCurrentId] = useState(questions[0]?.id ?? '')
  const [revealedId, setRevealedId] = useState<string | null>(adminPreview ? (questions[0]?.id ?? null) : null)
  const currentIndex = Math.max(0, questions.findIndex((question) => question.id === currentId))
  const currentQuestion = questions[currentIndex] ?? questions[0]
  const revealedQuestion = questions.find((question) => question.id === revealedId) ?? null
  const metadata = [paper.subjectName, paper.session, paper.year, paper.paperCode].filter(Boolean).join(' · ')

  useEffect(() => {
    if (!questions.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top))[0]
        if (visible?.target.id) setCurrentId(visible.target.id.replace('question-', ''))
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: [0, 0.1, 0.25] },
    )
    questions.forEach((question) => {
      const element = document.getElementById(`question-${question.id}`)
      if (element) observer.observe(element)
    })
    return () => observer.disconnect()
  }, [questions])

  useEffect(() => {
    const hash = window.location.hash.replace('#question-', '')
    if (hash && questions.some((question) => question.id === hash)) {
      window.setTimeout(() => scrollToQuestion(hash), 50)
    }
  }, [questions])

  function scrollToQuestion(questionId: string) {
    document.getElementById(`question-${questionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setCurrentId(questionId)
  }

  const navItems = useMemo(() => questions.map((question, index) => ({ ...question, index })), [questions])

  return (
    <div className="min-h-screen bg-[#ebe8df] text-[#00152a]">
      <div className="sticky top-0 z-30 border-b border-[#c3c6ce66] bg-white/95 backdrop-blur">
        {adminPreview ? (
          <div className="border-b border-blue-200 bg-blue-50 px-4 py-2 text-center font-body text-sm font-semibold text-blue-900">
            Admin preview — students only see published papers and published questions.
          </div>
        ) : null}
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-label text-xs uppercase tracking-[0.22em] text-[#735b2b]">MYP Atlas</p>
              <span className="rounded-full border border-[#c3c6ce66] bg-[#f5f3ee] px-2 py-0.5 font-body text-xs font-semibold text-[#43474d]">Practice paper</span>
            </div>
            <h1 className="truncate font-headline text-xl text-[#00152a] md:text-2xl">{paper.title}</h1>
            <p className="font-body text-xs text-[#43474d] md:text-sm">{metadata || 'Paper workspace'}</p>
          </div>
          <div className="font-body text-sm font-semibold text-[#00152a]">
            {currentQuestion ? `Question ${currentQuestion.questionNumber} of ${questions.length}` : 'No questions'}
          </div>
          <details className="relative lg:hidden">
            <summary className="tsm-btn-secondary cursor-pointer list-none">Questions</summary>
            <div className="absolute right-0 mt-2 max-h-[70vh] w-56 overflow-auto rounded-md border border-[#c3c6ce66] bg-white p-2 shadow-lg">
              {navItems.map((question) => <NavButton key={question.id} question={question} currentId={currentId} onClick={scrollToQuestion} />)}
            </div>
          </details>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[13rem_minmax(0,1fr)_16rem]">
        <aside className="sticky top-28 hidden h-[calc(100vh-8rem)] overflow-auto rounded-md border border-[#c3c6ce66] bg-white p-3 lg:block">
          <p className="mb-3 font-body text-xs font-semibold uppercase tracking-widest text-[#6f737b]">Question navigator</p>
          <div className="space-y-1">{navItems.map((question) => <NavButton key={question.id} question={question} currentId={currentId} onClick={scrollToQuestion} />)}</div>
        </aside>

        <main className="min-w-0">
          <div className="mx-auto max-w-[56rem] border border-[#d6d0c2] bg-white px-4 py-6 shadow-sm sm:px-8 md:px-12 md:py-10">
            <header className="border-b border-[#d6d0c2] pb-6 text-center">
              <p className="font-label text-xs uppercase tracking-[0.22em] text-[#735b2b]">MYP Atlas reconstructed practice paper</p>
              <h2 className="mt-2 font-headline text-3xl text-[#00152a]">{paper.title}</h2>
              <p className="mt-2 font-body text-sm text-[#43474d]">Reconstructed from stored question crops in paper order.</p>
            </header>

            <div className="divide-y divide-[#d6d0c2]">
              {questions.map((question) => (
                <section key={question.id} id={`question-${question.id}`} className="scroll-mt-32 py-8">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <h3 className="font-headline text-xl text-[#00152a]">Question {question.questionNumber || '—'}</h3>
                    <p className="shrink-0 font-body text-sm font-semibold text-[#43474d]">[{question.marks ?? '—'} marks]</p>
                  </div>
                  {adminPreview && question.isPublished === false ? <p className="mb-3 font-body text-xs font-semibold text-slate-600">Draft question</p> : null}
                  {question.questionImages.length ? (
                    <div className="space-y-1">
                      {question.questionImages.map((image, index) => <img key={`${image.url}-${index}`} src={image.url} alt={image.alt} className="h-auto w-full object-contain" />)}
                    </div>
                  ) : adminPreview ? (
                    <p className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 font-body text-sm font-semibold text-amber-900">Question image missing</p>
                  ) : question.promptText ? (
                    <p className="whitespace-pre-wrap font-body text-[#00152a]">{question.promptText}</p>
                  ) : null}
                </section>
              ))}
            </div>

            {!questions.length ? <p className="py-10 text-center font-body text-[#43474d]">No questions are available for this paper.</p> : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d6d0c2] pt-6">
              <button type="button" disabled={currentIndex <= 0} onClick={() => scrollToQuestion(questions[currentIndex - 1].id)} className="tsm-btn-secondary disabled:cursor-not-allowed disabled:opacity-50">Previous question</button>
              <Link href={backHref} className="tsm-btn-secondary">Back to paper list</Link>
              <button type="button" disabled={currentIndex >= questions.length - 1} onClick={() => scrollToQuestion(questions[currentIndex + 1].id)} className="tsm-btn-primary disabled:cursor-not-allowed disabled:opacity-50">Next question</button>
            </div>
          </div>
        </main>

        <aside className="sticky top-28 h-fit rounded-md border border-[#c3c6ce66] bg-white p-4">
          <p className="font-body text-sm text-[#43474d]">{questions.length} questions</p>
          <p className="mt-1 font-headline text-xl text-[#00152a]">{currentQuestion ? `Question ${currentQuestion.questionNumber}` : 'No question selected'}</p>
          {currentQuestion ? <button type="button" onClick={() => setRevealedId(currentQuestion.id)} className="tsm-btn-primary mt-4 w-full justify-center">Reveal mark scheme</button> : null}
          {revealedQuestion ? (
            <div className="mt-4 border-t border-[#c3c6ce66] pt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-body text-sm font-semibold text-[#00152a]">Mark scheme · Question {revealedQuestion.questionNumber}</p>
                <button type="button" onClick={() => setRevealedId(null)} className="font-body text-xs font-semibold text-[#735b2b] underline">Close</button>
              </div>
              <div className="max-h-[55vh] space-y-2 overflow-auto">
                {revealedQuestion.markschemeImages.length ? revealedQuestion.markschemeImages.map((image, index) => <img key={`${image.url}-${index}`} src={image.url} alt={image.alt} className="h-auto w-full object-contain" />) : revealedQuestion.markschemeText ? <p className="whitespace-pre-wrap font-body text-sm text-[#43474d]">{revealedQuestion.markschemeText}</p> : <p className="font-body text-sm text-[#43474d]">No mark scheme has been added for this question yet.</p>}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function NavButton({ question, currentId, onClick }: { question: FullPaperReaderQuestion & { index: number }; currentId: string; onClick: (id: string) => void }) {
  const active = question.id === currentId
  return <button type="button" onClick={() => onClick(question.id)} className={`block w-full rounded-sm px-3 py-2 text-left font-body text-sm font-semibold ${active ? 'bg-[#00152a] text-white' : 'text-[#43474d] hover:bg-[#f5f3ee]'}`}>Question {question.questionNumber || question.index + 1}</button>
}
