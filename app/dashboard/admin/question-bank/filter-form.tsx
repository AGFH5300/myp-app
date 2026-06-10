'use client'

import Link from 'next/link'
import { useState } from 'react'
import { SearchableSelect, type SearchableSelectOption } from '@/components/searchable-select'

type AdminQuestionBankFilterFormProps = {
  initial: { q: string; subject: string; paper: string; topic: string; status: string; warning: string }
  subjects: SearchableSelectOption[]
  papers: SearchableSelectOption[]
  topics: SearchableSelectOption[]
}

const statusFilters = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'needs-review', label: 'Needs review' },
]

const warningFilters = [
  { value: '', label: 'All warnings' },
  { value: 'missing-markscheme', label: 'Missing mark scheme' },
  { value: 'missing-topic', label: 'Missing topic' },
  { value: 'missing-question-image', label: 'Missing question image' },
]

function filterButtonClasses(active: boolean) {
  return active
    ? 'border-[#735b2b] bg-[#735b2b] text-white shadow-sm'
    : 'border-[#c3c6ce66] bg-white text-[#43474d] hover:border-[#735b2b] hover:bg-[#f5f3ee]'
}

export function AdminQuestionBankFilterForm({ initial, subjects, papers, topics }: AdminQuestionBankFilterFormProps) {
  const [openSelectId, setOpenSelectId] = useState<string | null>(null)
  const [subject, setSubject] = useState(initial.subject)
  const [paper, setPaper] = useState(initial.paper)
  const [topic, setTopic] = useState(initial.topic)
  const [status, setStatus] = useState(initial.status)
  const [warning, setWarning] = useState(initial.warning)

  return (
    <form className="rounded-md border border-blue-100 bg-white p-5 shadow-sm" action="/dashboard/admin/question-bank">
      <p className="mb-4 font-body text-sm font-semibold text-[#00152a]">Filter the admin question list</p>
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="warning" value={warning} />
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <label htmlFor="admin-qb-filter-search" className="md:col-span-2 font-body text-sm text-[#43474d]">Search<input id="admin-qb-filter-search" name="q" className="tsm-input mt-1 w-full" defaultValue={initial.q} placeholder="Paper, subject, topic, or Q1a" /></label>
        <SearchableSelect id="admin-qb-filter-subject" name="subject" label="Subject" value={subject} onChange={setSubject} placeholder="All subjects" emptyText="No matching subjects found." options={subjects} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
        <SearchableSelect id="admin-qb-filter-paper" name="paper" label="Paper" value={paper} onChange={setPaper} placeholder="All papers" emptyText="No matching papers found." options={papers} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
        <SearchableSelect id="admin-qb-filter-topic" name="topic" label="Topic" value={topic} onChange={setTopic} placeholder="All topics" emptyText="No matching topics found." options={topics} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[.08em] text-[#735b2b]">Readiness</p>
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => <button key={filter.value || 'all'} type="button" onClick={() => setStatus(filter.value)} className={`rounded-full border px-3 py-1.5 font-body text-sm font-semibold transition ${filterButtonClasses(status === filter.value)}`}>{filter.label}</button>)}
          </div>
        </div>
        <div>
          <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[.08em] text-[#735b2b]">Review warnings</p>
          <div className="flex flex-wrap gap-2">
            {warningFilters.map((filter) => <button key={filter.value || 'all-warnings'} type="button" onClick={() => setWarning(filter.value)} className={`rounded-full border px-3 py-1.5 font-body text-sm font-semibold transition ${filterButtonClasses(warning === filter.value)}`}>{filter.label}</button>)}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3"><button type="submit" className="tsm-btn-primary">Apply filters</button><Link href="/dashboard/admin/question-bank" className="tsm-btn-secondary">Clear</Link></div>
    </form>
  )
}
