'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { createTopic, mergeSubtopics, renameTopic, reorderTopic, toggleTopicActive } from './actions'

type Subject = { id: string; name: string }
type Topic = { id: string; subject_id: string | null; parent_topic_id: string | null; name: string; slug: string | null; level: string | null; sort_order: number | null; is_active: boolean | null }
type QuestionTopic = { question_id: string; topic_id: string }
type Option = { value: string; label: string; helper?: string }

type TopicManagerProps = {
  subjects: Subject[]
  topics: Topic[]
  questionTopics: QuestionTopic[]
  initialSubjectId: string
  initialGroupId: string
  notice?: string
  error?: string
}

function SearchableSelect({ id, label, value, options, placeholder, emptyText, onChange, openSelectId, setOpenSelectId }: { id: string; label: string; value: string; options: Option[]; placeholder: string; emptyText: string; onChange: (value: string) => void; openSelectId: string | null; setOpenSelectId: (id: string | null) => void }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const open = openSelectId === id
  const selected = options.find((option) => option.value === value)
  const filtered = options.filter((option) => `${option.label} ${option.helper ?? ''}`.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    if (!open) return
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => window.clearTimeout(focusTimer)
  }, [open, query])

  useEffect(() => {
    if (!open) return
    function closeOnOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpenSelectId(null)
    }
    function closeOnEsc(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setOpenSelectId(null)
    }
    document.addEventListener('mousedown', closeOnOutside)
    window.addEventListener('keydown', closeOnEsc)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      window.removeEventListener('keydown', closeOnEsc)
    }
  }, [open, setOpenSelectId])

  function choose(nextValue: string) {
    onChange(nextValue)
    setOpenSelectId(null)
    setQuery('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpenSelectId(id)
      setActiveIndex((current) => Math.max(0, Math.min(filtered.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))))
    }
    if (event.key === 'Enter' && open && filtered[activeIndex]) {
      event.preventDefault()
      choose(filtered[activeIndex].value)
    }
    if (event.key === 'Escape') setOpenSelectId(null)
  }

  return (
    <div ref={rootRef} className="relative font-body text-sm text-[#43474d]">
      <label id={`${id}-label`} className="block">{label}</label>
      <button id={id} type="button" aria-labelledby={`${id}-label`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpenSelectId(open ? null : id)} onKeyDown={handleKeyDown} className="tsm-input mt-1 flex w-full cursor-pointer items-center justify-between gap-3 text-left transition hover:border-[#735b2b] focus:outline-none focus:ring-2 focus:ring-[#735b2b]/30">
        <span className={selected ? 'text-[#00152a]' : 'text-[#6f737b]'}>{selected?.label || placeholder}</span>
        <span className="text-[#735b2b]" aria-hidden="true">⌄</span>
      </button>
      {open ? (
        <div className="absolute z-30 mt-2 w-full rounded-md border border-[#c3c6ce66] bg-white p-2 shadow-lg">
          <input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }} placeholder="Search..." className="tsm-input mb-2 w-full" />
          <div role="listbox" aria-labelledby={`${id}-label`} className="max-h-64 overflow-y-auto">
            {filtered.map((option, index) => (
              <button key={option.value} type="button" role="option" aria-selected={option.value === value} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option.value)} className={`block w-full rounded-sm px-3 py-2 text-left transition ${option.value === value ? 'bg-[#00152a] text-white' : index === activeIndex ? 'bg-[#f5f3ee] text-[#00152a]' : 'text-[#00152a] hover:bg-[#f5f3ee]'}`}>
                <span className="block font-semibold">{option.label}</span>
                {option.helper ? <span className={`block text-xs ${option.value === value ? 'text-[#f5f3ee]' : 'text-[#6f737b]'}`}>{option.helper}</span> : null}
              </button>
            ))}
            {!filtered.length ? <p className="px-3 py-4 text-sm text-[#6f737b]">{emptyText}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function HiddenContext({ subjectId, groupId }: { subjectId: string; groupId?: string }) {
  return <><input type="hidden" name="current_subject_id" value={subjectId} /><input type="hidden" name="current_group_id" value={groupId ?? ''} /></>
}

function StatusBadge({ active }: { active: boolean }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{active ? 'Active' : 'Inactive'}</span>
}

export function TopicManager({ subjects, topics, questionTopics, initialSubjectId, initialGroupId, notice, error }: TopicManagerProps) {
  const [subjectId, setSubjectId] = useState(initialSubjectId)
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId)
  const [openSelectId, setOpenSelectId] = useState<string | null>(null)
  const [mergeSourceId, setMergeSourceId] = useState('')
  const [mergeTargetId, setMergeTargetId] = useState('')

  const subjectTopics = useMemo(() => topics.filter((topic) => topic.subject_id === subjectId), [topics, subjectId])
  const groups = useMemo(() => subjectTopics.filter((topic) => !topic.parent_topic_id).sort(sortTopics), [subjectTopics])
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0]
  const activeSelectedGroupId = selectedGroup?.id ?? ''
  const subtopics = useMemo(() => subjectTopics.filter((topic) => topic.parent_topic_id === activeSelectedGroupId).sort(sortTopics), [subjectTopics, activeSelectedGroupId])
  const questionIdsByTopic = useMemo(() => {
    const map = new Map<string, Set<string>>()
    questionTopics.forEach((row) => {
      if (!map.has(row.topic_id)) map.set(row.topic_id, new Set())
      map.get(row.topic_id)?.add(row.question_id)
    })
    return map
  }, [questionTopics])


  function topicQuestionCount(topicId: string) {
    return questionIdsByTopic.get(topicId)?.size ?? 0
  }

  function groupQuestionCount(groupId: string) {
    const ids = new Set(questionIdsByTopic.get(groupId) ?? [])
    subjectTopics.filter((topic) => topic.parent_topic_id === groupId).forEach((topic) => questionIdsByTopic.get(topic.id)?.forEach((questionId) => ids.add(questionId)))
    return ids.size
  }

  const activeSubtopics = subtopics.filter((topic) => topic.is_active !== false)
  const mergeOptions = activeSubtopics.map((topic) => ({ value: topic.id, label: topic.name, helper: `${topicQuestionCount(topic.id)} question${topicQuestionCount(topic.id) === 1 ? '' : 's'}` }))

  function updateSubject(nextSubjectId: string) {
    setSubjectId(nextSubjectId)
    const nextGroup = topics.filter((topic) => topic.subject_id === nextSubjectId && !topic.parent_topic_id).sort(sortTopics)[0]
    setSelectedGroupId(nextGroup?.id ?? '')
    setMergeSourceId('')
    setMergeTargetId('')
  }

  return (
    <div className="space-y-8">
      {(notice || error) ? <p className={`rounded-md border px-4 py-3 font-body text-sm ${error ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error || notice}</p> : null}

      <section className="rounded-md border border-[#c3c6ce66] bg-white p-6">
        <SearchableSelect id="topic-manager-subject" label="Subject" value={subjectId} onChange={updateSubject} placeholder="Choose subject" emptyText="No matching subjects found." options={subjects.map((subject) => ({ value: subject.id, label: subject.name }))} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-md border border-[#c3c6ce66] bg-white p-6">
          <div>
            <p className="font-label text-xs uppercase tracking-[.14em] text-[#735b2b]">Topic groups</p>
            <h2 className="mt-2 font-headline text-3xl text-[#00152a]">Groups</h2>
          </div>
          <form action={createTopic} className="mt-5 grid gap-3 rounded-md border border-[#c3c6ce66] bg-[#fbf9f4] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <HiddenContext subjectId={subjectId} groupId={activeSelectedGroupId} />
            <input type="hidden" name="subject_id" value={subjectId} />
            <label className="font-body text-sm text-[#43474d]">
              New topic group
              <input name="name" required placeholder="Topic group name" className="tsm-input mt-1 min-w-0" />
            </label>
            <button className="tsm-btn-primary w-full sm:w-auto" type="submit">Add group</button>
          </form>

          <div className="mt-6 space-y-3">
            {groups.map((group, index) => {
              const childCount = subjectTopics.filter((topic) => topic.parent_topic_id === group.id).length
              return (
                <article key={group.id} className={`rounded-md border p-4 ${group.id === activeSelectedGroupId ? 'border-[#735b2b] bg-[#fbf9f4]' : 'border-[#c3c6ce66] bg-white'}`}>
                  <button type="button" onClick={() => { setSelectedGroupId(group.id); setMergeSourceId(''); setMergeTargetId('') }} className="block w-full rounded-sm text-left focus:outline-none focus:ring-2 focus:ring-[#735b2b]/30">
                    <span className="flex flex-wrap items-start justify-between gap-3">
                      <strong className="min-w-0 flex-1 break-words font-headline text-2xl leading-tight text-[#00152a]" title={group.name}>{group.name}</strong>
                      <StatusBadge active={group.is_active !== false} />
                    </span>
                    <span className="mt-2 block font-body text-sm text-[#43474d]">{childCount} subtopic{childCount === 1 ? '' : 's'} · {groupQuestionCount(group.id)} question{groupQuestionCount(group.id) === 1 ? '' : 's'}</span>
                  </button>
                  <TopicActions topic={group} subjectId={subjectId} groupId={activeSelectedGroupId} index={index} lastIndex={groups.length - 1} />
                </article>
              )
            })}
            {!groups.length ? <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 font-body text-sm text-amber-800">No topic groups yet for this subject.</p> : null}
          </div>
        </section>

        <section className="rounded-md border border-[#c3c6ce66] bg-white p-6">
          <div>
            <p className="font-label text-xs uppercase tracking-[.14em] text-[#735b2b]">Subtopics</p>
            <h2 className="mt-2 break-words font-headline text-3xl text-[#00152a]" title={selectedGroup?.name}>{selectedGroup?.name ?? 'Choose a group'}</h2>
          </div>
          <form action={createTopic} className="mt-5 grid gap-3 rounded-md border border-[#c3c6ce66] bg-[#fbf9f4] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <HiddenContext subjectId={subjectId} groupId={activeSelectedGroupId} />
            <input type="hidden" name="subject_id" value={subjectId} />
            <input type="hidden" name="parent_topic_id" value={activeSelectedGroupId} />
            <label className="font-body text-sm text-[#43474d]">
              New subtopic
              <input name="name" required disabled={!activeSelectedGroupId} placeholder="Subtopic name" className="tsm-input mt-1 min-w-0 disabled:opacity-50" />
            </label>
            <button className="tsm-btn-primary w-full disabled:opacity-50 sm:w-auto" type="submit" disabled={!activeSelectedGroupId}>Add subtopic</button>
          </form>

          <div className="mt-6 space-y-3">
            {subtopics.map((subtopic, index) => (
              <article key={subtopic.id} className="rounded-md border border-[#c3c6ce66] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-headline text-2xl leading-tight text-[#00152a]" title={subtopic.name}>{subtopic.name}</h3>
                    <p className="mt-2 font-body text-sm text-[#43474d]">{topicQuestionCount(subtopic.id)} question{topicQuestionCount(subtopic.id) === 1 ? '' : 's'} tagged</p>
                  </div>
                  <StatusBadge active={subtopic.is_active !== false} />
                </div>
                <TopicActions topic={subtopic} subjectId={subjectId} groupId={activeSelectedGroupId} index={index} lastIndex={subtopics.length - 1} />
              </article>
            ))}
            {!subtopics.length ? <p className="rounded-md border border-[#c3c6ce66] bg-[#fbf9f4] px-4 py-3 font-body text-sm text-[#43474d]">No subtopics yet for this group.</p> : null}
          </div>

          <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 p-5">
            <h3 className="font-headline text-2xl text-[#00152a]">Merge duplicate subtopics</h3>
            <p className="mt-2 max-w-2xl font-body text-sm leading-6 text-amber-900">This will move all question tags from source to target and deactivate the source topic. Use this only after confirming both subtopics belong together.</p>
            <form action={mergeSubtopics} className="mt-5 space-y-5">
              <HiddenContext subjectId={subjectId} groupId={activeSelectedGroupId} />
              <input type="hidden" name="source_topic_id" value={mergeSourceId} />
              <input type="hidden" name="target_topic_id" value={mergeTargetId} />
              <div className="grid gap-4 md:grid-cols-2">
                <SearchableSelect id="merge-source" label="Source subtopic" value={mergeSourceId} onChange={(value) => { setMergeSourceId(value); if (value === mergeTargetId) setMergeTargetId('') }} placeholder="Choose duplicate source" emptyText="No source subtopics found." options={mergeOptions.filter((option) => option.value !== mergeTargetId)} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
                <SearchableSelect id="merge-target" label="Target subtopic" value={mergeTargetId} onChange={(value) => { setMergeTargetId(value); if (value === mergeSourceId) setMergeSourceId('') }} placeholder="Choose official target" emptyText="No target subtopics found." options={mergeOptions.filter((option) => option.value !== mergeSourceId)} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
              </div>
              <button className="tsm-btn-primary w-full disabled:opacity-50 sm:w-auto" type="submit" disabled={!mergeSourceId || !mergeTargetId}>Confirm merge</button>
            </form>
          </div>
        </section>
      </div>
    </div>
  )
}

function TopicActions({ topic, subjectId, groupId, index, lastIndex }: { topic: Topic; subjectId: string; groupId: string; index: number; lastIndex: number }) {
  const [isRenaming, setIsRenaming] = useState(false)
  const isInactive = topic.is_active === false

  return (
    <div className="mt-4 space-y-4 border-t border-[#c3c6ce66] pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="tsm-btn-secondary px-3 py-2" type="button" onClick={() => setIsRenaming(true)}>Rename</button>
        <form action={reorderTopic}>
          <HiddenContext subjectId={subjectId} groupId={groupId} />
          <input type="hidden" name="topic_id" value={topic.id} />
          <input type="hidden" name="direction" value="up" />
          <button className="tsm-btn-secondary inline-flex items-center gap-1 px-3 py-2 disabled:opacity-50" disabled={index === 0} type="submit" aria-label={`Move ${topic.name} up`} title="Move up"><ChevronUp className="size-4" />Up</button>
        </form>
        <form action={reorderTopic}>
          <HiddenContext subjectId={subjectId} groupId={groupId} />
          <input type="hidden" name="topic_id" value={topic.id} />
          <input type="hidden" name="direction" value="down" />
          <button className="tsm-btn-secondary inline-flex items-center gap-1 px-3 py-2 disabled:opacity-50" disabled={index === lastIndex} type="submit" aria-label={`Move ${topic.name} down`} title="Move down"><ChevronDown className="size-4" />Down</button>
        </form>
        <form action={toggleTopicActive}>
          <HiddenContext subjectId={subjectId} groupId={groupId} />
          <input type="hidden" name="topic_id" value={topic.id} />
          <input type="hidden" name="next_active" value={isInactive ? 'true' : 'false'} />
          <button className={`${isInactive ? 'tsm-btn-primary' : 'tsm-btn-secondary'} px-3 py-2`} type="submit">{isInactive ? 'Reactivate' : 'Deactivate'}</button>
        </form>
      </div>

      {isRenaming ? (
        <form action={renameTopic} className="grid gap-3 rounded-md border border-[#c3c6ce66] bg-white/70 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
          <HiddenContext subjectId={subjectId} groupId={groupId} />
          <input type="hidden" name="topic_id" value={topic.id} />
          <label className="font-body text-sm text-[#43474d]">
            Rename {topic.parent_topic_id ? 'subtopic' : 'group'}
            <input name="name" required defaultValue={topic.name} className="tsm-input mt-1 min-w-0" aria-label={`Rename ${topic.name}`} />
          </label>
          <button className="tsm-btn-primary w-full sm:w-auto" type="submit">Save</button>
          <button className="tsm-btn-secondary w-full sm:w-auto" type="button" onClick={() => setIsRenaming(false)}>Cancel</button>
        </form>
      ) : null}
    </div>
  )
}

function sortTopics(a: Topic, b: Topic) {
  return (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)
}
