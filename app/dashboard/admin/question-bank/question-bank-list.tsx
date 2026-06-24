'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog, PendingActionLink, PendingLabel } from '@/components/operation-feedback'
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

function statusBadge(label: string, tone: 'green' | 'amber' | 'grey' | 'red', key?: string) {
  const classes = tone === 'green'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : tone === 'red'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-slate-200 bg-slate-100 text-slate-600'

  return <span key={key} className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>{label}</span>
}

function warningBadge(label: string, key?: string) {
  return <span key={key} className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">{label}</span>
}

export function QuestionBankList({ questions }: { questions: QuestionBankRow[] }) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [confirming, setConfirming] = useState<{ publish: boolean } | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [pendingBatch, setPendingBatch] = useState<'publish' | 'unpublish' | null>(null)
  const [openingAction, setOpeningAction] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const visibleIds = useMemo(() => questions.map((question) => question.id), [questions])
  const selectedQuestions = useMemo(() => questions.filter((question) => selectedIds.includes(question.id)), [questions, selectedIds])
  const selectedNeedsReview = selectedQuestions.some((question) => question.needsReview)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id))

  function toggleQuestion(questionId: string) {
    setSelectedIds((current) => current.includes(questionId) ? current.filter((id) => id !== questionId) : [...current, questionId])
    setConfirming(null)
  }

  function selectAllVisible() {
    setSelectedIds((current) => Array.from(new Set([...current, ...visibleIds])))
    setConfirming(null)
  }

  function clearSelection() {
    setSelectedIds([])
    setConfirming(null)
  }

  function requestBatch(publish: boolean) {
    if (!selectedIds.length || isPending) return
    setOperationError(null)
    setConfirming({ publish })
  }

  function runBatch(publish: boolean) {
    if (!selectedIds.length || isPending) return

    const ids = selectedIds
    setPendingBatch(publish ? 'publish' : 'unpublish')
    startTransition(async () => {
      const result = await batchUpdateQuestionPublication(ids, publish)
      if (result.ok) {
        toast.success(publish ? 'Questions published' : 'Questions unpublished')
        setSelectedIds([])
        setConfirming(null)
        setOperationError(null)
        router.refresh()
      } else {
        const message = result.message || 'Could not update selected questions.'
        setOperationError(message)
        toast.error(message)
      }
      setPendingBatch(null)
    })
  }


  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left font-body text-sm">
          <thead className="border-b border-[#c3c6ce66] text-xs uppercase tracking-[.08em] text-[#735b2b]"><tr><th className="w-12 py-3 pr-4"><span className="sr-only">Select questions</span></th><th className="py-3 pr-4">Paper</th><th className="py-3 pr-4">Question/order</th><th className="py-3 pr-4">Marks</th><th className="py-3 pr-4">Topic</th><th className="py-3 pr-4">Status</th><th className="py-3 pr-4">Review warnings</th><th className="py-3 pr-4">Actions</th></tr></thead>
          <tbody>
            {questions.map((question) => {
              const selected = selectedIds.includes(question.id)
              return (
                <tr key={question.id} className="border-b border-[#f0eee9] align-top text-[#43474d]">
                  <td className="py-4 pr-4">
                    <button type="button" onClick={() => toggleQuestion(question.id)} aria-pressed={selected} aria-label={`${selected ? 'Deselect' : 'Select'} question ${question.questionNumber}`} className={`flex size-7 items-center justify-center rounded-md border font-semibold ${selected ? 'border-blue-700 bg-blue-700 text-white' : 'border-[#c3c6ce] bg-white text-transparent hover:border-blue-500'}`}>✓</button>
                  </td>
                  <td className="py-4 pr-4">
                    <p className="font-semibold text-[#00152a]">{question.paperTitle}</p>
                    <p className="text-xs text-[#5f646c]">{question.paperMeta}</p>
                    <p className="text-xs text-[#5f646c]">{question.subjectName}</p>
                  </td>
                  <td className="py-4 pr-4"><p className="font-semibold text-[#00152a]">{question.questionNumber}</p><p className="text-xs text-[#5f646c]">Order: {question.questionOrder ?? '—'}</p></td>
                  <td className="py-4 pr-4">{question.marks ?? '—'}</td>
                  <td className="py-4 pr-4"><span className="block max-w-[18rem] text-sm leading-5">{question.topicSummary || <span className="text-amber-800">Not tagged</span>}</span></td>
                  <td className="py-4 pr-4"><div className="flex flex-wrap gap-2">{question.isPublished ? statusBadge('Published', 'green', `${question.id}-published`) : statusBadge('Draft', 'grey', `${question.id}-draft`)}{question.needsReview ? statusBadge('Needs review', 'amber', `${question.id}-needs-review`) : statusBadge('Ready', 'green', `${question.id}-ready`)}</div></td>
                  <td className="py-4 pr-4"><div className="flex max-w-xs flex-wrap gap-1.5">{question.warnings.length ? question.warnings.map((warning, index) => warningBadge(warning, `${question.id}-${warning}-${index}`)) : <span className="text-xs text-[#6f737b]">No warnings</span>}</div></td>
                  <td className="py-4 pr-4"><div className="flex min-w-36 flex-col items-start gap-2"><PendingActionLink href={`/dashboard/admin/question-bank/${question.id}/edit`} onStart={() => setOpeningAction(`edit-${question.id}`)} className="tsm-btn-secondary w-full justify-center text-center"><PendingLabel pending={openingAction === `edit-${question.id}`} pendingText="Opening…">Edit</PendingLabel></PendingActionLink><PendingActionLink href={`/dashboard/admin/question-bank/${question.id}/preview`} onStart={() => setOpeningAction(`preview-${question.id}`)} className="tsm-btn-secondary w-full justify-center text-center"><PendingLabel pending={openingAction === `preview-${question.id}`} pendingText="Opening…">Preview as student</PendingLabel></PendingActionLink></div></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!questions.length ? <p className="mt-4 font-body text-sm text-[#43474d]">No questions match these filters.</p> : null}

      {selectedIds.length ? (
        <div className="sticky bottom-4 z-10 rounded-md border border-[#c3c6ce66] bg-white/95 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-body text-sm font-semibold text-[#00152a]">{selectedIds.length} selected</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={selectAllVisible} disabled={allVisibleSelected || isPending} className="rounded-md border border-blue-200 bg-white px-3 py-2 font-body text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60">{allVisibleSelected ? 'All visible selected' : 'Select all visible'}</button>
              <button type="button" onClick={clearSelection} disabled={isPending} className="rounded-md border border-[#c3c6ce66] bg-white px-3 py-2 font-body text-sm font-semibold text-[#43474d] hover:bg-[#f5f3ee] disabled:cursor-not-allowed disabled:opacity-60">Clear selection</button>
              <button type="button" onClick={() => requestBatch(true)} disabled={isPending} className="tsm-btn-primary disabled:cursor-not-allowed disabled:opacity-60"><PendingLabel pending={pendingBatch === 'publish'} pendingText="Publishing…">Publish selected</PendingLabel></button>
              <button type="button" onClick={() => requestBatch(false)} disabled={isPending} className="tsm-btn-secondary disabled:cursor-not-allowed disabled:opacity-60"><PendingLabel pending={pendingBatch === 'unpublish'} pendingText="Unpublishing…">Unpublish selected</PendingLabel></button>
            </div>
          </div>
      </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirming)}
        title={confirming?.publish && selectedNeedsReview ? 'Publish selected questions with review issues?' : confirming?.publish ? 'Publish selected questions?' : 'Unpublish selected questions?'}
        body={confirming?.publish && selectedNeedsReview ? 'Some selected questions still need review. Students will only see questions from published papers, but you should resolve flagged items before sharing them.' : confirming?.publish ? 'Selected questions will be visible to students when their paper is also published.' : 'Selected questions will be hidden from students but remain saved in the question bank.'}
        confirmLabel={confirming?.publish ? 'Publish selected questions' : 'Unpublish selected questions'}
        pendingLabel={confirming?.publish ? 'Publishing…' : 'Unpublishing…'}
        pending={isPending}
        error={operationError}
        onClose={() => { setConfirming(null); setOperationError(null) }}
        onConfirm={() => { if (confirming) runBatch(confirming.publish) }}
      />
    </div>
  )
}
