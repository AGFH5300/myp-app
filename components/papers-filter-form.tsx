"use client"

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { SearchableSelect, type SearchableSelectOption } from '@/components/searchable-select'

type TopicOption = SearchableSelectOption & { subjectId?: string | null; parentTopicId?: string | null }

export function PapersFilterForm({ initial, subjects, papers, topicGroups, subtopics }: { initial: { subject: string; paper: string; topicGroup: string; subtopic: string; q: string }; subjects: SearchableSelectOption[]; papers: (SearchableSelectOption & { subjectId?: string | null })[]; topicGroups: TopicOption[]; subtopics: TopicOption[] }) {
  const [openSelectId, setOpenSelectId] = useState<string | null>(null)
  const [subject, setSubject] = useState(initial.subject)
  const [paper, setPaper] = useState(initial.paper)
  const [topicGroup, setTopicGroup] = useState(initial.topicGroup)
  const [subtopic, setSubtopic] = useState(initial.subtopic)

  const paperOptions = useMemo(() => papers.filter((option) => !subject || option.subjectId === subject), [papers, subject])
  const topicGroupOptions = useMemo(() => topicGroups.filter((option) => !subject || option.subjectId === subject), [topicGroups, subject])
  const subtopicOptions = useMemo(() => subtopics.filter((option) => (!subject || option.subjectId === subject) && (!topicGroup || option.parentTopicId === topicGroup)), [subtopics, subject, topicGroup])

  return (
    <form className="grid gap-4 rounded-md border border-[#c3c6ce66] bg-white p-5 md:grid-cols-2 xl:grid-cols-5">
      <SearchableSelect id="papers-filter-subject" name="subject" label="Subject" value={subject} onChange={(value) => { setSubject(value); setPaper(''); setTopicGroup(''); setSubtopic('') }} placeholder="All subjects" emptyText="No matching subjects found." options={subjects} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
      <SearchableSelect id="papers-filter-paper" name="paper" label="Paper" value={paper} onChange={setPaper} placeholder="All papers" emptyText="No matching papers found." options={paperOptions} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
      <SearchableSelect id="papers-filter-topic-group" name="topicGroup" label="Topic group" value={topicGroup} onChange={(value) => { setTopicGroup(value); setSubtopic('') }} placeholder="All topic groups" emptyText="No matching topic groups found." options={topicGroupOptions} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
      <SearchableSelect id="papers-filter-subtopic" name="subtopic" label="Subtopic" value={subtopic} onChange={setSubtopic} placeholder="All subtopics" emptyText="No matching subtopics found." options={subtopicOptions} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
      <div className="font-body text-sm text-[#43474d]">
        <label htmlFor="papers-filter-search" className="block">Search</label>
        <input id="papers-filter-search" type="search" name="q" defaultValue={initial.q} className="tsm-input mt-1 w-full" placeholder="Question number or paper title" />
      </div>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2 xl:col-span-5">
        <button type="submit" className="tsm-btn-primary">Apply filters</button>
        <Link href="/dashboard/papers" className="tsm-btn-secondary">Clear</Link>
      </div>
    </form>
  )
}
