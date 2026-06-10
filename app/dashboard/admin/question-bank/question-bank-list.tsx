'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { batchUpdateQuestionPublication } from './actions'

export type QuestionBankRow = {
  id: string
  paperTitle: string
  paperMeta: string
  subjectName: string
  questionNumber: string
  questionOrder: number | null
  marks: number | null
  topicSummary: string
  isPublished: boolean
  needsReview: boolean
  warnings: string[]
}

function statusBadge(label: string, tone: 'green' | 'amber' | 'grey' | 'red') {
  const classes = tone === 'green'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : tone === 'red'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-slate-200 bg-slate-100 text-slate-600'

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>{label}</span>
}

function warningBadge(label: string) {
  return <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">{label}</span>
}

export function QuestionBankList({ questions }: { questions: QuestionBankRow[] }) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [isPending, startTransition] = useTransition()
  const selectedQuestions = useMemo(() => questions.filter((question) => selectedIds.includes(question.id)), [questions, selectedIds])
  const selectedNeedsReview = selectedQuestions.some((question) => question.needsReview)

  function toggleQuestion(questionId: string) {
    setSelectedIds((current) => current.includes(questionId) ? current.filter((id) => id !== questionId) : [...current, questionId])
    setConfirmPublish(false)
  }

  function runBatch(publish: boolean) {
    if (!selectedIds.length || isPending) return
    if (publish && selectedNeedsReview && !confirmPublish) {
      setConfirmPublish(true)
      return
    }

    const ids = selectedIds
    startTransition(async () => {
      const result = await batchUpdateQuestionPublication(ids, publish)
      if (result.ok) {
        toast.success(publish ? 'Questions published' : 'Questions unpublished')
        setSelectedIds([])
        setConfirmPublish(false)
        router.refresh()
      } else {
        toast.error(result.message || 'Could not update selected questions.')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="font-body text-sm font-semibold text-[#00152a]">{selectedIds.length} selected</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => runBatch(true)} disabled={!selectedIds.length || isPending} className="tsm-btn-primary disabled:cursor-not-allowed disabled:opacity-60">{isPending ? 'Saving…' : 'Publish selected'}</button>
            <button type="button" onClick={() => runBatch(false)} disabled={!selectedIds.length || isPending} className="tsm-btn-secondary disabled:cursor-not-allowed disabled:opacity-60">{isPending ? 'Saving…' : 'Unpublish selected'}</button>
            <button type="button" onClick={() => { setSelectedIds([]); setConfirmPublish(false) }} disabled={!selectedIds.length || isPending} className="rounded-md border border-[#c3c6ce66] bg-white px-3 py-2 font-body text-sm font-semibold text-[#43474d] hover:bg-[#f5f3ee] disabled:cursor-not-allowed disabled:opacity-60">Clear selection</button>
          </div>
        </div>
        {confirmPublish ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 font-body text-sm text-amber-900">
            <p className="font-semibold">Some selected questions need review. Publish anyway?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => runBatch(true)} disabled={isPending} className="rounded-md bg-amber-700 px-3 py-2 font-semibold text-white hover:bg-amber-800 disabled:opacity-60">Yes, publish anyway</button>
              <button type="button" onClick={() => setConfirmPublish(false)} disabled={isPending} className="rounded-md border border-amber-300 bg-white px-3 py-2 font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60">Cancel</button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left font-body text-sm">
          <thead className="border-b border-[#c3c6ce66] text-xs uppercase tracking-[.08em] text-[#735b2b]"><tr><th className="py-3 pr-4">Select</th><th className="py-3 pr-4">Paper</th><th className="py-3 pr-4">Question/order</th><th className="py-3 pr-4">Marks</th><th className="py-3 pr-4">Topic</th><th className="py-3 pr-4">Status</th><th className="py-3 pr-4">Review warnings</th><th className="py-3 pr-4">Actions</th></tr></thead>
          <tbody>
            {questions.map((question) => {
              const selected = selectedIds.includes(question.id)
              return (
                <tr key={question.id} className="border-b border-[#f0eee9] align-top text-[#43474d]">
                  <td className="py-4 pr-4">
                    <button type="button" onClick={() => toggleQuestion(question.id)} aria-pressed={selected} aria-label={`${selected ? 'Deselect' : 'Select'} ${question.questionNumber}`} className={`flex size-7 items-center justify-center rounded-md border font-semibold ${selected ? 'border-blue-700 bg-blue-700 text-white' : 'border-[#c3c6ce] bg-white text-transparent hover:border-blue-500'}`}>✓</button>
                  </td>
                  <td className="py-4 pr-4">
                    <p className="font-semibold text-[#00152a]">{question.paperTitle}</p>
                    <p className="text-xs text-[#5f646c]">{question.paperMeta}</p>
                    <p className="text-xs text-[#5f646c]">{question.subjectName}</p>
                  </td>
                  <td className="py-4 pr-4"><p className="font-semibold text-[#00152a]">{question.questionNumber}</p><p className="text-xs text-[#5f646c]">Order: {question.questionOrder ?? '—'}</p></td>
                  <td className="py-4 pr-4">{question.marks ?? '—'}</td>
                  <td className="py-4 pr-4">{question.topicSummary || <span className="text-amber-800">Not tagged</span>}</td>
                  <td className="py-4 pr-4"><div className="flex flex-wrap gap-2">{question.isPublished ? statusBadge('Published', 'green') : statusBadge('Draft', 'grey')}{question.needsReview ? statusBadge('Needs review', 'amber') : null}</div></td>
                  <td className="py-4 pr-4"><div className="flex max-w-xs flex-wrap gap-1.5">{question.warnings.length ? question.warnings.map((warning) => warningBadge(warning)) : statusBadge('Ready', 'green')}</div></td>
                  <td className="py-4 pr-4"><div className="flex flex-wrap gap-2"><Link href={`/dashboard/papers/question/${question.id}`} className="tsm-btn-secondary w-fit">Preview as student</Link><Link href={`/dashboard/admin/question-bank/${question.id}/edit`} className="tsm-btn-secondary w-fit">Edit</Link></div></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!questions.length ? <p className="mt-4 font-body text-sm text-[#43474d]">No questions match these filters.</p> : null}
    </div>
  )
}
