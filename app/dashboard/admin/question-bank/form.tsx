"use client"

import Image from 'next/image'
import Link from 'next/link'
import { DragEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { createQuestion, updateQuestion } from './actions'

type PaperRelation<T> = T | T[] | null
type Paper = { id: string; title: string; year: number; level: string | null; subjects?: PaperRelation<{ id?: string | null; name?: string | null }>; exam_sessions?: PaperRelation<{ session_month?: string | null }> }
type Subject = { id: string; name: string }
type Topic = { id: string; name: string; subject_id?: string | null; parent_topic_id?: string | null; level?: string | null; sort_order?: number | null; is_active?: boolean | null }
type QuestionTopic = { topic_id: string; is_primary?: boolean | null }
type QuestionAsset = { id: string; asset_type: 'question' | 'markscheme'; storage_path: string | null; public_url: string | null; label: string | null; sort_order: number | null; preview_url?: string | null }
type Question = {
  id: string
  paper_id: string
  question_number: string
  question_order: number | null
  marks: number | null
  prompt_text: string | null
  markscheme_text: string | null
  image_url: string | null
  markscheme_image_url: string | null
  question_image_path: string | null
  markscheme_image_path: string | null
  is_published: boolean
  is_reviewed: boolean
  question_topics?: QuestionTopic[] | null
}

type StepState = 'complete' | 'current' | 'locked' | 'missing'
type LocalPreview = { id: string; file: File; name: string; url: string }
type SelectOption = { value: string; label: string; helper?: string }
type PreviewItem = { token: string; title: string; url: string; subtitle?: string; canRemove?: boolean }
type LightboxState = { group: 'question' | 'markscheme'; index: number } | null

function relationLabel(relation: unknown, key: 'id' | 'name' | 'session_month') {
  const item = Array.isArray(relation) ? relation[0] : relation
  return (item as Record<string, string | null | undefined> | null | undefined)?.[key] || ''
}

function paperLabel(paper: Paper) {
  const rawSession = relationLabel(paper.exam_sessions, 'session_month') || 'Session'
  const session = rawSession.toLowerCase().startsWith('nov') ? 'Nov' : rawSession.toLowerCase().startsWith('may') ? 'May' : rawSession
  return `${paper.title} — ${session} ${paper.year}`
}

function topicMatchesMainScope(topic: Topic, subjectId: string) {
  return topic.is_active !== false && Boolean(subjectId) && topic.subject_id === subjectId
}

function topicMatchesLegacyScope(topic: Topic, subjectId: string) {
  return topic.is_active !== false && topic.subject_id !== subjectId
}

function statusBadgeClasses(state: StepState) {
  if (state === 'complete') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (state === 'current') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (state === 'missing') return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-slate-200 bg-slate-100 text-slate-500'
}

function StepCard({ step, title, state, helper, children }: { step: number; title: string; state: StepState; helper: string; children: ReactNode }) {
  const locked = state === 'locked'
  const border = state === 'complete' ? 'border-emerald-300' : state === 'current' ? 'border-blue-300 shadow-sm' : state === 'missing' ? 'border-amber-300' : 'border-[#c3c6ce66] opacity-75'
  const label = state === 'complete' ? 'Complete' : state === 'current' ? 'Current step' : state === 'missing' ? 'Needs attention' : 'Locked'

  return (
    <section className={`rounded-md border bg-white p-6 ${border}`} data-disabled={locked ? 'true' : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-label text-xs uppercase tracking-[.16em] text-[#735b2b]">Step {step}</p>
          <h2 className="font-headline text-2xl text-[#00152a]">{title}</h2>
          <p className="mt-1 font-body text-sm text-[#43474d]">{helper}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 font-body text-xs font-semibold ${statusBadgeClasses(state)}`}>{state === 'complete' ? '✓ ' : ''}{label}</span>
      </div>
      {locked ? <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 font-body text-sm text-slate-600">Complete the earlier step to unlock this section.</p> : null}
      <div className={locked ? 'pointer-events-none mt-5 opacity-50' : 'mt-5'}>{children}</div>
    </section>
  )
}

function ChoiceCard({ active, title, helper, onClick }: { active: boolean; title: string; helper: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`cursor-pointer rounded-md border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-300 ${active ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-[#c3c6ce66] bg-white hover:border-blue-300 hover:bg-blue-50/40'}`}>
      <span className={`inline-flex rounded-full px-2 py-1 font-body text-xs font-semibold ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{active ? 'Selected' : 'Choose'}</span>
      <h3 className="mt-3 font-headline text-xl text-[#00152a]">{title}</h3>
      <p className="mt-1 font-body text-sm text-[#43474d]">{helper}</p>
    </button>
  )
}

function SearchableSelect({ id, name, label, value, options, placeholder, emptyText, onChange, required }: { id: string; name?: string; label: string; value: string; options: SelectOption[]; placeholder: string; emptyText: string; onChange: (value: string) => void; required?: boolean }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const selected = options.find((option) => option.value === value)
  const filtered = options.filter((option) => `${option.label} ${option.helper ?? ''}`.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    if (open) setActiveIndex(0)
  }, [open, query])

  function choose(nextValue: string) {
    onChange(nextValue)
    setOpen(false)
    setQuery('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((current) => {
        const next = event.key === 'ArrowDown' ? current + 1 : current - 1
        return Math.max(0, Math.min(filtered.length - 1, next))
      })
    }
    if (event.key === 'Enter' && open && filtered[activeIndex]) {
      event.preventDefault()
      choose(filtered[activeIndex].value)
    }
    if (event.key === 'Escape') setOpen(false)
  }

  return (
    <div className="relative font-body text-sm text-[#43474d]">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <label id={`${id}-label`} className="block">{label}</label>
      <button id={id} type="button" aria-labelledby={`${id}-label`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} onKeyDown={handleKeyDown} className="tsm-input mt-1 flex w-full cursor-pointer items-center justify-between gap-3 text-left">
        <span className={selected ? 'text-[#00152a]' : 'text-[#6f737b]'}>{selected?.label || placeholder}</span>
        <span className="text-[#735b2b]" aria-hidden="true">⌄</span>
      </button>
      {required && !value ? <span className="sr-only">Required</span> : null}
      {open ? (
        <div className="absolute z-30 mt-2 w-full rounded-md border border-[#c3c6ce66] bg-white p-2 shadow-lg">
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." className="tsm-input mb-2 w-full" />
          <div role="listbox" aria-labelledby={`${id}-label`} className="max-h-64 overflow-y-auto">
            {filtered.map((option, index) => (
              <button key={option.value} type="button" role="option" aria-selected={option.value === value} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option.value)} className={`block w-full rounded-sm px-3 py-2 text-left transition ${option.value === value ? 'bg-blue-600 text-white' : index === activeIndex ? 'bg-blue-50 text-[#00152a]' : 'text-[#00152a] hover:bg-blue-50'}`}>
                <span className="block font-semibold">{option.label}</span>
                {option.helper ? <span className={`block text-xs ${option.value === value ? 'text-blue-50' : 'text-[#6f737b]'}`}>{option.helper}</span> : null}
              </button>
            ))}
            {!filtered.length ? <p className="px-3 py-4 text-sm text-[#6f737b]">{emptyText}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function filesToPreviews(files: File[]) {
  return files.map((file) => ({ id: crypto.randomUUID(), file, name: file.name, url: URL.createObjectURL(file) }))
}

function moveToken(tokens: string[], token: string, direction: -1 | 1) {
  const index = tokens.indexOf(token)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= tokens.length) return tokens
  const next = [...tokens]
  const [item] = next.splice(index, 1)
  next.splice(nextIndex, 0, item)
  return next
}

function ImageUploadGroup({ title, name, fileKeyName, assetOrderName, existingAssets, fallbackUrl, fallbackTitle, files, setFiles, order, setOrder, onPreview }: { title: string; name: string; fileKeyName: string; assetOrderName: string; existingAssets: QuestionAsset[]; fallbackUrl?: string | null; fallbackTitle: string; files: LocalPreview[]; setFiles: (files: LocalPreview[]) => void; order: string[]; setOrder: (order: string[]) => void; onPreview: (index: number) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const existingTokens = existingAssets.map((asset) => `existing:${asset.id}`)
  const fileTokens = files.map((file) => `new:${file.id}`)
  const itemsByToken = new Map<string, PreviewItem>()

  existingAssets.forEach((asset, index) => {
    if (asset.preview_url) {
      itemsByToken.set(`existing:${asset.id}`, { token: `existing:${asset.id}`, title: asset.label || `${title} ${index + 1}`, url: asset.preview_url, subtitle: asset.storage_path || asset.public_url || undefined })
    }
  })
  files.forEach((file, index) => {
    itemsByToken.set(`new:${file.id}`, { token: `new:${file.id}`, title: `New ${title.toLowerCase()} ${index + 1}`, url: file.url, subtitle: file.name, canRemove: true })
  })

  const normalizedOrder = [...order.filter((token) => itemsByToken.has(token)), ...[...existingTokens, ...fileTokens].filter((token) => !order.includes(token) && itemsByToken.has(token))]
  const orderedItems = normalizedOrder.map((token) => itemsByToken.get(token)).filter((item): item is PreviewItem => Boolean(item))

  useEffect(() => {
    const dataTransfer = new DataTransfer()
    files.forEach((file) => dataTransfer.items.add(file.file))
    if (inputRef.current) inputRef.current.files = dataTransfer.files
  }, [files])

  function addFiles(nextFiles: File[]) {
    const imageFiles = nextFiles.filter((file) => file.type.startsWith('image/'))
    if (!imageFiles.length) return
    const previews = filesToPreviews(imageFiles)
    setFiles([...files, ...previews])
    setOrder([...normalizedOrder, ...previews.map((file) => `new:${file.id}`)])
  }

  function removeFile(token: string) {
    const id = token.replace('new:', '')
    const nextFiles = files.filter((file) => file.id !== id)
    const removed = files.find((file) => file.id === id)
    if (removed) URL.revokeObjectURL(removed.url)
    setFiles(nextFiles)
    setOrder(normalizedOrder.filter((item) => item !== token))
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    addFiles(Array.from(event.dataTransfer.files))
  }

  return (
    <div>
      <label htmlFor={`${name}-input`} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop} className="block cursor-pointer rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/50 p-5 text-center font-body text-sm text-[#43474d] transition hover:border-blue-400 hover:bg-blue-50 focus-within:ring-2 focus-within:ring-blue-300">
        <span className="block font-semibold text-[#00152a]">{title}</span>
        <span className="mt-2 block text-base font-semibold text-blue-800">Drag images here or click to upload</span>
        <span className="mt-1 block">Use multiple images if the question spans prompt, table, graph, or continuation.</span>
        <input ref={inputRef} id={`${name}-input`} name={name} type="file" accept="image/*" multiple className="sr-only" onChange={(event) => addFiles(Array.from(event.target.files ?? []))} />
      </label>
      {files.map((file) => <input key={file.id} type="hidden" name={fileKeyName} value={file.id} />)}
      {normalizedOrder.map((token) => <input key={token} type="hidden" name={assetOrderName} value={token} />)}
      <div className="mt-3 space-y-2">
        {orderedItems.map((item, index) => (
          <div key={item.token} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', item.token)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const dragged = event.dataTransfer.getData('text/plain'); const next = normalizedOrder.filter((token) => token !== dragged); next.splice(index, 0, dragged); setOrder(next) }} className="flex items-center gap-3 rounded-md border border-[#c3c6ce66] bg-white p-2">
            <button type="button" className="cursor-grab rounded-sm px-2 py-1 text-[#735b2b]" aria-label={`Drag to reorder ${item.title}`}>☰</button>
            <button type="button" onClick={() => onPreview(index)} className="shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-300">
              <Image src={item.url} alt={item.title} width={88} height={64} unoptimized className="h-16 w-22 rounded-sm border border-[#f0eee9] bg-[#f8f6f1] object-cover" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-body text-sm font-semibold text-[#00152a]">{title} {index + 1}</p>
              {item.subtitle ? <p className="truncate font-body text-xs text-[#6f737b]">{item.subtitle}</p> : null}
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              <button type="button" onClick={() => onPreview(index)} className="rounded-sm border border-blue-200 px-2 py-1 font-body text-xs font-semibold text-blue-700 hover:bg-blue-50">Preview</button>
              <button type="button" onClick={() => setOrder(moveToken(normalizedOrder, item.token, -1))} disabled={index === 0} className="rounded-sm border border-slate-200 px-2 py-1 font-body text-xs font-semibold text-slate-600 disabled:opacity-40">Up</button>
              <button type="button" onClick={() => setOrder(moveToken(normalizedOrder, item.token, 1))} disabled={index === orderedItems.length - 1} className="rounded-sm border border-slate-200 px-2 py-1 font-body text-xs font-semibold text-slate-600 disabled:opacity-40">Down</button>
              {item.canRemove ? <button type="button" onClick={() => removeFile(item.token)} className="rounded-sm border border-red-200 px-2 py-1 font-body text-xs font-semibold text-red-700 hover:bg-red-50">Remove</button> : null}
            </div>
          </div>
        ))}
        {!orderedItems.length && fallbackUrl ? (
          <button type="button" onClick={() => onPreview(0)} className="flex w-full items-center gap-3 rounded-md border border-[#c3c6ce66] bg-white p-2 text-left">
            <Image src={fallbackUrl} alt={fallbackTitle} width={88} height={64} unoptimized className="h-16 w-22 rounded-sm border border-[#f0eee9] object-cover" />
            <span className="font-body text-sm font-semibold text-[#00152a]">{fallbackTitle}</span>
          </button>
        ) : null}
        {!orderedItems.length && !fallbackUrl ? <p className="rounded-md border border-dashed border-slate-200 p-4 font-body text-sm text-slate-500">No images selected yet.</p> : null}
      </div>
    </div>
  )
}

function Lightbox({ state, questionItems, markschemeItems, onClose, onMove }: { state: LightboxState; questionItems: PreviewItem[]; markschemeItems: PreviewItem[]; onClose: () => void; onMove: (index: number) => void }) {
  const items = state?.group === 'question' ? questionItems : markschemeItems
  const item = state ? items[state.index] : null

  useEffect(() => {
    function closeOnEsc(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    if (state) window.addEventListener('keydown', closeOnEsc)
    return () => window.removeEventListener('keydown', closeOnEsc)
  }, [state, onClose])

  if (!state || !item) return null
  const label = state.group === 'question' ? 'Question image' : 'Mark scheme image'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label={`${label} preview`}>
      <div className="max-h-[92vh] w-full max-w-5xl rounded-lg bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-body text-sm font-semibold text-[#735b2b]">{label} {state.index + 1} of {items.length}</p>
            <h3 className="font-headline text-2xl text-[#00152a]">{item.subtitle || item.title}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-3 py-2 font-body text-sm font-semibold text-slate-700 hover:bg-slate-50">Close</button>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => onMove((state.index - 1 + items.length) % items.length)} disabled={items.length < 2} className="rounded-md border border-slate-200 px-3 py-2 font-body text-sm font-semibold disabled:opacity-40">Previous</button>
          <div className="flex min-h-[55vh] flex-1 items-center justify-center rounded-md bg-[#f8f6f1] p-2">
            <Image src={item.url} alt={item.title} width={1400} height={900} unoptimized className="max-h-[70vh] w-auto max-w-full object-contain" />
          </div>
          <button type="button" onClick={() => onMove((state.index + 1) % items.length)} disabled={items.length < 2} className="rounded-md border border-slate-200 px-3 py-2 font-body text-sm font-semibold disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  )
}

function orderedPreviewItems(assets: QuestionAsset[], files: LocalPreview[], order: string[], label: string, fallbackUrl?: string | null, fallbackTitle?: string): PreviewItem[] {
  const map = new Map<string, PreviewItem>()
  assets.forEach((asset, index) => {
    if (asset.preview_url) map.set(`existing:${asset.id}`, { token: `existing:${asset.id}`, title: asset.label || `${label} ${index + 1}`, url: asset.preview_url, subtitle: asset.storage_path || asset.public_url || undefined })
  })
  files.forEach((file, index) => map.set(`new:${file.id}`, { token: `new:${file.id}`, title: `New ${label.toLowerCase()} ${index + 1}`, url: file.url, subtitle: file.name }))
  const tokens = [...order.filter((token) => map.has(token)), ...[...map.keys()].filter((token) => !order.includes(token))]
  const items = tokens.map((token) => map.get(token)).filter((item): item is PreviewItem => Boolean(item))
  if (!items.length && fallbackUrl) return [{ token: 'fallback', title: fallbackTitle || label, url: fallbackUrl }]
  return items
}

export function QuestionBankForm({
  mode,
  papers,
  subjects,
  topics,
  question,
  questionPreviewUrl,
  markschemePreviewUrl,
  questionAssets = [],
}: {
  mode: 'new' | 'edit'
  papers: Paper[]
  subjects: Subject[]
  topics: Topic[]
  question?: Question | null
  questionPreviewUrl?: string | null
  markschemePreviewUrl?: string | null
  questionAssets?: QuestionAsset[]
}) {
  const currentPaper = papers.find((paper) => paper.id === question?.paper_id)
  const defaultSubjectId = relationLabel(currentPaper?.subjects, 'id') || subjects.find((subject) => subject.name === 'Mathematics Extended')?.id || subjects.find((subject) => subject.name === 'Mathematics')?.id || subjects[0]?.id || ''
  const selectedTopics = useMemo(() => new Set(question?.question_topics?.map((row) => row.topic_id) ?? []), [question])
  const primaryTopicIdFromQuestion = question?.question_topics?.find((row) => row.is_primary)?.topic_id || ''
  const primaryTopic = topics.find((topic) => topic.id === primaryTopicIdFromQuestion)
  const initialTopicGroupId = primaryTopic?.parent_topic_id || primaryTopic?.id || ''
  const action = mode === 'new' ? createQuestion : updateQuestion

  const [paperMode, setPaperMode] = useState<'existing' | 'new'>(question?.paper_id ? 'existing' : 'existing')
  const [subjectId, setSubjectId] = useState(defaultSubjectId)
  const [paperId, setPaperId] = useState(question?.paper_id || '')
  const selectedSubjectName = subjects.find((subject) => subject.id === subjectId)?.name || ''
  const [newPaperTitle, setNewPaperTitle] = useState('')
  const [newPaperYear, setNewPaperYear] = useState('2025')
  const [newPaperSession, setNewPaperSession] = useState('May')
  const [questionNumber, setQuestionNumber] = useState(question?.question_number || '')
  const [topicGroupId, setTopicGroupId] = useState(initialTopicGroupId)
  const [selectedSubtopicIds, setSelectedSubtopicIds] = useState(() => Array.from(selectedTopics).filter((topicId) => topics.find((topic) => topic.id === topicId)?.parent_topic_id === initialTopicGroupId))
  const [primaryTopicId, setPrimaryTopicId] = useState(primaryTopicIdFromQuestion)
  const [published, setPublished] = useState(question?.is_published ?? false)
  const [reviewed, setReviewed] = useState(question?.is_reviewed ?? false)
  const [questionFiles, setQuestionFiles] = useState<LocalPreview[]>([])
  const [markschemeFiles, setMarkschemeFiles] = useState<LocalPreview[]>([])
  const existingQuestionAssets = questionAssets.filter((asset) => asset.asset_type === 'question')
  const existingMarkschemeAssets = questionAssets.filter((asset) => asset.asset_type === 'markscheme')
  const [questionOrder, setQuestionOrder] = useState(existingQuestionAssets.map((asset) => `existing:${asset.id}`))
  const [markschemeOrder, setMarkschemeOrder] = useState(existingMarkschemeAssets.map((asset) => `existing:${asset.id}`))
  const [lightbox, setLightbox] = useState<LightboxState>(null)

  useEffect(() => () => {
    questionFiles.forEach((file) => URL.revokeObjectURL(file.url))
  }, [questionFiles])

  useEffect(() => () => {
    markschemeFiles.forEach((file) => URL.revokeObjectURL(file.url))
  }, [markschemeFiles])

  useEffect(() => {
    if (selectedSubtopicIds.length === 1) setPrimaryTopicId(selectedSubtopicIds[0])
    if (selectedSubtopicIds.length > 1 && !selectedSubtopicIds.includes(primaryTopicId)) setPrimaryTopicId(selectedSubtopicIds[0])
  }, [selectedSubtopicIds, primaryTopicId])

  function updateSubject(value: string) {
    setSubjectId(value)
    setPaperId('')
    setTopicGroupId('')
    setSelectedSubtopicIds([])
    setPrimaryTopicId('')
  }

  const filteredPapers = papers.filter((paper) => {
    const paperSubjectId = relationLabel(paper.subjects, 'id')
    return !subjectId || paperSubjectId === subjectId
  })

  const mainTopicGroups = useMemo(() => topics
    .filter((topic) => !topic.parent_topic_id && topicMatchesMainScope(topic, subjectId))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)), [topics, subjectId])

  const subtopics = useMemo(() => topics
    .filter((topic) => topic.parent_topic_id === topicGroupId && topicMatchesMainScope(topic, subjectId))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)), [topics, topicGroupId, subjectId])

  const legacyTopics = useMemo(() => topics
    .filter((topic) => !selectedSubtopicIds.includes(topic.id) && topic.id !== topicGroupId && topicMatchesLegacyScope(topic, subjectId))
    .sort((a, b) => a.name.localeCompare(b.name)), [topics, selectedSubtopicIds, topicGroupId, subjectId])

  const questionLightboxItems = orderedPreviewItems(existingQuestionAssets, questionFiles, questionOrder, 'Question image', questionPreviewUrl, 'Question image 1')
  const markschemeLightboxItems = orderedPreviewItems(existingMarkschemeAssets, markschemeFiles, markschemeOrder, 'Mark scheme image', markschemePreviewUrl, 'Mark scheme image 1')
  const hasExistingQuestionImage = Boolean(questionPreviewUrl || existingQuestionAssets.length)
  const hasQuestionImage = hasExistingQuestionImage || questionFiles.length > 0
  const step1Complete = paperMode === 'existing' ? Boolean(subjectId && paperId) : Boolean(subjectId && newPaperTitle && newPaperYear && newPaperSession)
  const step2Complete = Boolean(questionNumber.trim())
  const step3Complete = hasQuestionImage
  const step4Complete = Boolean(topicGroupId && (selectedSubtopicIds.length || !subtopics.length))
  const readyToSubmit = step1Complete && step2Complete && step3Complete && step4Complete
  const effectivePrimaryTopicId = selectedSubtopicIds.includes(primaryTopicId) ? primaryTopicId : selectedSubtopicIds[0] || topicGroupId

  const step1State: StepState = step1Complete ? 'complete' : 'current'
  const step2State: StepState = !step1Complete ? 'locked' : step2Complete ? 'complete' : 'current'
  const step3State: StepState = !step1Complete || !step2Complete ? 'locked' : step3Complete ? 'complete' : 'missing'
  const step4State: StepState = !step1Complete || !step2Complete || !step3Complete ? 'locked' : step4Complete ? 'complete' : 'current'

  return (
    <form action={action} className="space-y-8" onSubmit={(event) => { if (!readyToSubmit) event.preventDefault() }}>
      {question ? <input type="hidden" name="question_id" value={question.id} /> : null}
      <input type="hidden" name="paper_id" value={paperMode === 'existing' ? paperId : ''} />
      <input type="hidden" name="primary_topic_id" value={effectivePrimaryTopicId} />
      <input type="hidden" name="topic_group_id" value={topicGroupId} />
      <input type="hidden" name="new_paper_level" value={selectedSubjectName} />
      {selectedSubtopicIds.length ? selectedSubtopicIds.map((topicId) => <input key={topicId} type="hidden" name="topic_ids" value={topicId} />) : topicGroupId ? <input type="hidden" name="topic_ids" value={topicGroupId} /> : null}

      <StepCard step={1} title="Paper setup" state={step1State} helper="Choose whether this question belongs to an existing paper or a new paper record.">
        <div className="grid gap-4 md:grid-cols-2">
          <ChoiceCard active={paperMode === 'existing'} title="Add to existing paper" helper="Pick a subject, then choose one matching paper." onClick={() => setPaperMode('existing')} />
          <ChoiceCard active={paperMode === 'new'} title="Create new paper" helper="Create a simple paper record first, then attach this question." onClick={() => { setPaperMode('new'); setPaperId('') }} />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <SearchableSelect id="admin-question-subject" name="new_paper_subject_id" label="Subject" value={subjectId} onChange={updateSubject} placeholder="Choose subject" emptyText="No matching subjects found." options={subjects.map((subject) => ({ value: subject.id, label: subject.name }))} required />
        </div>
        {paperMode === 'existing' ? (
          <div className="mt-5 rounded-md border border-blue-100 bg-blue-50/40 p-4">
            <SearchableSelect id="admin-question-paper" label="Matching existing paper" value={paperId} onChange={setPaperId} placeholder="Choose a paper" emptyText="No matching papers found." options={filteredPapers.map((paper) => ({ value: paper.id, label: paperLabel(paper), helper: paper.level || undefined }))} />
            {!filteredPapers.length ? <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 font-body text-sm text-amber-800">No papers found for this subject. Create a new paper first. <button type="button" className="cursor-pointer font-semibold underline" onClick={() => setPaperMode('new')}>Create a new paper instead.</button></div> : null}
          </div>
        ) : (
          <div className="mt-5 rounded-md border border-blue-100 bg-blue-50/40 p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <label htmlFor="admin-question-new-paper-year" className="font-body text-sm text-[#43474d]">Year<input id="admin-question-new-paper-year" name="new_paper_year" type="number" min="2016" max="2030" className="tsm-input mt-1 w-full" value={newPaperYear} onChange={(event) => setNewPaperYear(event.target.value)} /></label>
              <SearchableSelect id="admin-question-new-paper-session" name="new_paper_session" label="Session" value={newPaperSession} onChange={setNewPaperSession} placeholder="Choose session" emptyText="No matching sessions found." options={[{ value: 'May', label: 'May' }, { value: 'November', label: 'November' }]} />
              <label htmlFor="admin-question-new-paper-title" className="font-body text-sm text-[#43474d]">Paper title/code<input id="admin-question-new-paper-title" name="new_paper_title" className="tsm-input mt-1 w-full" value={newPaperTitle} onChange={(event) => setNewPaperTitle(event.target.value)} placeholder="M25 Maths Extended" /></label>
            </div>
            <details className="mt-4 rounded-sm border border-[#c3c6ce66] bg-white p-4">
              <summary className="cursor-pointer font-body font-semibold text-[#735b2b]">Advanced paper options</summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label htmlFor="admin-question-source-pdf" className="font-body text-sm text-[#43474d]">Source PDF path<input id="admin-question-source-pdf" name="new_paper_source_pdf_path" className="tsm-input mt-1 w-full" placeholder="optional private path" /></label>
                <label htmlFor="admin-question-markscheme-pdf" className="font-body text-sm text-[#43474d]">Mark scheme PDF path<input id="admin-question-markscheme-pdf" name="new_paper_markscheme_pdf_path" className="tsm-input mt-1 w-full" placeholder="optional private path" /></label>
                <label htmlFor="admin-question-new-paper-published" className="flex cursor-pointer items-center gap-2 font-body text-sm text-[#43474d]"><input id="admin-question-new-paper-published" type="checkbox" name="new_paper_is_published" defaultChecked /> Show paper to students</label>
              </div>
            </details>
          </div>
        )}
      </StepCard>

      <StepCard step={2} title="Question details" state={step2State} helper="Add the simple labels students and admins use to find this question.">
        <div className="grid gap-4 md:grid-cols-3">
          <label htmlFor="admin-question-number" className="font-body text-sm text-[#43474d]">Question number<input id="admin-question-number" name="question_number" required className="tsm-input mt-1 w-full" value={questionNumber} onChange={(event) => setQuestionNumber(event.target.value)} placeholder="1a" /><span className="mt-1 block text-xs text-[#6f737b]">Use the number students see in the paper, for example 1a or 3(b).</span></label>
          <label htmlFor="admin-question-marks" className="font-body text-sm text-[#43474d]">Marks<input id="admin-question-marks" name="marks" type="number" min="0" className="tsm-input mt-1 w-full" defaultValue={question?.marks ?? ''} /></label>
          <label htmlFor="admin-question-order" className="font-body text-sm text-[#43474d]">Display order<input id="admin-question-order" name="question_order" type="number" className="tsm-input mt-1 w-full" defaultValue={question?.question_order ?? ''} placeholder="Optional" /><span className="mt-1 block text-xs text-[#6f737b]">Display order controls where it appears within the paper.</span></label>
        </div>
      </StepCard>

      <StepCard step={3} title="Images" state={step3State} helper="Upload one or more question crops, plus any matching mark scheme images.">
        {!hasQuestionImage ? <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 font-body text-sm text-amber-800">At least one question image is required before topics and publishing unlock.</p> : null}
        <div className="grid gap-5 md:grid-cols-2">
          <ImageUploadGroup title="Question image" name="question_image_file" fileKeyName="question_file_key" assetOrderName="question_asset_order" existingAssets={existingQuestionAssets} fallbackUrl={existingQuestionAssets.length ? null : questionPreviewUrl} fallbackTitle="Question image 1" files={questionFiles} setFiles={setQuestionFiles} order={questionOrder} setOrder={setQuestionOrder} onPreview={(index) => setLightbox({ group: 'question', index })} />
          <ImageUploadGroup title="Mark scheme image" name="markscheme_image_file" fileKeyName="markscheme_file_key" assetOrderName="markscheme_asset_order" existingAssets={existingMarkschemeAssets} fallbackUrl={existingMarkschemeAssets.length ? null : markschemePreviewUrl} fallbackTitle="Mark scheme image 1" files={markschemeFiles} setFiles={setMarkschemeFiles} order={markschemeOrder} setOrder={setMarkschemeOrder} onPreview={(index) => setLightbox({ group: 'markscheme', index })} />
        </div>
        <details className="mt-5 rounded-sm bg-[#f5f3ee] p-4">
          <summary className="cursor-pointer font-body font-semibold text-[#735b2b]">Advanced image and text options</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label htmlFor="admin-question-image-path" className="font-body text-sm text-[#43474d]">Direct question image path<input id="admin-question-image-path" name="question_image_path" className="tsm-input mt-1 w-full" defaultValue={question?.question_image_path || ''} placeholder="questions/file.png" /></label>
            <label htmlFor="admin-question-markscheme-path" className="font-body text-sm text-[#43474d]">Direct mark scheme image path<input id="admin-question-markscheme-path" name="markscheme_image_path" className="tsm-input mt-1 w-full" defaultValue={question?.markscheme_image_path || ''} placeholder="markschemes/file.png" /></label>
            <label htmlFor="admin-question-image-url" className="font-body text-sm text-[#43474d]">Fallback public question image URL<input id="admin-question-image-url" name="image_url" className="tsm-input mt-1 w-full" defaultValue={question?.image_url || ''} /></label>
            <label htmlFor="admin-question-markscheme-url" className="font-body text-sm text-[#43474d]">Fallback public mark scheme image URL<input id="admin-question-markscheme-url" name="markscheme_image_url" className="tsm-input mt-1 w-full" defaultValue={question?.markscheme_image_url || ''} /></label>
            <label htmlFor="admin-question-prompt-text" className="md:col-span-2 font-body text-sm text-[#43474d]">Question placeholder text<textarea id="admin-question-prompt-text" name="prompt_text" className="tsm-input mt-1 min-h-24 w-full" defaultValue={question?.prompt_text || ''} placeholder="Use only if there is no image yet." /></label>
            <label htmlFor="admin-question-markscheme-text" className="md:col-span-2 font-body text-sm text-[#43474d]">Mark scheme placeholder text<textarea id="admin-question-markscheme-text" name="markscheme_text" className="tsm-input mt-1 min-h-24 w-full" defaultValue={question?.markscheme_text || ''} /></label>
          </div>
        </details>
      </StepCard>

      <StepCard step={4} title="Topics & publish" state={step4State} helper="Choose a topic group, then one or more exact subtopics. Publish only when checked.">
        <div className="grid gap-4 md:grid-cols-2">
          <SearchableSelect id="admin-question-topic-group" label="Topic group" value={topicGroupId} onChange={(value) => { setTopicGroupId(value); setSelectedSubtopicIds([]); setPrimaryTopicId('') }} placeholder="Choose topic group" emptyText="No matching topic groups found." options={mainTopicGroups.map((topic) => ({ value: topic.id, label: topic.name }))} />
          <SearchableSelect id="admin-question-primary-topic" label="Add exact subtopic" value="" onChange={(value) => { if (value && !selectedSubtopicIds.includes(value)) setSelectedSubtopicIds([...selectedSubtopicIds, value]) }} placeholder={topicGroupId ? 'Search subtopics to add' : 'Choose a topic group first'} emptyText="No matching subtopics found." options={subtopics.filter((topic) => !selectedSubtopicIds.includes(topic.id)).map((topic) => ({ value: topic.id, label: topic.name }))} />
        </div>
        <p className="mt-3 font-body text-sm text-[#43474d]">Need a new subtopic? Ask the topic manager/admin to add it first.</p>
        <div className="mt-4 rounded-md border border-[#c3c6ce66] bg-[#fbf9f4] p-4">
          <h3 className="font-body text-sm font-semibold text-[#00152a]">Selected subtopics</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedSubtopicIds.map((topicId) => {
              const topic = topics.find((item) => item.id === topicId)
              const primary = effectivePrimaryTopicId === topicId
              return (
                <span key={topicId} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-body text-sm ${primary ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-[#43474d]'}`}>
                  {topic?.name || 'Selected subtopic'}
                  {primary ? <strong className="text-xs">Primary</strong> : <button type="button" onClick={() => setPrimaryTopicId(topicId)} className="text-xs font-semibold text-blue-700 underline">Make primary</button>}
                  <button type="button" onClick={() => setSelectedSubtopicIds(selectedSubtopicIds.filter((id) => id !== topicId))} className="text-xs font-semibold text-red-700">Remove</button>
                </span>
              )
            })}
            {!selectedSubtopicIds.length ? <p className="font-body text-sm text-[#6f737b]">No exact subtopics selected yet.</p> : null}
          </div>
        </div>
        {!mainTopicGroups.length ? <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 font-body text-sm text-amber-800">No active topic groups match this subject. Create the group first, or use the legacy secondary section only for old data.</p> : null}
        <details className="mt-5 rounded-sm bg-[#f5f3ee] p-4">
          <summary className="cursor-pointer font-body font-semibold text-[#735b2b]">Legacy/global secondary topics</summary>
          <p className="mt-2 font-body text-sm text-[#43474d]">These are old/global topics. They are available only as secondary tags, not as the main topic.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {legacyTopics.map((topic) => <label key={topic.id} htmlFor={`admin-question-legacy-topic-${topic.id}`} className="flex cursor-pointer items-center gap-2 rounded-sm bg-white px-3 py-2 font-body text-sm text-[#43474d] hover:bg-blue-50"><input id={`admin-question-legacy-topic-${topic.id}`} type="checkbox" name="topic_ids" value={topic.id} defaultChecked={selectedTopics.has(topic.id)} /> {topic.name}</label>)}
            {!legacyTopics.length ? <p className="font-body text-sm text-[#43474d]">No legacy/global topics match this scope.</p> : null}
          </div>
        </details>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label htmlFor="admin-question-published" className={`cursor-pointer rounded-md border p-4 font-body text-sm transition hover:shadow-sm focus-within:ring-2 focus-within:ring-emerald-300 ${published ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}><span className="mb-2 inline-flex rounded-full bg-white px-2 py-1 text-xs font-semibold">{published ? 'Show to students' : 'Save as draft'}</span><span className="flex items-center gap-2"><input id="admin-question-published" type="checkbox" name="is_published" checked={published} onChange={(event) => setPublished(event.target.checked)} /> Published</span><span className="mt-1 block text-xs">Draft questions stay hidden from student practice pages.</span></label>
          <label htmlFor="admin-question-reviewed" className={`cursor-pointer rounded-md border p-4 font-body text-sm transition hover:shadow-sm focus-within:ring-2 focus-within:ring-blue-300 ${reviewed ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><span className="mb-2 inline-flex rounded-full bg-white px-2 py-1 text-xs font-semibold">{reviewed ? 'Checked and ready' : 'Not checked'}</span><span className="flex items-center gap-2"><input id="admin-question-reviewed" type="checkbox" name="is_reviewed" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /> Reviewed</span><span className="mt-1 block text-xs">Use this after the image, mark scheme, and topic have been checked.</span></label>
        </div>
      </StepCard>

      <div className="sticky bottom-4 z-10 rounded-md border border-[#c3c6ce66] bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={`font-body text-sm font-semibold ${readyToSubmit ? 'text-emerald-700' : 'text-amber-800'}`}>{readyToSubmit ? 'Ready to save: all required steps are complete.' : 'Not ready yet: complete the highlighted required steps.'}</p>
          <div className="flex flex-wrap gap-3">
            <SubmitButton readyToSubmit={readyToSubmit} label={mode === 'new' ? 'Create question' : 'Save question'} />
            <Link href="/dashboard/admin/question-bank" className="tsm-btn-secondary">Cancel</Link>
          </div>
        </div>
      </div>
      <Lightbox state={lightbox} questionItems={questionLightboxItems} markschemeItems={markschemeLightboxItems} onClose={() => setLightbox(null)} onMove={(index) => setLightbox((current) => current ? { ...current, index } : current)} />
    </form>
  )
}

function SubmitButton({ readyToSubmit, label }: { readyToSubmit: boolean; label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="tsm-btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50" disabled={!readyToSubmit || pending}>
      {pending ? <span className="inline-block size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> : null}
      {pending ? 'Saving...' : label}
    </button>
  )
}
