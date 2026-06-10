"use client"

import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createQuestion } from './actions'
import {
  ChoiceCard,
  ImageUploadGroup,
  Lightbox,
  SearchableSelect,
  StepCard,
  SubmitButton,
  orderedPreviewItems,
  paperLabel,
  relationLabel,
  topicMatchesMainScope,
  type LightboxState,
  type LocalPreview,
  type Paper,
  type Subject,
  type Topic,
} from './form'

type PdfDocumentProxy = import('pdfjs-dist').PDFDocumentProxy

type PdfFileState = { file: File; url: string } | null
type CropRect = { x: number; y: number; width: number; height: number } | null

type PdfCropPanelProps = {
  title: string
  helper: string
  fileState: PdfFileState
  cropLabel: string
  addLabel: string
  onAddCrop: (file: File) => void
  nextFileName: () => string
}

function makeCropPreview(file: File): LocalPreview {
  return { id: crypto.randomUUID(), file, name: file.name, url: URL.createObjectURL(file) }
}

function PdfFileInput({ id, label, value, onChange }: { id: string; label: string; value: PdfFileState; onChange: (value: PdfFileState) => void }) {
  function setFile(file: File | undefined) {
    if (value?.url) URL.revokeObjectURL(value.url)
    if (!file) {
      onChange(null)
      return
    }
    onChange({ file, url: URL.createObjectURL(file) })
  }

  return (
    <div className="rounded-md border border-[#c3c6ce66] bg-[#fbf9f4] p-4">
      <label htmlFor={id} className="block font-body text-sm font-semibold text-[#00152a]">{label}</label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label htmlFor={id} className="tsm-btn-secondary cursor-pointer">{value ? 'Change PDF' : 'Select PDF'}</label>
        <input id={id} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => setFile(event.target.files?.[0])} />
        {value ? <button type="button" onClick={() => setFile(undefined)} className="rounded-md border border-red-200 px-3 py-2 font-body text-sm font-semibold text-red-700 hover:bg-red-50">Remove</button> : null}
      </div>
      <p className="mt-3 font-body text-sm text-[#43474d]">{value ? value.file.name : 'No PDF selected yet.'}</p>
      <p className="mt-1 font-body text-xs text-[#6f737b]">This PDF stays local in your browser. Only cropped images are saved.</p>
    </div>
  )
}

function PdfCropPanel({ title, helper, fileState, cropLabel, addLabel, onAddCrop, nextFileName }: PdfCropPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null)
  const [pdf, setPdf] = useState<PdfDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [zoom, setZoom] = useState(1.2)
  const [crop, setCrop] = useState<CropRect>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Reset PDF viewer state when the local object URL changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPdf(null)
    setPageNumber(1)
    setPageCount(0)
    setCrop(null)
    setError(null)
    const pdfUrl = fileState?.url ?? ''
    if (!pdfUrl) return

    let cancelled = false
    setLoading(true)
    async function loadPdf() {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
        const document = await pdfjs.getDocument({ url: pdfUrl }).promise
        if (cancelled) return
        setPdf(document)
        setPageCount(document.numPages)
      } catch {
        if (!cancelled) setError('Could not load this PDF. Please try another PDF file.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadPdf()
    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
    }
  }, [fileState?.url])

  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    const currentPdf = pdf
    let cancelled = false
    async function renderPage() {
      setRendering(true)
      setError(null)
      setCrop(null)
      renderTaskRef.current?.cancel()
      try {
        const page = await currentPdf.getPage(pageNumber)
        const viewport = page.getViewport({ scale: zoom })
        const renderScale = 2
        const canvas = canvasRef.current
        if (!canvas) return
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Missing canvas context')
        canvas.width = Math.round(viewport.width * renderScale)
        canvas.height = Math.round(viewport.height * renderScale)
        canvas.style.width = `${Math.round(viewport.width)}px`
        canvas.style.height = `${Math.round(viewport.height)}px`
        context.setTransform(renderScale, 0, 0, renderScale, 0, 0)
        const task = page.render({ canvas, canvasContext: context, viewport })
        renderTaskRef.current = task
        await task.promise
      } catch (renderError) {
        if (!cancelled && !(renderError instanceof Error && renderError.name === 'RenderingCancelledException')) {
          setError('Could not render this PDF page. Try changing page or zoom.')
        }
      } finally {
        if (!cancelled) setRendering(false)
      }
    }
    renderPage()
    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
    }
  }, [pdf, pageNumber, zoom])

  function pointFromEvent(event: MouseEvent<HTMLDivElement>) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: Math.max(0, Math.min(event.clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(event.clientY - rect.top, rect.height)),
    }
  }

  function beginCrop(event: MouseEvent<HTMLDivElement>) {
    if (!pdf || rendering) return
    const point = pointFromEvent(event)
    setDragStart(point)
    setCrop({ x: point.x, y: point.y, width: 0, height: 0 })
  }

  function updateCrop(event: MouseEvent<HTMLDivElement>) {
    if (!dragStart) return
    const point = pointFromEvent(event)
    setCrop({
      x: Math.min(dragStart.x, point.x),
      y: Math.min(dragStart.y, point.y),
      width: Math.abs(point.x - dragStart.x),
      height: Math.abs(point.y - dragStart.y),
    })
  }

  function finishCrop() {
    setDragStart(null)
    setCrop((current) => current && current.width > 8 && current.height > 8 ? current : null)
  }

  function addCrop() {
    const canvas = canvasRef.current
    if (!canvas || !crop) return
    const cssWidth = Number.parseFloat(canvas.style.width) || canvas.width
    const cssHeight = Number.parseFloat(canvas.style.height) || canvas.height
    const scaleX = canvas.width / cssWidth
    const scaleY = canvas.height / cssHeight
    const sx = Math.round(crop.x * scaleX)
    const sy = Math.round(crop.y * scaleY)
    const sw = Math.round(crop.width * scaleX)
    const sh = Math.round(crop.height * scaleY)
    const output = document.createElement('canvas')
    output.width = sw
    output.height = sh
    output.getContext('2d')?.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)
    output.toBlob((blob) => {
      if (!blob) {
        toast.error('Could not create the crop image.')
        return
      }
      onAddCrop(new File([blob], nextFileName(), { type: 'image/png' }))
      setCrop(null)
      toast.success(`${cropLabel} added.`)
    }, 'image/png')
  }

  const canUsePdf = Boolean(pdf && !loading && !error)
  const canAddCrop = Boolean(crop && crop.width > 8 && crop.height > 8 && canUsePdf && !rendering)

  return (
    <div className="rounded-md border border-[#c3c6ce66] bg-[#fbf9f4] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-headline text-2xl text-[#00152a]">{title}</h3>
          <p className="mt-1 font-body text-sm text-[#43474d]">{helper}</p>
          <p className="mt-2 font-body text-sm font-semibold text-[#00152a]">Drag over the PDF page to select the area to crop.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPageNumber((page) => Math.max(1, page - 1))} disabled={!canUsePdf || pageNumber <= 1} className="tsm-btn-secondary disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
          <button type="button" onClick={() => setPageNumber((page) => Math.min(pageCount, page + 1))} disabled={!canUsePdf || pageNumber >= pageCount} className="tsm-btn-secondary disabled:cursor-not-allowed disabled:opacity-50">Next</button>
          <button type="button" onClick={() => setZoom((value) => Math.max(0.7, Number((value - 0.2).toFixed(1))))} disabled={!canUsePdf} className="tsm-btn-secondary disabled:cursor-not-allowed disabled:opacity-50">Zoom out</button>
          <button type="button" onClick={() => setZoom((value) => Math.min(2.4, Number((value + 0.2).toFixed(1))))} disabled={!canUsePdf} className="tsm-btn-secondary disabled:cursor-not-allowed disabled:opacity-50">Zoom in</button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 font-body text-sm text-[#43474d]">
        <span>Page {pageCount ? pageNumber : '—'} of {pageCount || '—'}</span>
        <span>Zoom {Math.round(zoom * 100)}%</span>
        {loading || rendering ? <span className="font-semibold text-blue-700">Loading…</span> : null}
      </div>
      {error ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700">{error}</p> : null}
      {!fileState ? <p className="mt-4 rounded-md border border-slate-200 bg-white px-4 py-8 text-center font-body text-sm text-slate-500">Select a local PDF in Step 2 to enable cropping.</p> : null}
      {fileState ? (
        <div ref={wrapRef} className="mt-4 max-h-[70vh] overflow-auto rounded-md border border-slate-200 bg-white p-3">
          <div className="relative inline-block select-none" onMouseDown={beginCrop} onMouseMove={updateCrop} onMouseUp={finishCrop} onMouseLeave={finishCrop}>
            <canvas ref={canvasRef} className={`block bg-white shadow-sm ${canUsePdf ? 'cursor-crosshair' : 'cursor-not-allowed opacity-60'}`} />
            {crop ? <div className="pointer-events-none absolute border-2 border-blue-600 bg-blue-500/15 shadow-[0_0_0_9999px_rgba(15,23,42,0.12)]" style={{ left: crop.x, top: crop.y, width: crop.width, height: crop.height }} /> : null}
          </div>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={addCrop} disabled={!canAddCrop} className="tsm-btn-primary disabled:cursor-not-allowed disabled:opacity-50">{addLabel}</button>
        <button type="button" onClick={() => setCrop(null)} disabled={!crop} className="tsm-btn-secondary disabled:cursor-not-allowed disabled:opacity-50">Clear current crop</button>
      </div>
    </div>
  )
}

export function QuestionFromPdfForm({ papers, subjects, topics }: { papers: Paper[]; subjects: Subject[]; topics: Topic[] }) {
  const defaultSubjectId = subjects.find((subject) => subject.name === 'Mathematics Extended')?.id || subjects.find((subject) => subject.name === 'Mathematics')?.id || subjects[0]?.id || ''
  const [paperMode, setPaperMode] = useState<'existing' | 'new'>('existing')
  const [subjectId, setSubjectId] = useState(defaultSubjectId)
  const [paperId, setPaperId] = useState('')
  const [newPaperTitle, setNewPaperTitle] = useState('')
  const [newPaperCode, setNewPaperCode] = useState('')
  const [newPaperYear, setNewPaperYear] = useState('2025')
  const [newPaperSession, setNewPaperSession] = useState('May')
  const [paperFile, setPaperFile] = useState<PdfFileState>(null)
  const [markschemeFile, setMarkschemeFile] = useState<PdfFileState>(null)
  const [questionFiles, setQuestionFiles] = useState<LocalPreview[]>([])
  const [markschemeFiles, setMarkschemeFiles] = useState<LocalPreview[]>([])
  const [questionOrder, setQuestionOrder] = useState<string[]>([])
  const [markschemeOrder, setMarkschemeOrder] = useState<string[]>([])
  const [questionNumber, setQuestionNumber] = useState('')
  const [questionOrderValue, setQuestionOrderValue] = useState('')
  const [marks, setMarks] = useState('')
  const [topicGroupId, setTopicGroupId] = useState('')
  const [selectedSubtopicIds, setSelectedSubtopicIds] = useState<string[]>([])
  const [primaryTopicId, setPrimaryTopicId] = useState('')
  const [published, setPublished] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [openSelectId, setOpenSelectId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<LightboxState>(null)

  const paperFileRef = useRef(paperFile)
  const markschemeFileRef = useRef(markschemeFile)
  const questionFilesRef = useRef(questionFiles)
  const markschemeFilesRef = useRef(markschemeFiles)

  useEffect(() => { paperFileRef.current = paperFile }, [paperFile])
  useEffect(() => { markschemeFileRef.current = markschemeFile }, [markschemeFile])
  useEffect(() => { questionFilesRef.current = questionFiles }, [questionFiles])
  useEffect(() => { markschemeFilesRef.current = markschemeFiles }, [markschemeFiles])

  useEffect(() => () => {
    if (paperFileRef.current?.url) URL.revokeObjectURL(paperFileRef.current.url)
    if (markschemeFileRef.current?.url) URL.revokeObjectURL(markschemeFileRef.current.url)
    questionFilesRef.current.forEach((file) => URL.revokeObjectURL(file.url))
    markschemeFilesRef.current.forEach((file) => URL.revokeObjectURL(file.url))
  }, [])

  function updateSubject(value: string) {
    setSubjectId(value)
    setPaperId('')
    setTopicGroupId('')
    setSelectedSubtopicIds([])
    setPrimaryTopicId('')
  }

  function addQuestionCrop(file: File) {
    const preview = makeCropPreview(file)
    setQuestionFiles((files) => [...files, preview])
    setQuestionOrder((order) => [...order, `new:${preview.id}`])
  }

  function addMarkschemeCrop(file: File) {
    const preview = makeCropPreview(file)
    setMarkschemeFiles((files) => [...files, preview])
    setMarkschemeOrder((order) => [...order, `new:${preview.id}`])
  }

  const filteredPapers = papers.filter((paper) => !subjectId || relationLabel(paper.subjects, 'id') === subjectId)
  const mainTopicGroups = useMemo(() => topics
    .filter((topic) => !topic.parent_topic_id && topicMatchesMainScope(topic, subjectId))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)), [topics, subjectId])
  const subtopics = useMemo(() => topics
    .filter((topic) => topic.parent_topic_id === topicGroupId && topicMatchesMainScope(topic, subjectId))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)), [topics, topicGroupId, subjectId])

  const step1Complete = paperMode === 'existing' ? Boolean(subjectId && paperId) : Boolean(subjectId && newPaperTitle && newPaperYear && newPaperSession)
  const step2Complete = Boolean(paperFile && markschemeFile)
  const step3Complete = questionFiles.length > 0
  const step4Complete = markschemeFiles.length > 0
  const step5Complete = Boolean(questionNumber.trim() && topicGroupId && (selectedSubtopicIds.length || !subtopics.length))
  const readyToSubmit = step1Complete && step2Complete && step3Complete && step4Complete && step5Complete
  const effectivePrimaryTopicId = selectedSubtopicIds.includes(primaryTopicId) ? primaryTopicId : selectedSubtopicIds[0] || topicGroupId
  const questionLightboxItems = orderedPreviewItems([], questionFiles, questionOrder, 'Question image')
  const markschemeLightboxItems = orderedPreviewItems([], markschemeFiles, markschemeOrder, 'Mark scheme image')

  return (
    <form action={async (formData) => {
      try {
        toast.loading('Saving cropped question…', { id: 'from-pdf-save' })
        await createQuestion(formData)
        toast.success('Question saved.', { id: 'from-pdf-save' })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not save question.', { id: 'from-pdf-save' })
      }
    }} className="space-y-8" onSubmit={(event) => { if (!readyToSubmit) event.preventDefault() }}>
      <input type="hidden" name="paper_id" value={paperMode === 'existing' ? paperId : ''} />
      <input type="hidden" name="new_paper_subject_id" value={subjectId} />
      <input type="hidden" name="new_paper_session" value={newPaperSession} />
      <input type="hidden" name="new_paper_is_published" value="on" />
      {(selectedSubtopicIds.length ? selectedSubtopicIds : topicGroupId ? [topicGroupId] : []).map((topicId) => <input key={topicId} type="hidden" name="topic_ids" value={topicId} />)}
      <input type="hidden" name="primary_topic_id" value={effectivePrimaryTopicId} />

      <StepCard step={1} title="Paper setup" state={step1Complete ? 'complete' : 'current'} helper="Choose where this question belongs.">
        <div className="grid gap-4 md:grid-cols-2">
          <ChoiceCard active={paperMode === 'existing'} title="Add to existing paper" helper="Pick a subject, then search for the paper." onClick={() => setPaperMode('existing')} />
          <ChoiceCard active={paperMode === 'new'} title="Create new paper" helper="Create a paper record before saving this question." onClick={() => { setPaperMode('new'); setPaperId('') }} />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <SearchableSelect id="pdf-question-subject" label="Subject" value={subjectId} onChange={updateSubject} placeholder="Choose subject" emptyText="No matching subjects found." options={subjects.map((subject) => ({ value: subject.id, label: subject.name }))} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
          {paperMode === 'existing' ? <SearchableSelect id="pdf-question-paper" label="Existing paper" value={paperId} onChange={setPaperId} placeholder="Search papers" emptyText="No matching papers found." options={filteredPapers.map((paper) => ({ value: paper.id, label: paperLabel(paper) }))} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} /> : null}
        </div>
        {paperMode === 'new' ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="font-body text-sm text-[#43474d]">Paper title<input name="new_paper_title" value={newPaperTitle} onChange={(event) => setNewPaperTitle(event.target.value)} className="tsm-input mt-1 w-full" placeholder="Paper 1" /></label>
            <label className="font-body text-sm text-[#43474d]">Paper code<input value={newPaperCode} onChange={(event) => setNewPaperCode(event.target.value)} className="tsm-input mt-1 w-full" placeholder="Optional code, e.g. 1H" /></label>
            <label className="font-body text-sm text-[#43474d]">Year<input name="new_paper_year" value={newPaperYear} onChange={(event) => setNewPaperYear(event.target.value)} inputMode="numeric" className="tsm-input mt-1 w-full" /></label>
            <SearchableSelect id="pdf-question-session" name="new_paper_session" label="Session" value={newPaperSession} onChange={setNewPaperSession} placeholder="Choose session" emptyText="No sessions found." options={[{ value: 'May', label: 'May' }, { value: 'November', label: 'November' }]} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
            <input type="hidden" name="new_paper_level" value={newPaperCode} />
          </div>
        ) : null}
      </StepCard>

      <StepCard step={2} title="Load PDFs" state={!step1Complete ? 'locked' : step2Complete ? 'complete' : 'current'} helper="Select local PDFs. They are not uploaded.">
        <div className="grid gap-4 lg:grid-cols-2">
          <PdfFileInput id="paper-pdf" label="Paper PDF" value={paperFile} onChange={setPaperFile} />
          <PdfFileInput id="markscheme-pdf" label="Mark scheme PDF" value={markschemeFile} onChange={setMarkschemeFile} />
        </div>
      </StepCard>

      <StepCard step={3} title="Crop question images" state={!step2Complete ? 'locked' : step3Complete ? 'complete' : 'current'} helper="Crop every part needed to answer this question.">
        <PdfCropPanel title="Paper PDF cropper" helper="Use this for question text, diagrams, tables, graphs, and continuation pages." fileState={paperFile} cropLabel="Question crop" addLabel="Add crop to question images" onAddCrop={addQuestionCrop} nextFileName={() => `question-${questionNumber.trim() || 'untitled'}-crop-${questionFiles.length + 1}.png`} />
        <div className="mt-5">
          <ImageUploadGroup title="Question image" name="question_image_file" fileKeyName="question_file_key" assetOrderName="question_asset_order" existingAssets={[]} files={questionFiles} setFiles={setQuestionFiles} order={questionOrder} setOrder={setQuestionOrder} onPreview={(index) => setLightbox({ group: 'question', index })} />
        </div>
      </StepCard>

      <StepCard step={4} title="Crop mark scheme images" state={!step3Complete ? 'locked' : step4Complete ? 'complete' : 'current'} helper="Crop the matching mark scheme parts for this one question.">
        <PdfCropPanel title="Mark scheme PDF cropper" helper="Use this for mark allocations, method notes, and answer continuations." fileState={markschemeFile} cropLabel="Mark scheme crop" addLabel="Add crop to mark scheme images" onAddCrop={addMarkschemeCrop} nextFileName={() => `markscheme-${questionNumber.trim() || 'untitled'}-crop-${markschemeFiles.length + 1}.png`} />
        <div className="mt-5">
          <ImageUploadGroup title="Mark scheme image" name="markscheme_image_file" fileKeyName="markscheme_file_key" assetOrderName="markscheme_asset_order" existingAssets={[]} files={markschemeFiles} setFiles={setMarkschemeFiles} order={markschemeOrder} setOrder={setMarkschemeOrder} onPreview={(index) => setLightbox({ group: 'markscheme', index })} />
        </div>
      </StepCard>

      <StepCard step={5} title="Question details and topics" state={!step4Complete ? 'locked' : step5Complete ? 'complete' : 'current'} helper="Add the required labels before saving.">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="font-body text-sm text-[#43474d]">Question number<input name="question_number" value={questionNumber} onChange={(event) => setQuestionNumber(event.target.value)} className="tsm-input mt-1 w-full" placeholder="1a" /></label>
          <label className="font-body text-sm text-[#43474d]">Display order<input name="question_order" value={questionOrderValue} onChange={(event) => setQuestionOrderValue(event.target.value)} inputMode="decimal" className="tsm-input mt-1 w-full" placeholder="1" /></label>
          <label className="font-body text-sm text-[#43474d]">Marks<input name="marks" value={marks} onChange={(event) => setMarks(event.target.value)} inputMode="numeric" className="tsm-input mt-1 w-full" placeholder="6" /></label>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <SearchableSelect id="pdf-question-topic-group" label="Topic group" value={topicGroupId} onChange={(value) => { setTopicGroupId(value); setSelectedSubtopicIds([]); setPrimaryTopicId('') }} placeholder="Choose topic group" emptyText="No matching topic groups found." options={mainTopicGroups.map((topic) => ({ value: topic.id, label: topic.name }))} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
          <SearchableSelect id="pdf-question-subtopic" label="Add exact subtopic" value="" onChange={(value) => { if (value && !selectedSubtopicIds.includes(value)) { setSelectedSubtopicIds([...selectedSubtopicIds, value]); if (!primaryTopicId) setPrimaryTopicId(value) } }} placeholder={topicGroupId ? 'Search subtopics to add' : 'Choose a topic group first'} emptyText="No matching subtopics found." options={subtopics.filter((topic) => !selectedSubtopicIds.includes(topic.id)).map((topic) => ({ value: topic.id, label: topic.name }))} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
        </div>
        <div className="mt-4 rounded-md border border-[#c3c6ce66] bg-[#fbf9f4] p-4">
          <h3 className="font-body text-sm font-semibold text-[#00152a]">Selected subtopics</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedSubtopicIds.map((topicId) => {
              const topic = topics.find((item) => item.id === topicId)
              const primary = effectivePrimaryTopicId === topicId
              return <span key={topicId} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-body text-sm ${primary ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-[#43474d]'}`}>{topic?.name || 'Selected subtopic'}{primary ? <strong className="text-xs">Primary</strong> : <button type="button" onClick={() => setPrimaryTopicId(topicId)} className="text-xs font-semibold text-blue-700 underline">Make primary</button>}<button type="button" onClick={() => { const next = selectedSubtopicIds.filter((id) => id !== topicId); setSelectedSubtopicIds(next); if (primaryTopicId === topicId) setPrimaryTopicId(next[0] || '') }} className="text-xs font-semibold text-red-700">Remove</button></span>
            })}
            {!selectedSubtopicIds.length ? <p className="font-body text-sm text-[#6f737b]">No exact subtopics selected yet.</p> : null}
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label htmlFor="pdf-question-published" className={`cursor-pointer rounded-md border p-4 font-body text-sm transition hover:shadow-sm focus-within:ring-2 focus-within:ring-emerald-300 ${published ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}><span className="mb-2 inline-flex rounded-full bg-white px-2 py-1 text-xs font-semibold">{published ? 'Show to students' : 'Save as draft'}</span><span className="flex items-center gap-2"><input id="pdf-question-published" type="checkbox" name="is_published" checked={published} onChange={(event) => setPublished(event.target.checked)} /> Published</span></label>
          <label htmlFor="pdf-question-reviewed" className={`cursor-pointer rounded-md border p-4 font-body text-sm transition hover:shadow-sm focus-within:ring-2 focus-within:ring-blue-300 ${reviewed ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><span className="mb-2 inline-flex rounded-full bg-white px-2 py-1 text-xs font-semibold">{reviewed ? 'Checked and ready' : 'Not checked'}</span><span className="flex items-center gap-2"><input id="pdf-question-reviewed" type="checkbox" name="is_reviewed" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /> Reviewed</span></label>
        </div>
      </StepCard>

      <StepCard step={6} title="Save" state={readyToSubmit ? 'complete' : 'current'} helper="Only cropped images will be submitted and saved.">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={`font-body text-sm font-semibold ${readyToSubmit ? 'text-emerald-700' : 'text-amber-800'}`}>{readyToSubmit ? 'Ready to save: all required steps are complete.' : 'Not ready yet: complete the highlighted required steps.'}</p>
          <div className="flex flex-wrap gap-3">
            <SubmitButton readyToSubmit={readyToSubmit} label="Save question" />
            <Link href="/dashboard/admin/question-bank" className="tsm-btn-secondary">Cancel</Link>
          </div>
        </div>
      </StepCard>
      <Lightbox state={lightbox} questionItems={questionLightboxItems} markschemeItems={markschemeLightboxItems} onClose={() => setLightbox(null)} onMove={(index) => setLightbox((current) => current ? { ...current, index } : current)} />
    </form>
  )
}
