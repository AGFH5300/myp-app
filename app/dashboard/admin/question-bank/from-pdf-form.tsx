"use client"

import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createQuestionForPdfFlow } from './actions'
import { PdfCropPanel, PdfFileInput, makeCropPreview, type PdfFileState } from './pdf-cropper'
import {
  ChoiceCard,
  ImageUploadGroup,
  Lightbox,
  OrderInPaperHelper,
  SearchableSelect,
  StepCard,
  orderedPreviewItems,
  paperLabel,
  relationLabel,
  topicMatchesMainScope,
  subtopicSearchOptions,
  addSubtopicSelection,
  type LightboxState,
  type LocalPreview,
  paperQuestionReference,
  suggestedQuestionOrder,
  type Paper,
  type PaperQuestion,
  type Subject,
  type Topic,
} from './form'

function readableSaveError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (!message || /NEXT_|digest|failed to fetch|server components/i.test(message)) return 'Could not create question. Please try again.'
  return message
}

type SavingMode = 'save' | 'next' | null

function FromPdfSubmitButton({ readyToSubmit, savingMode, action, children }: { readyToSubmit: boolean; savingMode: SavingMode; action: 'save' | 'next'; children: string }) {
  const isSavingThisAction = savingMode === action
  const loadingText = action === 'next' ? 'Saving next…' : 'Saving…'
  const buttonClassName = action === 'next'
    ? 'inline-flex items-center gap-2 rounded-[var(--radius-xs)] border border-[#735b2b] bg-[#735b2b] px-[1.4rem] py-[.8rem] font-medium text-white transition hover:border-[#624d24] hover:bg-[#624d24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#735b2b]/45 disabled:cursor-not-allowed disabled:opacity-50'
    : 'tsm-btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <button type="submit" name="save_action" value={action} className={buttonClassName} disabled={!readyToSubmit || savingMode !== null}>
      {isSavingThisAction ? <span className="inline-block size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> : null}
      {isSavingThisAction ? loadingText : children}
    </button>
  )
}


type SmartFillConfidence = 'low' | 'medium' | 'high'
type SmartFillTopicSuggestion = { groupId: string; groupName: string; subtopicId: string; subtopicName: string; confidence: SmartFillConfidence; score: number }
type SmartFillMarksSuggestion = { value: string; confidence: SmartFillConfidence; candidates: string[]; needsReview: boolean }
type SmartFillSuggestions = { text: string; questionNumber: string | null; marks: SmartFillMarksSuggestion | null; topics: SmartFillTopicSuggestion[] }
type SmartFillAppliedState = { questionNumber: string | null; marks: string | null; topicIds: string[] }

const EMPTY_SMART_FILL_APPLIED_STATE: SmartFillAppliedState = { questionNumber: null, marks: null, topicIds: [] }

const SMART_FILL_KEYWORDS: Record<string, string[]> = {
  algebra: ['equation', 'expression', 'factor', 'expand', 'simplify', 'solve', 'substitute'],
  angle: ['angle', 'parallel', 'perpendicular', 'bearing', 'triangle', 'polygon'],
  graph: ['graph', 'axis', 'axes', 'curve', 'line', 'gradient', 'intercept', 'coordinate'],
  inequalities: ['inequality', 'inequalities', 'constraint', 'constraints', 'feasible region', 'shaded region', 'region', 'feasible', 'shade', 'linear programming'],
  simultaneous: ['simultaneous', 'solve both equations'],
  quadratic: ['quadratic', 'quadratics', 'parabola', 'turning point'],
  statistics: ['mean', 'median', 'mode', 'standard deviation', 'range', 'frequency', 'histogram', 'box plot', 'quartile'],
  probability: ['probability', 'chance', 'random', 'spinner', 'dice', 'tree diagram', 'outcome', 'venn', 'set', 'intersection', 'union'],
  venn: ['venn', 'set', 'intersection', 'union'],
  functions: ['function', 'domain', 'range', 'inverse', 'composite', 'mapping', 'quadratic function'],
  trigonometry: ['sin', 'cos', 'tan', 'sine', 'cosine', 'tangent', 'trigonometry'],
  calculus: ['differentiate', 'derivative', 'gradient function', 'integrate', 'area under'],
  vectors: ['vector', 'magnitude', 'direction', 'scalar'],
  geometry: ['circle', 'area', 'volume', 'surface area', 'length', 'radius', 'diameter', 'trigonometry', 'sine', 'cosine', 'tan'],
}

function normalizeSmartFillText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function smartFillTokens(value: string) {
  return normalizeSmartFillText(value).split(' ').filter((token) => token.length > 2)
}

function normalizeQuestionNumber(value: string) {
  return value.toLowerCase().replace(/^(?:question|q)\s*/i, '').replace(/\s+/g, '').replace(/[().]/g, '')
}

function collectQuestionMatches(text: string) {
  const matches: { value: string; index: number; specificity: number }[] = []
  const patterns = [
    /\bquestion\s+(\d{1,2}\s*\(?[a-z]\)?|\d{1,2})\b/gi,
    /\bq\s*(\d{1,2}\s*\(?[a-z]\)?)\b/gi,
    /(?:^|[^a-z0-9])(\d{1,2}\s*\([a-z]\))/gi,
    /(?:^|[^a-z0-9])(\d{1,2}[a-z])\b/gi,
    /(?:^|\n)\s*(\d{1,2})[.)\s]/gi,
  ]
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const rawValue = match[1]
      if (!rawValue) continue
      const value = normalizeQuestionNumber(rawValue)
      const specificity = /[a-z]/i.test(value) ? 2 : 1
      const index = (match.index ?? 0) + match[0].indexOf(rawValue)
      matches.push({ value, index, specificity })
    }
  }
  return matches
    .filter((match, index, all) => all.findIndex((item) => item.value === match.value && item.index === match.index) === index)
    .sort((a, b) => b.specificity - a.specificity || a.index - b.index)
}

function detectQuestionNumber(text: string) {
  return collectQuestionMatches(text)[0]?.value || null
}

function collectMarksCandidates(text: string) {
  const candidates: { value: string; index: number; label: string }[] = []
  const patterns = [
    { label: 'brackets', pattern: /\[\s*(\d{1,2})\s*(?:marks?)?\s*\]/gi },
    { label: 'marked parentheses', pattern: /\(\s*(\d{1,2})\s*marks?\s*\)/gi },
    { label: 'plain marks', pattern: /\b(\d{1,2})\s*marks?\b/gi },
    { label: 'total marks', pattern: /\btotal\s+(\d{1,2})\s*marks?\b/gi },
    { label: 'parentheses', pattern: /\(\s*(\d{1,2})\s*\)/gi },
  ]
  for (const { label, pattern } of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[1]
      if (!value) continue
      const index = (match.index ?? 0) + match[0].indexOf(value)
      candidates.push({ value, index, label })
    }
  }
  return candidates
    .filter((candidate, index, all) => all.findIndex((item) => item.value === candidate.value && Math.abs(item.index - candidate.index) <= 2) === index)
    .sort((a, b) => a.index - b.index)
}

function lineDistance(text: string, from: number, to: number) {
  return text.slice(Math.min(from, to), Math.max(from, to)).split(/\n/).length - 1
}

function detectMarks(text: string, questionNumber: string | null): SmartFillMarksSuggestion | null {
  const candidates = collectMarksCandidates(text)
  if (!candidates.length) return null
  const uniqueValues = Array.from(new Set(candidates.map((candidate) => candidate.value)))
  const questionMatch = questionNumber ? collectQuestionMatches(text).find((match) => match.value === questionNumber) : null
  if (!questionMatch) {
    return uniqueValues.length === 1
      ? { value: uniqueValues[0], confidence: 'medium', candidates: uniqueValues, needsReview: true }
      : { value: uniqueValues[0], confidence: 'low', candidates: uniqueValues, needsReview: true }
  }
  const ranked = candidates
    .map((candidate) => {
      const distance = Math.abs(candidate.index - questionMatch.index)
      const lines = lineDistance(text, candidate.index, questionMatch.index)
      const afterPenalty = candidate.index >= questionMatch.index ? 0 : 80
      const totalPenalty = candidate.label === 'total marks' ? 120 : 0
      return { ...candidate, distance, lines, rank: distance + afterPenalty + totalPenalty }
    })
    .sort((a, b) => a.rank - b.rank)
  const best = ranked[0]
  const closeCandidates = ranked.filter((candidate) => candidate.lines <= 2 && candidate.distance <= 180 && candidate.rank <= best.rank + 40)
  const closeValues = Array.from(new Set(closeCandidates.map((candidate) => candidate.value)))
  if (!best) return null
  if (closeValues.length === 1 && best.lines <= 2 && best.distance <= 180) {
    return { value: best.value, confidence: 'high', candidates: uniqueValues, needsReview: false }
  }
  if (uniqueValues.length === 1) {
    return { value: best.value, confidence: 'medium', candidates: uniqueValues, needsReview: true }
  }
  return { value: best.value, confidence: 'low', candidates: uniqueValues, needsReview: true }
}

function confidenceFromScore(score: number): SmartFillConfidence {
  if (score >= 8) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

function suggestSmartFillTopics(text: string, allTopics: Topic[], subjectId: string) {
  const normalizedText = normalizeSmartFillText(text)
  const textTokens = new Set(smartFillTokens(text))
  const groups = allTopics.filter((topic) => !topic.parent_topic_id && topicMatchesMainScope(topic, subjectId))
  const groupById = new Map(groups.map((topic) => [topic.id, topic]))

  return allTopics
    .filter((topic) => topic.parent_topic_id && topicMatchesMainScope(topic, subjectId) && groupById.has(topic.parent_topic_id))
    .map((subtopic) => {
      const group = groupById.get(subtopic.parent_topic_id || '')
      if (!group) return null
      const names = `${group.name} ${subtopic.name}`
      const nameTokens = smartFillTokens(names)
      let score = 0
      for (const token of nameTokens) {
        if (textTokens.has(token)) score += token.length > 5 ? 2 : 1
      }
      if (normalizedText.includes(normalizeSmartFillText(subtopic.name))) score += 5
      if (normalizedText.includes(normalizeSmartFillText(group.name))) score += 2
      for (const [topicKey, keywords] of Object.entries(SMART_FILL_KEYWORDS)) {
        const topicNameMatches = normalizeSmartFillText(names).includes(topicKey)
        if (!topicNameMatches) continue
        score += keywords.filter((keyword) => normalizedText.includes(normalizeSmartFillText(keyword))).length * 2
      }
      if (score <= 0) return null
      return { groupId: group.id, groupName: group.name, subtopicId: subtopic.id, subtopicName: subtopic.name, confidence: confidenceFromScore(score), score } satisfies SmartFillTopicSuggestion
    })
    .filter((item): item is SmartFillTopicSuggestion => Boolean(item))
    .sort((a, b) => b.score - a.score || a.subtopicName.localeCompare(b.subtopicName))
    .slice(0, 3)
}

function buildSmartFillSuggestions(text: string, allTopics: Topic[], subjectId: string): SmartFillSuggestions {
  const questionNumber = detectQuestionNumber(text)
  return {
    text,
    questionNumber,
    marks: detectMarks(text, questionNumber),
    topics: suggestSmartFillTopics(text, allTopics, subjectId),
  }
}


type PaperProgress = {
  total: number
  highestOrderQuestion: PaperQuestion | null
  lastWorkedQuestion: PaperQuestion | null
  nextOrder: number
  draftCount: number
  publishedCount: number
  needsReviewCount: number
  duplicateOrders: number[]
  missingOrders: number[]
}

function questionRef(question: PaperQuestion | null) {
  if (!question) return 'No question yet'
  const number = question.question_number ? `Q${question.question_number}` : 'Untitled question'
  return `${number} · Order ${question.question_order ?? '—'}`
}

function workedAt(question: PaperQuestion) {
  const value = question.updated_at || question.created_at || ''
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : 0
}

function buildPaperProgress(paperId: string, questions: PaperQuestion[]): PaperProgress {
  const paperQuestions = questions.filter((question) => question.paper_id === paperId)
  const orderedQuestions = paperQuestions.filter((question) => Number.isFinite(question.question_order))
  const orderValues = orderedQuestions.map((question) => question.question_order as number)
  const maxOrder = orderValues.length ? Math.max(...orderValues) : 0
  const orderCounts = new Map<number, number>()
  orderValues.forEach((order) => orderCounts.set(order, (orderCounts.get(order) ?? 0) + 1))
  const missingOrders = maxOrder ? Array.from({ length: maxOrder }, (_, index) => index + 1).filter((order) => !orderCounts.has(order)) : []

  return {
    total: paperQuestions.length,
    highestOrderQuestion: orderedQuestions.reduce<PaperQuestion | null>((highest, question) => (highest && (highest.question_order ?? 0) >= (question.question_order ?? 0) ? highest : question), null),
    lastWorkedQuestion: paperQuestions.reduce<PaperQuestion | null>((latest, question) => (latest && workedAt(latest) >= workedAt(question) ? latest : question), null),
    nextOrder: maxOrder + 1,
    draftCount: paperQuestions.filter((question) => question.is_published === false).length,
    publishedCount: paperQuestions.filter((question) => question.is_published === true).length,
    needsReviewCount: paperQuestions.filter((question) => question.is_reviewed === false).length,
    duplicateOrders: [...orderCounts.entries()].filter(([, count]) => count > 1).map(([order]) => order).sort((a, b) => a - b),
    missingOrders,
  }
}

function PaperProgressCard({ paper, progress, onUseNextOrder }: { paper: Paper; progress: PaperProgress; onUseNextOrder: () => void }) {
  const editQuestion = progress.highestOrderQuestion || progress.lastWorkedQuestion

  return (
    <div className="mt-5 rounded-md border border-blue-100 bg-blue-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-label text-xs uppercase tracking-[.14em] text-[#735b2b]">Resume paper</p>
          <h3 className="font-headline text-xl text-[#00152a]">{paperLabel(paper)}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onUseNextOrder} className="rounded-md border border-blue-200 bg-white px-3 py-2 font-body text-xs font-semibold text-blue-700 hover:bg-blue-50">Use next order</button>
          {editQuestion ? <Link href={`/dashboard/admin/question-bank/${editQuestion.id}/edit`} className="rounded-md border border-[#c3c6ce66] bg-white px-3 py-2 font-body text-xs font-semibold text-[#00152a] hover:bg-[#f5f3ee]">Edit previous question</Link> : null}
          <Link href={`/dashboard/admin/question-bank?paper=${paper.id}`} className="rounded-md border border-[#c3c6ce66] bg-white px-3 py-2 font-body text-xs font-semibold text-[#00152a] hover:bg-[#f5f3ee]">Review this paper</Link>
        </div>
      </div>
      <div className="mt-3 grid gap-2 font-body text-sm text-[#43474d] sm:grid-cols-2 lg:grid-cols-3">
        <p><span className="font-semibold text-[#00152a]">Questions created:</span> {progress.total}</p>
        <p><span className="font-semibold text-[#00152a]">Previous by order:</span> {questionRef(progress.highestOrderQuestion)}</p>
        <p><span className="font-semibold text-[#00152a]">Last worked on:</span> {questionRef(progress.lastWorkedQuestion)}</p>
        <p><span className="font-semibold text-[#00152a]">Next suggested order:</span> {progress.nextOrder}</p>
        <p><span className="font-semibold text-[#00152a]">Published / Draft / Needs review:</span> {progress.publishedCount} / {progress.draftCount} / {progress.needsReviewCount}</p>
      </div>
      {progress.duplicateOrders.length || progress.missingOrders.length ? (
        <div className="mt-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 font-body text-sm text-amber-900">
          {progress.duplicateOrders.length ? <p className="flex items-center gap-2"><AlertTriangle className="size-4" aria-hidden="true" /> Duplicate order: {progress.duplicateOrders.join(', ')}</p> : null}
          {progress.missingOrders.length ? <p>Missing order: {progress.missingOrders.join(', ')}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

export function QuestionFromPdfForm({ papers, subjects, topics, paperQuestions = [], initialPaperId = '' }: { papers: Paper[]; subjects: Subject[]; topics: Topic[]; paperQuestions?: PaperQuestion[]; initialPaperId?: string }) {
  const router = useRouter()
  const defaultSubjectId = subjects.find((subject) => subject.name === 'Mathematics Extended')?.id || subjects.find((subject) => subject.name === 'Mathematics')?.id || subjects[0]?.id || ''
  const initialPaper = papers.find((paper) => paper.id === initialPaperId)
  const [paperMode, setPaperMode] = useState<'existing' | 'new'>('existing')
  const [availablePapers, setAvailablePapers] = useState<Paper[]>(papers)
  const [availablePaperQuestions, setAvailablePaperQuestions] = useState<PaperQuestion[]>(paperQuestions)
  const [subjectId, setSubjectId] = useState(relationLabel(initialPaper?.subjects, 'id') || defaultSubjectId)
  const [paperId, setPaperId] = useState(initialPaper?.id || '')
  const [newPaperTitle, setNewPaperTitle] = useState('')
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
  const [paperCropResetToken, setPaperCropResetToken] = useState(0)
  const [markschemeCropResetToken, setMarkschemeCropResetToken] = useState(0)
  const [savingMode, setSavingMode] = useState<SavingMode>(null)
  const [smartFillCropId, setSmartFillCropId] = useState('')
  const [smartFillLoading, setSmartFillLoading] = useState(false)
  const [smartFillSuggestions, setSmartFillSuggestions] = useState<SmartFillSuggestions | null>(null)
  const [smartFillApplied, setSmartFillApplied] = useState<SmartFillAppliedState>(EMPTY_SMART_FILL_APPLIED_STATE)

  const step3Ref = useRef<HTMLDivElement>(null)
  const savingModeRef = useRef<SavingMode>(null)

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

  function clearSmartFill() {
    setSmartFillSuggestions(null)
    setSmartFillApplied(EMPTY_SMART_FILL_APPLIED_STATE)
  }

  function markSmartFillApplied(partial: Partial<SmartFillAppliedState>) {
    setSmartFillApplied((current) => ({
      questionNumber: partial.questionNumber === undefined ? current.questionNumber : partial.questionNumber,
      marks: partial.marks === undefined ? current.marks : partial.marks,
      topicIds: partial.topicIds === undefined ? current.topicIds : partial.topicIds,
    }))
  }

  function updateSubject(value: string) {
    setSubjectId(value)
    setPaperId('')
    setTopicGroupId('')
    setSelectedSubtopicIds([])
    setPrimaryTopicId('')
    clearSmartFill()
  }

  function addQuestionCrop(file: File) {
    const preview = makeCropPreview(file)
    if (!questionFiles.length) setSmartFillCropId(preview.id)
    clearSmartFill()
    setQuestionFiles((files) => [...files, preview])
    setQuestionOrder((order) => [...order, `new:${preview.id}`])
  }

  function updateQuestionFiles(files: LocalPreview[]) {
    setQuestionFiles(files)
    clearSmartFill()
    if (!files.length) setSmartFillCropId('')
  }

  function updatePaperFile(fileState: PdfFileState) {
    if (paperFile?.file === fileState?.file) return
    questionFiles.forEach((file) => URL.revokeObjectURL(file.url))
    setPaperFile(fileState)
    setQuestionFiles([])
    setQuestionOrder([])
    setSmartFillCropId('')
    setLightbox((current) => current?.group === 'question' ? null : current)
    clearSmartFill()
    setPaperCropResetToken((value) => value + 1)
  }

  function updateMarkschemeFile(fileState: PdfFileState) {
    if (markschemeFile?.file === fileState?.file) return
    markschemeFiles.forEach((file) => URL.revokeObjectURL(file.url))
    setMarkschemeFile(fileState)
    setMarkschemeFiles([])
    setMarkschemeOrder([])
    setLightbox((current) => current?.group === 'markscheme' ? null : current)
    setMarkschemeCropResetToken((value) => value + 1)
  }

  function addMarkschemeCrop(file: File) {
    const preview = makeCropPreview(file)
    setMarkschemeFiles((files) => [...files, preview])
    setMarkschemeOrder((order) => [...order, `new:${preview.id}`])
  }

  function applyDetectedQuestionNumber(value: string, showToast = true) {
    setQuestionNumber(value)
    markSmartFillApplied({ questionNumber: value })
    if (showToast) toast.success('Question number applied.')
  }

  function applyDetectedMarks(value: string, showToast = true) {
    setMarks(value)
    markSmartFillApplied({ marks: value })
    if (showToast) toast.success('Marks applied.')
  }

  function autoApplySafeSmartFill(suggestions: SmartFillSuggestions) {
    const nextApplied: SmartFillAppliedState = { ...EMPTY_SMART_FILL_APPLIED_STATE }
    if (suggestions.questionNumber && (!questionNumber.trim() || normalizeQuestionNumber(questionNumber) === suggestions.questionNumber)) {
      setQuestionNumber(suggestions.questionNumber)
      nextApplied.questionNumber = suggestions.questionNumber
    }
    if (suggestions.marks?.confidence === 'high' && (!marks.trim() || marks.trim() === suggestions.marks.value)) {
      setMarks(suggestions.marks.value)
      nextApplied.marks = suggestions.marks.value
    }
    setSmartFillApplied(nextApplied)
    if (nextApplied.questionNumber) toast.success('Question number applied.')
    if (nextApplied.marks) toast.success('Marks applied.')
  }

  async function runSmartFill() {
    const crop = questionFiles.find((file) => file.id === effectiveSmartFillCropId) || questionFiles[0]
    if (!crop || smartFillLoading) return
    setSmartFillLoading(true)
    clearSmartFill()
    try {
      const { recognize } = await import('tesseract.js')
      const result = await recognize(crop.file, 'eng')
      const text = result.data.text.trim()
      if (!text) throw new Error('No OCR text returned')
      const suggestions = buildSmartFillSuggestions(text, topics, subjectId)
      setSmartFillSuggestions(suggestions)
      autoApplySafeSmartFill(suggestions)
      toast.success('Smart Fill suggestions ready.')
    } catch {
      toast.error('Could not read this crop. Try a clearer crop.')
    } finally {
      setSmartFillLoading(false)
    }
  }

  function applySmartFillQuestionNumber() {
    if (!smartFillSuggestions?.questionNumber) return
    applyDetectedQuestionNumber(smartFillSuggestions.questionNumber)
  }

  function applySmartFillMarks() {
    if (!smartFillSuggestions?.marks) return
    applyDetectedMarks(smartFillSuggestions.marks.value)
  }

  function applySmartFillTopic(suggestion: SmartFillTopicSuggestion, showToast = true) {
    setTopicGroupId(suggestion.groupId)
    setSelectedSubtopicIds((current) => {
      const next = current.includes(suggestion.subtopicId) ? current : [...current, suggestion.subtopicId]
      if (!primaryTopicId && next.includes(suggestion.subtopicId)) setPrimaryTopicId(suggestion.subtopicId)
      return next
    })
    setSmartFillApplied((current) => ({ ...current, topicIds: current.topicIds.includes(suggestion.subtopicId) ? current.topicIds : [...current.topicIds, suggestion.subtopicId] }))
    if (showToast) toast.success('Topic applied.')
  }

  function applyAllSmartFillSuggestions() {
    if (!smartFillSuggestions) return
    if (smartFillSuggestions.questionNumber && (!questionNumber.trim() || normalizeQuestionNumber(questionNumber) === smartFillSuggestions.questionNumber)) {
      applyDetectedQuestionNumber(smartFillSuggestions.questionNumber, false)
    }
    if (smartFillSuggestions.marks?.confidence === 'high' && (!marks.trim() || marks.trim() === smartFillSuggestions.marks.value)) {
      applyDetectedMarks(smartFillSuggestions.marks.value, false)
    }
    const newTopics = smartFillSuggestions.topics.filter((suggestion) => !selectedSubtopicIds.includes(suggestion.subtopicId))
    for (const suggestion of newTopics) applySmartFillTopic(suggestion, false)
    if (newTopics.length) toast.success(newTopics.length === 1 ? 'Topic applied.' : 'Topics applied.')
  }

  function addGlobalSubtopic(value: string) {
    if (!value) return
    addSubtopicSelection({
      subtopicId: value,
      topics,
      selectedSubtopicIds,
      primaryTopicId,
      setTopicGroupId,
      setSelectedSubtopicIds,
      setPrimaryTopicId,
    })
  }

  const filteredPapers = availablePapers.filter((paper) => !subjectId || relationLabel(paper.subjects, 'id') === subjectId)
  const mainTopicGroups = useMemo(() => topics
    .filter((topic) => !topic.parent_topic_id && topicMatchesMainScope(topic, subjectId))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)), [topics, subjectId])
  const subtopics = useMemo(() => topics
    .filter((topic) => topic.parent_topic_id === topicGroupId && topicMatchesMainScope(topic, subjectId))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)), [topics, topicGroupId, subjectId])
  const globalSubtopicOptions = useMemo(() => subtopicSearchOptions(topics, subjectId, selectedSubtopicIds), [topics, subjectId, selectedSubtopicIds])
  const selectedPaper = availablePapers.find((paper) => paper.id === paperId)
  const paperProgress = useMemo(() => buildPaperProgress(paperId, availablePaperQuestions), [paperId, availablePaperQuestions])

  const step1Complete = paperMode === 'existing' ? Boolean(subjectId && paperId) : Boolean(subjectId && newPaperTitle && newPaperYear && newPaperSession)
  const step2Complete = Boolean(paperFile && markschemeFile)
  const step3Complete = questionFiles.length > 0
  const step4Complete = markschemeFiles.length > 0
  const step5Complete = Boolean(questionNumber.trim() && topicGroupId && (selectedSubtopicIds.length || !subtopics.length))
  const readyToSubmit = step1Complete && step2Complete && step3Complete && step4Complete && step5Complete
  const effectivePrimaryTopicId = selectedSubtopicIds.includes(primaryTopicId) ? primaryTopicId : selectedSubtopicIds[0] || topicGroupId
  const smartFillQuestionApplied = Boolean(smartFillSuggestions?.questionNumber && normalizeQuestionNumber(questionNumber) === smartFillSuggestions.questionNumber)
  const smartFillMarksApplied = Boolean(smartFillSuggestions?.marks && marks.trim() === smartFillSuggestions.marks.value)
  const suggestedTopicIds = smartFillSuggestions?.topics.map((suggestion) => suggestion.subtopicId) || []
  const allSuggestedTopicsSelected = suggestedTopicIds.length > 0 && suggestedTopicIds.every((topicId) => selectedSubtopicIds.includes(topicId))
  const questionLightboxItems = orderedPreviewItems([], questionFiles, questionOrder, 'Question image')
  const markschemeLightboxItems = orderedPreviewItems([], markschemeFiles, markschemeOrder, 'Mark scheme image')
  const suggestedOrder = suggestedQuestionOrder(paperMode, paperId, availablePaperQuestions)
  const orderReference = paperQuestionReference(paperMode, paperId, availablePaperQuestions)
  const effectiveSmartFillCropId = questionFiles.some((file) => file.id === smartFillCropId) ? smartFillCropId : questionFiles[0]?.id || ''

  function clearCropPreviews() {
    questionFiles.forEach((file) => URL.revokeObjectURL(file.url))
    markschemeFiles.forEach((file) => URL.revokeObjectURL(file.url))
    setQuestionFiles([])
    setMarkschemeFiles([])
    setQuestionOrder([])
    setMarkschemeOrder([])
    setLightbox(null)
    setSmartFillCropId('')
    clearSmartFill()
    setPaperCropResetToken((value) => value + 1)
    setMarkschemeCropResetToken((value) => value + 1)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!readyToSubmit || savingModeRef.current) return

    const form = event.currentTarget
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const saveAction = submitter?.value === 'next' ? 'next' : 'save'
    const formData = new FormData(form)
    const submittedQuestionNumber = questionNumber.trim()
    const submittedQuestionOrder = Number(questionOrderValue)

    savingModeRef.current = saveAction
    setSavingMode(saveAction)
    let navigating = false

    try {
      toast.loading('Creating question…', { id: 'from-pdf-save' })
      const result = await createQuestionForPdfFlow(formData)

      if (!result.ok) {
        toast.error(readableSaveError(result.message), { id: 'from-pdf-save' })
        return
      }

      if (saveAction === 'save') {
        navigating = true
        toast.success('Question created', { id: 'from-pdf-save' })
        router.push('/dashboard/admin/question-bank')
        return
      }

      const createdPaperId = result.paperId
      const createdQuestion: PaperQuestion = {
        id: result.questionId,
        paper_id: createdPaperId,
        question_number: result.questionNumber || submittedQuestionNumber,
        question_order: result.questionOrder ?? (Number.isFinite(submittedQuestionOrder) ? submittedQuestionOrder : null),
        is_published: result.isPublished ?? published,
        is_reviewed: result.isReviewed ?? reviewed,
        created_at: result.createdAt ?? new Date().toISOString(),
        updated_at: result.updatedAt ?? new Date().toISOString(),
      }
      const nextPaperQuestions = [...availablePaperQuestions, createdQuestion]
      setAvailablePaperQuestions(nextPaperQuestions)

      if (result.paper && !availablePapers.some((paper) => paper.id === createdPaperId)) {
        setAvailablePapers((current) => [...current, result.paper as Paper])
      }

      setPaperMode('existing')
      setPaperId(createdPaperId)
      setQuestionNumber('')
      setMarks('')
      clearCropPreviews()
      setQuestionOrderValue(String(suggestedQuestionOrder('existing', createdPaperId, nextPaperQuestions)))
      toast.success('Question created. Ready for next question.', { id: 'from-pdf-save' })
      window.setTimeout(() => {
        step3Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 0)
    } catch (error) {
      toast.error(readableSaveError(error), { id: 'from-pdf-save' })
    } finally {
      if (navigating) {
        window.setTimeout(() => {
          savingModeRef.current = null
          setSavingMode(null)
        }, 3000)
      } else {
        savingModeRef.current = null
        setSavingMode(null)
      }
    }
  }

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
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
        {paperMode === 'existing' && selectedPaper ? <PaperProgressCard paper={selectedPaper} progress={paperProgress} onUseNextOrder={() => setQuestionOrderValue(String(paperProgress.nextOrder))} /> : null}
        {paperMode === 'new' ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="font-body text-sm text-[#43474d]">Paper title<input name="new_paper_title" value={newPaperTitle} onChange={(event) => setNewPaperTitle(event.target.value)} className="tsm-input mt-1 w-full" placeholder="Paper 1" /></label>
            <label className="font-body text-sm text-[#43474d]">Year<input name="new_paper_year" value={newPaperYear} onChange={(event) => setNewPaperYear(event.target.value)} inputMode="numeric" className="tsm-input mt-1 w-full" /></label>
            <SearchableSelect id="pdf-question-session" name="new_paper_session" label="Session" value={newPaperSession} onChange={setNewPaperSession} placeholder="Choose session" emptyText="No sessions found." options={[{ value: 'May', label: 'May' }, { value: 'November', label: 'November' }]} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
          </div>
        ) : null}
      </StepCard>

      <StepCard step={2} title="Load PDFs" state={!step1Complete ? 'locked' : step2Complete ? 'complete' : 'current'} helper="Select local PDFs. They are not uploaded.">
        <div className="grid gap-4 lg:grid-cols-2">
          <PdfFileInput id="paper-pdf" label="Paper PDF" selectedHelper="Question paper selected" value={paperFile} onChange={updatePaperFile} />
          <PdfFileInput id="markscheme-pdf" label="Mark scheme PDF" selectedHelper="Mark scheme selected" value={markschemeFile} onChange={updateMarkschemeFile} />
        </div>
      </StepCard>

      <div ref={step3Ref}>
        <StepCard step={3} title="Crop question images" state={!step2Complete ? 'locked' : step3Complete ? 'complete' : 'current'} helper="Crop every part needed to answer this question.">
          <PdfCropPanel key={`paper-${paperFile?.url ?? 'none'}-${paperCropResetToken}`} title="Paper PDF cropper" helper="Use this for question text, diagrams, tables, graphs, and continuation pages." fileState={paperFile} pdfType="paper" cropLabel="Question crop" addLabel="Add crop to question images" onAddCrop={addQuestionCrop} nextFileName={() => `question-${questionNumber.trim() || 'untitled'}-crop-${questionFiles.length + 1}.png`} resetToken={paperCropResetToken} />
          <div className="mt-5">
            <ImageUploadGroup title="Question image" name="question_image_file" fileKeyName="question_file_key" assetOrderName="question_asset_order" existingAssets={[]} files={questionFiles} setFiles={updateQuestionFiles} order={questionOrder} setOrder={setQuestionOrder} onPreview={(index) => setLightbox({ group: 'question', index })} />
          </div>
        </StepCard>
      </div>

      <StepCard step={4} title="Crop mark scheme images" state={!step3Complete ? 'locked' : step4Complete ? 'complete' : 'current'} helper="Crop the matching mark scheme parts for this one question.">
        <PdfCropPanel key={`markscheme-${markschemeFile?.url ?? 'none'}-${markschemeCropResetToken}`} title="Mark scheme PDF cropper" helper="Use this for mark allocations, method notes, and answer continuations." fileState={markschemeFile} pdfType="markscheme" cropLabel="Mark scheme crop" addLabel="Add crop to mark scheme images" onAddCrop={addMarkschemeCrop} nextFileName={() => `markscheme-${questionNumber.trim() || 'untitled'}-crop-${markschemeFiles.length + 1}.png`} resetToken={markschemeCropResetToken} />
        <div className="mt-5">
          <ImageUploadGroup title="Mark scheme image" name="markscheme_image_file" fileKeyName="markscheme_file_key" assetOrderName="markscheme_asset_order" existingAssets={[]} files={markschemeFiles} setFiles={setMarkschemeFiles} order={markschemeOrder} setOrder={setMarkschemeOrder} onPreview={(index) => setLightbox({ group: 'markscheme', index })} />
        </div>
      </StepCard>

      <StepCard step={5} title="Question details and topics" state={!step4Complete ? 'locked' : step5Complete ? 'complete' : 'current'} helper="Add the required labels before saving.">
        <div className="mb-5 rounded-md border border-blue-100 bg-blue-50/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-body text-sm font-semibold text-[#00152a]">Smart Fill suggestions</h3>
              <p className="mt-1 font-body text-sm text-[#43474d]">Uses OCR on the selected question crop to suggest question number, marks, and topic tags. Review before saving.</p>
              {!questionFiles.length ? <p className="mt-2 font-body text-xs font-semibold text-amber-800">Add a question crop first.</p> : null}
            </div>
            <button type="button" onClick={runSmartFill} disabled={!questionFiles.length || smartFillLoading} className="tsm-btn-primary disabled:cursor-not-allowed disabled:opacity-50">{smartFillLoading ? 'Reading crop…' : 'Smart fill from question crop'}</button>
          </div>
          {questionFiles.length > 1 ? (
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Choose question crop for Smart Fill">
              {questionFiles.map((file, index) => {
                const selected = effectiveSmartFillCropId === file.id
                return <button key={file.id} type="button" onClick={() => { setSmartFillCropId(file.id); clearSmartFill() }} className={`rounded-full border px-3 py-1 font-body text-xs font-semibold transition enabled:cursor-pointer ${selected ? 'border-blue-500 bg-white text-blue-800 ring-2 ring-blue-100' : 'border-slate-200 bg-white text-[#43474d] hover:border-blue-300 hover:bg-blue-50'}`}>Question image {index + 1}</button>
              })}
            </div>
          ) : null}
          {smartFillSuggestions ? (
            <div className="mt-4 rounded-md border border-[#c3c6ce66] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-body text-sm font-semibold text-emerald-700">OCR complete. Review each suggestion before applying.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={applyAllSmartFillSuggestions} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 font-body text-xs font-semibold text-blue-800 hover:bg-blue-100 enabled:cursor-pointer">Apply all suggestions</button>
                  <button type="button" onClick={() => clearSmartFill()} className="rounded-md border border-slate-200 px-3 py-2 font-body text-xs font-semibold text-slate-700 hover:bg-slate-50 enabled:cursor-pointer">Dismiss</button>
                </div>
              </div>
              <details className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer font-body text-sm font-semibold text-[#00152a]">Extracted text preview</summary>
                <p className="mt-2 whitespace-pre-wrap font-body text-xs text-[#43474d]">{smartFillSuggestions.text.slice(0, 1000)}</p>
              </details>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-slate-200 p-3">
                  <p className="font-body text-xs font-semibold uppercase tracking-wide text-[#6f737b]">Question number</p>
                  <p className="mt-1 font-body text-sm text-[#00152a]">{smartFillSuggestions.questionNumber || 'No suggestion found'}</p>
                  {smartFillQuestionApplied && smartFillSuggestions.questionNumber ? <p className="mt-2 rounded-md bg-emerald-50 px-2 py-1 font-body text-xs font-semibold text-emerald-700">Question number applied: {smartFillSuggestions.questionNumber}</p> : null}
                  {questionNumber && smartFillSuggestions.questionNumber && !smartFillQuestionApplied ? <p className="mt-1 font-body text-xs text-amber-800">Current value kept. Click Replace to use the OCR value.</p> : null}
                  <button type="button" onClick={applySmartFillQuestionNumber} disabled={!smartFillSuggestions.questionNumber || smartFillQuestionApplied} className={`mt-3 rounded-md border px-3 py-2 font-body text-xs font-semibold enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 ${smartFillQuestionApplied ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}`}>{smartFillQuestionApplied ? 'Applied' : questionNumber ? 'Replace' : 'Use question number'}</button>
                </div>
                <div className="rounded-md border border-slate-200 p-3">
                  <p className="font-body text-xs font-semibold uppercase tracking-wide text-[#6f737b]">Marks</p>
                  <p className="mt-1 font-body text-sm text-[#00152a]">{smartFillSuggestions.marks?.value || 'No suggestion found'}</p>
                  {smartFillSuggestions.marks ? <p className="mt-1 font-body text-xs text-[#6f737b]">{smartFillSuggestions.marks.confidence} confidence{smartFillSuggestions.marks.needsReview ? ' · Marks need review' : ''}</p> : null}
                  {smartFillSuggestions.marks && smartFillSuggestions.marks.candidates.length > 1 ? <p className="mt-1 font-body text-xs text-amber-800">Candidates: {smartFillSuggestions.marks.candidates.join(', ')}</p> : null}
                  {smartFillMarksApplied && smartFillSuggestions.marks ? <p className="mt-2 rounded-md bg-emerald-50 px-2 py-1 font-body text-xs font-semibold text-emerald-700">Marks applied: {smartFillSuggestions.marks.value}</p> : null}
                  {marks && smartFillSuggestions.marks && !smartFillMarksApplied ? <p className="mt-1 font-body text-xs text-amber-800">Current value kept. Click Replace to use the OCR value.</p> : null}
                  <button type="button" onClick={applySmartFillMarks} disabled={!smartFillSuggestions.marks || smartFillMarksApplied} className={`mt-3 rounded-md border px-3 py-2 font-body text-xs font-semibold enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 ${smartFillMarksApplied ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}`}>{smartFillMarksApplied ? 'Applied' : marks ? 'Replace' : 'Use marks'}</button>
                </div>
                <div className="rounded-md border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-body text-xs font-semibold uppercase tracking-wide text-[#6f737b]">Topics</p>
                      <p className="mt-1 font-body text-xs text-amber-800">Topic suggestions need review.</p>
                    </div>
                    <button type="button" onClick={applyAllSmartFillSuggestions} disabled={!smartFillSuggestions.topics.length || allSuggestedTopicsSelected} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 font-body text-xs font-semibold text-blue-800 hover:bg-blue-100 enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">{allSuggestedTopicsSelected ? 'Applied' : 'Apply all suggested topics'}</button>
                  </div>
                  {smartFillSuggestions.topics.length ? smartFillSuggestions.topics.map((suggestion) => {
                    const topicAlreadySelected = selectedSubtopicIds.includes(suggestion.subtopicId)
                    const topicApplied = topicAlreadySelected || smartFillApplied.topicIds.includes(suggestion.subtopicId)
                    return (
                      <div key={suggestion.subtopicId} className="mt-2 rounded-md bg-slate-50 p-2">
                        <p className="font-body text-sm font-semibold text-[#00152a]">{suggestion.groupName}</p>
                        <p className="font-body text-sm text-[#43474d]">{suggestion.subtopicName}</p>
                        <p className="mt-1 font-body text-xs text-[#6f737b]">{suggestion.confidence} confidence</p>
                        <button type="button" onClick={() => applySmartFillTopic(suggestion)} disabled={topicAlreadySelected} className={`mt-2 rounded-md border px-3 py-2 font-body text-xs font-semibold enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 ${topicApplied ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}`}>{topicAlreadySelected ? 'Already selected' : topicApplied ? 'Applied' : 'Apply topic'}</button>
                      </div>
                    )
                  }) : <p className="mt-1 font-body text-sm text-[#00152a]">No controlled topic match found</p>}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="font-body text-sm text-[#43474d]">Question number<input name="question_number" value={questionNumber} onChange={(event) => setQuestionNumber(event.target.value)} className="tsm-input mt-1 w-full" placeholder="1a" /></label>
          <label className="font-body text-sm text-[#43474d]">Order in paper<input name="question_order" value={questionOrderValue} onChange={(event) => setQuestionOrderValue(event.target.value)} inputMode="decimal" className="tsm-input mt-1 w-full" placeholder="1" /><span className="mt-1 block text-xs text-[#6f737b]">Controls where this question appears in lists. Use 1 for the first question, 2 for the next, and so on.</span><OrderInPaperHelper suggestedOrder={suggestedOrder} questions={orderReference} onUseSuggested={() => setQuestionOrderValue(String(suggestedOrder))} /></label>
          <label className="font-body text-sm text-[#43474d]">Marks<input name="marks" value={marks} onChange={(event) => setMarks(event.target.value)} inputMode="numeric" className="tsm-input mt-1 w-full" placeholder="6" /></label>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <SearchableSelect id="pdf-question-topic-group" label="Topic group" value={topicGroupId} onChange={(value) => { setTopicGroupId(value); setSelectedSubtopicIds([]); setPrimaryTopicId('') }} placeholder="Choose topic group" emptyText="No matching topic groups found." options={mainTopicGroups.map((topic) => ({ value: topic.id, label: topic.name }))} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
          <SearchableSelect id="pdf-question-subtopic" label="Add exact subtopic" value="" onChange={(value) => { if (value && !selectedSubtopicIds.includes(value)) { setSelectedSubtopicIds([...selectedSubtopicIds, value]); if (!primaryTopicId) setPrimaryTopicId(value) } }} placeholder={topicGroupId ? 'Search subtopics to add' : 'Choose a topic group first'} emptyText="No matching subtopics found." options={subtopics.filter((topic) => !selectedSubtopicIds.includes(topic.id)).map((topic) => ({ value: topic.id, label: topic.name }))} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
          <SearchableSelect id="pdf-question-global-subtopic" label="Search all subtopics in this subject" value="" onChange={addGlobalSubtopic} placeholder={subjectId ? 'Search by unit, topic, or subtopic' : 'Select a subject first.'} emptyText={subjectId ? 'No subtopics found in this subject.' : 'Select a subject first.'} options={subjectId ? globalSubtopicOptions : []} disabled={!subjectId} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={`font-body text-sm font-semibold ${readyToSubmit ? 'text-emerald-700' : 'text-amber-800'}`}>{readyToSubmit ? 'Ready to save: all required steps are complete.' : 'Not ready yet: complete the highlighted required steps.'}</p>
            <p className="mt-1 font-body text-sm text-[#6f737b]">Use Save & create next when entering multiple questions from the same paper.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <FromPdfSubmitButton readyToSubmit={readyToSubmit} savingMode={savingMode} action="save">Save question</FromPdfSubmitButton>
            <FromPdfSubmitButton readyToSubmit={readyToSubmit} savingMode={savingMode} action="next">Save & create next</FromPdfSubmitButton>
            <Link href="/dashboard/admin/question-bank" className="tsm-btn-secondary">Cancel</Link>
          </div>
        </div>
      </StepCard>
      <Lightbox state={lightbox} questionItems={questionLightboxItems} markschemeItems={markschemeLightboxItems} onClose={() => setLightbox(null)} onMove={(index) => setLightbox((current) => current ? { ...current, index } : current)} />
    </form>
  )
}
