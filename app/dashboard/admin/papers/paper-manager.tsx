'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { SearchableSelect, type SearchableSelectOption } from '@/components/searchable-select'
import { ConfirmDialog, PendingActionLink, PendingLabel } from '@/components/operation-feedback'
import { updatePaperDetails, updatePaperPublication } from './actions'

export type AdminPaperRow = {
  id: string
  title: string
  subjectId: string
  subjectName: string
  year: number | null
  session: string
  paperCode: string
  isPublished: boolean
  totalQuestions: number
  publishedQuestions: number
  draftQuestions: number
  needsReviewQuestions: number
  missingMarkschemeCount: number
  missingTopicCount: number
  missingSubtopicCount: number
  duplicateOrderCount: number
  highestOrderLabel: string
  suggestedNextOrder: number
  lastWorkedLabel: string
  lastWorkedTime: string
}

type FilterStatus = '' | 'draft' | 'published' | 'needs-review' | 'empty'
type WarningFilter = '' | 'missing-markscheme' | 'missing-topic' | 'missing-subtopic' | 'duplicate-order'

const statusFilters: { value: FilterStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'needs-review', label: 'Needs review' },
  { value: 'empty', label: 'Empty' },
]

const warningFilters: { value: WarningFilter; label: string }[] = [
  { value: '', label: 'All warnings' },
  { value: 'missing-markscheme', label: 'Missing mark scheme' },
  { value: 'missing-topic', label: 'Missing topic' },
  { value: 'missing-subtopic', label: 'Missing subtopic' },
  { value: 'duplicate-order', label: 'Duplicate order' },
]

const sessionOptions = [{ value: 'May', label: 'May' }, { value: 'November', label: 'November' }]

function filterButtonClasses(active: boolean) {
  return active
    ? 'border-[#735b2b] bg-[#735b2b] text-white shadow-sm'
    : 'border-[#c3c6ce66] bg-white text-[#43474d] hover:border-[#735b2b] hover:bg-[#f5f3ee]'
}

function pill(label: string, tone: 'green' | 'amber' | 'grey' | 'blue') {
  const classes = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    grey: 'border-slate-200 bg-slate-50 text-slate-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
  }[tone]
  return <span className={`rounded-full border px-2 py-1 font-body text-xs font-semibold ${classes}`}>{label}</span>
}

function readinessLabel(paper: AdminPaperRow) {
  if (paper.totalQuestions === 0) return pill('Empty paper', 'grey')
  if (paper.needsReviewQuestions > 0) return pill('Needs review', 'amber')
  return pill('Ready', 'green')
}

function EditPaperPanel({ paper, subjects, onClose }: { paper: AdminPaperRow; subjects: SearchableSelectOption[]; onClose: () => void }) {
  const [openSelectId, setOpenSelectId] = useState<string | null>(null)
  const [title, setTitle] = useState(paper.title)
  const [subjectId, setSubjectId] = useState(paper.subjectId)
  const [session, setSession] = useState(paper.session || 'May')
  const [published, setPublished] = useState(paper.isPublished)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function submit(formData: FormData) {
    formData.set('title', title)
    formData.set('subject_id', subjectId)
    formData.set('session', session)
    formData.set('is_published', published ? 'true' : 'false')
    startTransition(async () => {
      const result = await updatePaperDetails(formData)
      if (result.ok) {
        toast.success(result.message)
        router.refresh()
        onClose()
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <div className="rounded-md border border-blue-100 bg-blue-50/60 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-headline text-2xl text-[#00152a]">Edit paper details</h3>
          <p className="font-body text-sm text-[#43474d]">Students only see published paper + published questions.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-md border border-[#c3c6ce66] bg-white px-3 py-2 font-body text-sm font-semibold text-[#43474d] hover:bg-[#f5f3ee]">Close</button>
      </div>
      <form action={submit} className="grid gap-4 md:grid-cols-2">
        <input type="hidden" name="paper_id" value={paper.id} />
        <label className="font-body text-sm text-[#43474d] md:col-span-2">Title<input name="title" value={title} onChange={(event) => setTitle(event.target.value)} className="tsm-input mt-1 w-full" required /></label>
        <SearchableSelect id={`paper-subject-${paper.id}`} name="subject_id" label="Subject" value={subjectId} onChange={setSubjectId} placeholder="Choose subject" emptyText="No subjects found." options={subjects} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
        <SearchableSelect id={`paper-session-${paper.id}`} name="session" label="Session" value={session} onChange={setSession} placeholder="Choose session" emptyText="No sessions found." options={sessionOptions} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
        <label className="font-body text-sm text-[#43474d]">Year<input name="year" defaultValue={paper.year ?? ''} inputMode="numeric" className="tsm-input mt-1 w-full" required /></label>
        <label className="font-body text-sm text-[#43474d]">Paper code/component<input name="paper_code" defaultValue={paper.paperCode} className="tsm-input mt-1 w-full" placeholder="Optional" /></label>
        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#c3c6ce66] bg-white p-3">
          <div>
            <p className="font-body text-sm font-semibold text-[#00152a]">Published paper</p>
            <p className="font-body text-xs text-[#43474d]">Publishing the paper does not publish draft questions.</p>
          </div>
          <button type="button" onClick={() => setPublished((value) => !value)} aria-pressed={published} className={`rounded-full border px-4 py-2 font-body text-sm font-semibold ${published ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{published ? 'Published' : 'Draft'}</button>
        </div>
        <div className="md:col-span-2 flex flex-wrap gap-3">
          <button type="submit" disabled={isPending} className="tsm-btn-primary disabled:cursor-not-allowed disabled:opacity-60">{isPending ? 'Saving…' : 'Save paper details'}</button>
          <button type="button" onClick={onClose} disabled={isPending} className="tsm-btn-secondary disabled:opacity-60">Cancel</button>
        </div>
      </form>
    </div>
  )
}

export function PaperManager({ papers, subjects }: { papers: AdminPaperRow[]; subjects: SearchableSelectOption[] }) {
  const [openSelectId, setOpenSelectId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [subject, setSubject] = useState('')
  const [status, setStatus] = useState<FilterStatus>('')
  const [warning, setWarning] = useState<WarningFilter>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<{ paper: AdminPaperRow; publish: boolean } | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [openingAction, setOpeningAction] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const visiblePapers = useMemo(() => papers.filter((paper) => {
    const haystack = [paper.title, paper.paperCode, paper.subjectName, paper.year, paper.session].join(' ').toLowerCase()
    if (query && !haystack.includes(query.toLowerCase())) return false
    if (subject && paper.subjectId !== subject) return false
    if (status === 'draft' && paper.isPublished) return false
    if (status === 'published' && !paper.isPublished) return false
    if (status === 'needs-review' && paper.needsReviewQuestions === 0) return false
    if (status === 'empty' && paper.totalQuestions > 0) return false
    if (warning === 'missing-markscheme' && paper.missingMarkschemeCount === 0) return false
    if (warning === 'missing-topic' && paper.missingTopicCount === 0) return false
    if (warning === 'missing-subtopic' && paper.missingSubtopicCount === 0) return false
    if (warning === 'duplicate-order' && paper.duplicateOrderCount === 0) return false
    return true
  }), [papers, query, subject, status, warning])

  function runPublication(paper: AdminPaperRow, publish: boolean, confirmed = false) {
    if (!confirmed && publish && paper.needsReviewQuestions > 0) {
      setOperationError(null)
      setConfirming({ paper, publish })
      return
    }
    if (!confirmed && !publish) {
      setOperationError(null)
      setConfirming({ paper, publish })
      return
    }
    startTransition(async () => {
      const result = await updatePaperPublication(paper.id, publish)
      if (result.ok) {
        toast.success(result.message)
        router.refresh()
        setConfirming(null)
      } else {
        setOperationError(result.message)
        toast.error(result.message)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-blue-100 bg-white p-5 shadow-sm">
        <p className="mb-4 font-body text-sm font-semibold text-[#00152a]">Filter papers</p>
        <div className="grid gap-4 md:grid-cols-3">
          <label htmlFor="paper-manager-search" className="font-body text-sm text-[#43474d] md:col-span-2">Search<input id="paper-manager-search" value={query} onChange={(event) => setQuery(event.target.value)} className="tsm-input mt-1 w-full" placeholder="Paper title, code, or subject" /></label>
          <SearchableSelect id="paper-manager-subject" label="Subject" value={subject} onChange={setSubject} placeholder="All subjects" emptyText="No subjects found." options={subjects} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[.08em] text-[#735b2b]">Paper status</p>
            <div className="flex flex-wrap gap-2">{statusFilters.map((filter) => <button key={filter.value || 'all'} type="button" onClick={() => setStatus(filter.value)} className={`rounded-full border px-3 py-1.5 font-body text-sm font-semibold transition ${filterButtonClasses(status === filter.value)}`}>{filter.label}</button>)}</div>
          </div>
          <div>
            <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[.08em] text-[#735b2b]">Warnings</p>
            <div className="flex flex-wrap gap-2">{warningFilters.map((filter) => <button key={filter.value || 'all-warnings'} type="button" onClick={() => setWarning(filter.value)} className={`rounded-full border px-3 py-1.5 font-body text-sm font-semibold transition ${filterButtonClasses(warning === filter.value)}`}>{filter.label}</button>)}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={() => { setQuery(''); setSubject(''); setStatus(''); setWarning('') }} className="tsm-btn-secondary">Clear</button><p className="font-body text-sm text-[#43474d]">{visiblePapers.length} shown</p></div>
      </div>

      <ConfirmDialog
        open={Boolean(confirming)}
        title={confirming?.publish ? 'Publish paper with review issues?' : 'Unpublish paper?'}
        body={confirming?.publish ? 'This paper still has questions that need review. Students will only see published questions, but you should resolve the flagged items before sharing the paper.' : 'Students will no longer be able to access this paper. Published questions inside it will remain saved but hidden until the paper is published again.'}
        confirmLabel={confirming?.publish ? 'Publish paper' : 'Unpublish paper'}
        pendingLabel={confirming?.publish ? 'Publishing…' : 'Unpublishing…'}
        pending={isPending}
        error={operationError}
        onClose={() => { setConfirming(null); setOperationError(null) }}
        onConfirm={() => { if (confirming) runPublication(confirming.paper, confirming.publish, true) }}
      />

      <div className="space-y-4">
        {visiblePapers.map((paper) => (
          <article key={paper.id} className="rounded-md border border-[#c3c6ce66] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">{paper.isPublished ? pill('Published paper', 'green') : pill('Draft paper', 'grey')}{readinessLabel(paper)}</div>
                <h2 className="mt-3 font-headline text-3xl text-[#00152a]">{paper.title}</h2>
                <p className="mt-1 font-body text-sm text-[#43474d]">{paper.subjectName} · {[paper.session, paper.year].filter(Boolean).join(' ') || 'No session'}{paper.paperCode ? ` · ${paper.paperCode}` : ''}</p>
                <p className="mt-2 font-body text-xs font-semibold text-blue-900">Students only see published paper + published questions.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[28rem]">
                <PendingActionLink href={`/dashboard/admin/question-bank/from-pdf?paperId=${paper.id}`} onStart={() => setOpeningAction(`add-${paper.id}`)} className="tsm-btn-primary justify-center text-center"><PendingLabel pending={openingAction === `add-${paper.id}`} pendingText="Opening…">Continue adding</PendingLabel></PendingActionLink>
                <PendingActionLink href={`/dashboard/admin/question-bank?paper=${paper.id}`} onStart={() => setOpeningAction(`review-${paper.id}`)} className="tsm-btn-secondary justify-center text-center"><PendingLabel pending={openingAction === `review-${paper.id}`} pendingText="Opening…">Review questions</PendingLabel></PendingActionLink>
                <PendingActionLink href={`/dashboard/admin/papers/${paper.id}/preview`} onStart={() => setOpeningAction(`preview-${paper.id}`)} className="tsm-btn-secondary justify-center text-center"><PendingLabel pending={openingAction === `preview-${paper.id}`} pendingText="Opening…">Preview as student</PendingLabel></PendingActionLink>
                <button type="button" onClick={() => setEditingId(editingId === paper.id ? null : paper.id)} className="tsm-btn-secondary justify-center">{editingId === paper.id ? 'Close paper details' : 'Edit paper details'}</button>
                {paper.isPublished ? <button type="button" onClick={() => runPublication(paper, false)} disabled={isPending} className="tsm-btn-secondary justify-center disabled:cursor-not-allowed disabled:opacity-60">Unpublish paper</button> : <button type="button" onClick={() => runPublication(paper, true)} disabled={isPending} className="tsm-btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60">Publish paper</button>}
              </div>
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <div className="rounded-sm bg-[#f5f3ee] p-3"><dt className="font-body text-xs text-[#6f737b]">Total questions</dt><dd className="font-headline text-2xl text-[#00152a]">{paper.totalQuestions}</dd></div>
              <div className="rounded-sm bg-[#f5f3ee] p-3"><dt className="font-body text-xs text-[#6f737b]">Published / Draft</dt><dd className="font-headline text-2xl text-[#00152a]">{paper.publishedQuestions} / {paper.draftQuestions}</dd></div>
              <div className="rounded-sm bg-[#f5f3ee] p-3"><dt className="font-body text-xs text-[#6f737b]">Needs review</dt><dd className="font-headline text-2xl text-[#00152a]">{paper.needsReviewQuestions}</dd></div>
              <div className="rounded-sm bg-[#f5f3ee] p-3"><dt className="font-body text-xs text-[#6f737b]">Missing mark schemes</dt><dd className="font-headline text-2xl text-[#00152a]">{paper.missingMarkschemeCount}</dd></div>
              <div className="rounded-sm bg-[#f5f3ee] p-3"><dt className="font-body text-xs text-[#6f737b]">Missing topic/subtopic</dt><dd className="font-headline text-2xl text-[#00152a]">{paper.missingTopicCount} / {paper.missingSubtopicCount}</dd></div>
              <div className="rounded-sm bg-[#f5f3ee] p-3"><dt className="font-body text-xs text-[#6f737b]">Duplicate orders</dt><dd className="font-headline text-2xl text-[#00152a]">{paper.duplicateOrderCount}</dd></div>
            </dl>

            <div className="mt-4 grid gap-3 font-body text-sm text-[#43474d] md:grid-cols-3">
              <p><span className="font-semibold text-[#00152a]">Previous by order:</span> {paper.highestOrderLabel}</p>
              <p><span className="font-semibold text-[#00152a]">Suggested next order:</span> {paper.suggestedNextOrder}</p>
              <p><span className="font-semibold text-[#00152a]">Last worked:</span> {paper.lastWorkedLabel}{paper.lastWorkedTime ? ` · ${paper.lastWorkedTime}` : ''}</p>
            </div>

            {editingId === paper.id ? <div className="mt-5"><EditPaperPanel paper={paper} subjects={subjects} onClose={() => setEditingId(null)} /></div> : null}
          </article>
        ))}
        {!visiblePapers.length ? <p className="rounded-md border border-[#c3c6ce66] bg-white p-6 font-body text-sm text-[#43474d]">No papers match these filters.</p> : null}
      </div>
    </div>
  )
}
