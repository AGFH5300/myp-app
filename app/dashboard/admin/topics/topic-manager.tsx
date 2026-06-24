'use client'

import { useMemo, useState, type FormEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { SearchableSelect } from '@/components/searchable-select'
import { createTopic, mergeSubtopics, renameTopic, reorderTopic, toggleTopicActive, type TopicActionResult } from './actions'

type Subject = { id: string; name: string }
type Topic = { id: string; subject_id: string | null; parent_topic_id: string | null; name: string; slug: string | null; sort_order: number | null; is_active: boolean | null }
type QuestionTopic = { question_id: string; topic_id: string }

type TopicManagerProps = {
  subjects: Subject[]
  topics: Topic[]
  questionTopics: QuestionTopic[]
  initialSubjectId: string
  initialGroupId: string
  notice?: string
  error?: string
}

type TopicAction = (formData: FormData) => Promise<TopicActionResult>

function HiddenContext({ subjectId, groupId }: { subjectId: string; groupId?: string }) {
  return <><input type="hidden" name="current_subject_id" value={subjectId} /><input type="hidden" name="current_group_id" value={groupId ?? ''} /></>
}

function StatusBadge({ active }: { active: boolean }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{active ? 'Active' : 'Inactive'}</span>
}

function PendingLabel({ pending, pendingText, children }: { pending: boolean; pendingText: string; children: ReactNode }) {
  return pending ? <><Loader2 className="size-4 animate-spin" aria-hidden="true" />{pendingText}</> : <>{children}</>
}

function TopicActionForm({ action, className, resetOnSuccess, onSuccess, children }: { action: TopicAction; className?: string; resetOnSuccess?: boolean; onSuccess?: () => void; children: (pending: boolean) => ReactNode }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget
    setPending(true)
    try {
      const result = await action(new FormData(form))
      if (result.ok) {
        toast.success(result.message)
        if (resetOnSuccess) form.reset()
        onSuccess?.()
        router.refresh()
      } else {
        toast.error(result.message || 'Could not update topic. Please try again.')
      }
    } catch {
      toast.error('Could not update topic. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return <form onSubmit={submit} className={className}>{children(pending)}</form>
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

  function selectGroup(groupId: string) {
    setSelectedGroupId(groupId)
    setMergeSourceId('')
    setMergeTargetId('')
  }

  function selectGroupWithKeyboard(event: KeyboardEvent<HTMLElement>, groupId: string) {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    selectGroup(groupId)
  }

  return (
    <div className="space-y-8">
      {(notice || error) ? <p className={`rounded-md border px-4 py-3 font-body text-sm ${error ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error || notice}</p> : null}

      <section className="rounded-md border border-[#c3c6ce66] bg-white p-6">
        <SearchableSelect id="topic-manager-subject" label="Subject" value={subjectId} onChange={updateSubject} placeholder="Choose subject" clearLabel="Clear subject" emptyText="No matching subjects found." options={subjects.map((subject) => ({ value: subject.id, label: subject.name }))} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-md border border-[#c3c6ce66] bg-white p-6">
          <div>
            <p className="font-label text-xs uppercase tracking-[.14em] text-[#735b2b]">Topic groups</p>
            <h2 className="mt-2 font-headline text-3xl text-[#00152a]">Groups</h2>
          </div>
          <TopicActionForm action={createTopic} resetOnSuccess className="mt-5 grid gap-3 rounded-md border border-[#c3c6ce66] bg-[#fbf9f4] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            {(pending) => <>
              <HiddenContext subjectId={subjectId} groupId={activeSelectedGroupId} />
              <input type="hidden" name="subject_id" value={subjectId} />
              <label className="font-body text-sm text-[#43474d]">
                New topic group
                <input name="name" required disabled={pending} placeholder="Topic group name" className="tsm-input mt-1 min-w-0 disabled:opacity-50" />
              </label>
              <button className="tsm-btn-primary w-full sm:w-auto" type="submit" disabled={pending || !subjectId}><PendingLabel pending={pending} pendingText="Adding…">Add group</PendingLabel></button>
            </>}
          </TopicActionForm>

          <div className="mt-6 space-y-3">
            {groups.map((group, index) => {
              const childCount = subjectTopics.filter((topic) => topic.parent_topic_id === group.id).length
              return (
                <article
                  key={group.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select topic group: ${group.name}`}
                  aria-pressed={group.id === activeSelectedGroupId}
                  onClick={() => selectGroup(group.id)}
                  onKeyDown={(event) => selectGroupWithKeyboard(event, group.id)}
                  className={`cursor-pointer rounded-md border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#735b2b]/40 focus-visible:ring-offset-2 ${group.id === activeSelectedGroupId ? 'border-[#d4c39f] bg-[#fbf6ea] shadow-[inset_4px_0_0_#735b2b]' : 'border-[#c3c6ce66] bg-white hover:border-[#d4c39f] hover:bg-[#fbf9f4]'}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <strong className={`min-w-0 flex-1 break-words font-headline text-2xl leading-tight ${group.id === activeSelectedGroupId ? 'text-[#735b2b]' : 'text-[#00152a]'}`} title={group.name}>{group.name}</strong>
                    <StatusBadge active={group.is_active !== false} />
                  </div>
                  <p className="mt-2 font-body text-sm text-[#43474d]">{childCount} subtopic{childCount === 1 ? '' : 's'} · {groupQuestionCount(group.id)} question{groupQuestionCount(group.id) === 1 ? '' : 's'}</p>
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
          <TopicActionForm action={createTopic} resetOnSuccess className="mt-5 grid gap-3 rounded-md border border-[#c3c6ce66] bg-[#fbf9f4] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            {(pending) => <>
              <HiddenContext subjectId={subjectId} groupId={activeSelectedGroupId} />
              <input type="hidden" name="subject_id" value={subjectId} />
              <input type="hidden" name="parent_topic_id" value={activeSelectedGroupId} />
              <label className="font-body text-sm text-[#43474d]">
                New subtopic
                <input name="name" required disabled={pending || !activeSelectedGroupId} placeholder="Subtopic name" className="tsm-input mt-1 min-w-0 disabled:opacity-50" />
              </label>
              <button className="tsm-btn-primary w-full sm:w-auto" type="submit" disabled={pending || !activeSelectedGroupId}><PendingLabel pending={pending} pendingText="Adding…">Add subtopic</PendingLabel></button>
            </>}
          </TopicActionForm>

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
            <TopicActionForm action={mergeSubtopics} onSuccess={() => { setMergeSourceId(''); setMergeTargetId('') }} className="mt-5 space-y-5">
              {(pending) => <>
                <HiddenContext subjectId={subjectId} groupId={activeSelectedGroupId} />
                <input type="hidden" name="source_topic_id" value={mergeSourceId} />
                <input type="hidden" name="target_topic_id" value={mergeTargetId} />
                <div className="grid gap-4 md:grid-cols-2">
                  <SearchableSelect id="merge-source" label="Source subtopic" value={mergeSourceId} onChange={(value) => { setMergeSourceId(value); if (value === mergeTargetId) setMergeTargetId('') }} placeholder="Choose duplicate source" clearLabel="Clear source" emptyText="No source subtopics found." options={mergeOptions.filter((option) => option.value !== mergeTargetId)} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
                  <SearchableSelect id="merge-target" label="Target subtopic" value={mergeTargetId} onChange={(value) => { setMergeTargetId(value); if (value === mergeSourceId) setMergeSourceId('') }} placeholder="Choose official target" clearLabel="Clear target" emptyText="No target subtopics found." options={mergeOptions.filter((option) => option.value !== mergeSourceId)} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
                </div>
                <button className="tsm-btn-primary w-full sm:w-auto" type="submit" disabled={pending || !mergeSourceId || !mergeTargetId}><PendingLabel pending={pending} pendingText="Merging…">Confirm merge</PendingLabel></button>
              </>}
            </TopicActionForm>
          </div>
        </section>
      </div>
    </div>
  )
}

function TopicActions({ topic, subjectId, groupId, index, lastIndex }: { topic: Topic; subjectId: string; groupId: string; index: number; lastIndex: number }) {
  const [isRenaming, setIsRenaming] = useState(false)
  const isInactive = topic.is_active === false
  const isSubtopic = Boolean(topic.parent_topic_id)
  const stopCardSelection = (event: MouseEvent<HTMLElement>) => event.stopPropagation()

  return (
    <div className="mt-4 space-y-4 border-t border-[#c3c6ce66] pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="tsm-btn-secondary px-3 py-2" type="button" onClick={(event) => { event.stopPropagation(); setIsRenaming(true) }}>Rename</button>
        <TopicActionForm action={reorderTopic}>
          {(pending) => <>
            <HiddenContext subjectId={subjectId} groupId={groupId} />
            <input type="hidden" name="topic_id" value={topic.id} />
            <input type="hidden" name="direction" value="up" />
            <button className="tsm-btn-secondary px-3 py-2" disabled={pending || index === 0} type="submit" aria-label={`Move ${topic.name} up`} title="Move up" onClick={stopCardSelection}><PendingLabel pending={pending} pendingText="Updating…"><ChevronUp className="size-4" aria-hidden="true" />Up</PendingLabel></button>
          </>}
        </TopicActionForm>
        <TopicActionForm action={reorderTopic}>
          {(pending) => <>
            <HiddenContext subjectId={subjectId} groupId={groupId} />
            <input type="hidden" name="topic_id" value={topic.id} />
            <input type="hidden" name="direction" value="down" />
            <button className="tsm-btn-secondary px-3 py-2" disabled={pending || index === lastIndex} type="submit" aria-label={`Move ${topic.name} down`} title="Move down" onClick={stopCardSelection}><PendingLabel pending={pending} pendingText="Updating…"><ChevronDown className="size-4" aria-hidden="true" />Down</PendingLabel></button>
          </>}
        </TopicActionForm>
        <TopicActionForm action={toggleTopicActive}>
          {(pending) => <>
            <HiddenContext subjectId={subjectId} groupId={groupId} />
            <input type="hidden" name="topic_id" value={topic.id} />
            <input type="hidden" name="next_active" value={isInactive ? 'true' : 'false'} />
            <button className={`${isInactive ? 'tsm-btn-primary' : 'tsm-btn-secondary'} px-3 py-2`} type="submit" disabled={pending} onClick={stopCardSelection}><PendingLabel pending={pending} pendingText="Updating…">{isInactive ? 'Reactivate' : 'Deactivate'}</PendingLabel></button>
          </>}
        </TopicActionForm>
      </div>

      {isRenaming ? (
        <TopicActionForm action={renameTopic} onSuccess={() => setIsRenaming(false)} className="grid gap-3 rounded-md border border-[#c3c6ce66] bg-white/70 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
          {(pending) => <>
            <HiddenContext subjectId={subjectId} groupId={groupId} />
            <input type="hidden" name="topic_id" value={topic.id} />
            <label className="font-body text-sm text-[#43474d]" onClick={stopCardSelection}>
              Rename {isSubtopic ? 'subtopic' : 'group'}
              <input name="name" required disabled={pending} defaultValue={topic.name} className="tsm-input mt-1 min-w-0 disabled:opacity-50" aria-label={`Rename ${topic.name}`} onClick={stopCardSelection} />
            </label>
            <button className="tsm-btn-primary w-full sm:w-auto" type="submit" disabled={pending} onClick={stopCardSelection}><PendingLabel pending={pending} pendingText="Saving…">Save</PendingLabel></button>
            <button className="tsm-btn-secondary w-full sm:w-auto" type="button" disabled={pending} onClick={(event) => { event.stopPropagation(); setIsRenaming(false) }}>Cancel</button>
          </>}
        </TopicActionForm>
      ) : null}
    </div>
  )
}

function sortTopics(a: Topic, b: Topic) {
  return (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)
}
