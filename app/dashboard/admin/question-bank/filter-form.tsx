'use client'

import Link from 'next/link'
import { useState } from 'react'
import { SearchableSelect, type SearchableSelectOption } from '@/components/searchable-select'

type AdminQuestionBankFilterFormProps = {
  initial: { q: string; subject: string; paper: string; topic: string; published: string; reviewed: string }
  subjects: SearchableSelectOption[]
  papers: SearchableSelectOption[]
  topics: SearchableSelectOption[]
}

export function AdminQuestionBankFilterForm({ initial, subjects, papers, topics }: AdminQuestionBankFilterFormProps) {
  const [openSelectId, setOpenSelectId] = useState<string | null>(null)
  const [subject, setSubject] = useState(initial.subject)
  const [paper, setPaper] = useState(initial.paper)
  const [topic, setTopic] = useState(initial.topic)
  const [published, setPublished] = useState(initial.published)
  const [reviewed, setReviewed] = useState(initial.reviewed)

  return (
    <form className="rounded-md border border-blue-100 bg-white p-5 shadow-sm" action="/dashboard/admin/question-bank">
      <p className="mb-4 font-body text-sm font-semibold text-[#00152a]">Filter the admin question list</p>
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <label htmlFor="admin-qb-filter-search" className="md:col-span-2 font-body text-sm text-[#43474d]">Search<input id="admin-qb-filter-search" name="q" className="tsm-input mt-1 w-full" defaultValue={initial.q} placeholder="Paper, topic, or Q1a" /></label>
        <SearchableSelect id="admin-qb-filter-subject" name="subject" label="Subject" value={subject} onChange={setSubject} placeholder="All subjects" emptyText="No matching subjects found." options={subjects} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
        <SearchableSelect id="admin-qb-filter-paper" name="paper" label="Paper" value={paper} onChange={setPaper} placeholder="All papers" emptyText="No matching papers found." options={papers} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
        <SearchableSelect id="admin-qb-filter-topic" name="topic" label="Topic" value={topic} onChange={setTopic} placeholder="All topics" emptyText="No matching topics found." options={topics} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
        <SearchableSelect id="admin-qb-filter-published" name="published" label="Shown" value={published} onChange={setPublished} placeholder="Any" emptyText="No matching states found." options={[{ value: 'true', label: 'Show to students' }, { value: 'false', label: 'Hidden' }]} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
        <SearchableSelect id="admin-qb-filter-reviewed" name="reviewed" label="Checked" value={reviewed} onChange={setReviewed} placeholder="Any" emptyText="No matching states found." options={[{ value: 'true', label: 'Checked/ready' }, { value: 'false', label: 'Needs review' }]} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3"><button type="submit" className="tsm-btn-primary">Apply filters</button><Link href="/dashboard/admin/question-bank" className="tsm-btn-secondary">Clear</Link></div>
    </form>
  )
}
