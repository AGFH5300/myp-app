"use client"

import { type CSSProperties, type FormEvent, type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createQuestionForPdfFlow } from './actions'
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
  type LightboxState,
  type LocalPreview,
  paperQuestionReference,
  suggestedQuestionOrder,
  type Paper,
  type PaperQuestion,
  type Subject,
  type Topic,
} from './form'

type PdfDocumentProxy = import('pdfjs-dist').PDFDocumentProxy

type PdfFileState = { file: File; url: string } | null
type PdfCropType = 'paper' | 'markscheme'
type ActiveCropRect = { pdfType: PdfCropType; pageNumber: number; x: number; y: number; width: number; height: number }
type CropRect = ActiveCropRect | null
type CropHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
type CropInteraction =
  | { mode: 'draw'; pageNumber: number; startX: number; startY: number }
  | { mode: 'move'; pageNumber: number; startX: number; startY: number; original: ActiveCropRect }
  | { mode: 'resize'; pageNumber: number; handle: CropHandle; startX: number; startY: number; original: ActiveCropRect }

const MIN_CROP_SIZE = 16
const HANDLE_CLASS = 'absolute h-3 w-3 rounded-sm border border-white bg-blue-700 shadow-sm'
const HANDLE_CURSOR_STYLES: Record<CropHandle, CSSProperties['cursor']> = { nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize', se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize' }

type PdfCropPanelProps = {
  title: string
  helper: string
  fileState: PdfFileState
  pdfType: PdfCropType
  cropLabel: string
  addLabel: string
  onAddCrop: (file: File) => void
  nextFileName: () => string
  resetToken: number
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
      
    </div>
  )
}

function PdfPageCanvas({ pdf, pageNumber, zoom, canUsePdf, crop, canAddCrop, addLabel, invalidMessage, onBeginCrop, onBeginMoveCrop, onBeginResizeCrop, onUpdateCrop, onFinishCrop, onAddCrop, registerCanvas, onRenderError }: { pdf: PdfDocumentProxy; pageNumber: number; zoom: number; canUsePdf: boolean; crop: CropRect; canAddCrop: boolean; addLabel: string; invalidMessage: string | null; onBeginCrop: (event: MouseEvent<HTMLDivElement>, pageNumber: number) => void; onBeginMoveCrop: (event: MouseEvent<HTMLDivElement>, crop: ActiveCropRect) => void; onBeginResizeCrop: (event: MouseEvent<HTMLButtonElement>, crop: ActiveCropRect, handle: CropHandle) => void; onUpdateCrop: (event: MouseEvent<HTMLDivElement>, pageNumber: number) => void; onFinishCrop: () => void; onAddCrop: () => void; registerCanvas: (pageNumber: number, canvas: HTMLCanvasElement | null) => void; onRenderError: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null)
  const [rendering, setRendering] = useState(false)
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    let cancelled = false
    async function renderPage() {
      const canvas = canvasRef.current
      if (!canvas) return
      setRendering(true)
      renderTaskRef.current?.cancel()
      try {
        const page = await pdf.getPage(pageNumber)
        if (cancelled) return
        const viewport = page.getViewport({ scale: zoom })
        const renderScale = 2
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Missing canvas context')
        canvas.width = Math.round(viewport.width * renderScale)
        canvas.height = Math.round(viewport.height * renderScale)
        const displayWidth = Math.round(viewport.width)
        const displayHeight = Math.round(viewport.height)
        canvas.style.width = `${displayWidth}px`
        canvas.style.height = `${displayHeight}px`
        setPageSize({ width: displayWidth, height: displayHeight })
        context.setTransform(renderScale, 0, 0, renderScale, 0, 0)
        const task = page.render({ canvas, canvasContext: context, viewport })
        renderTaskRef.current = task
        await task.promise
      } catch (renderError) {
        if (!cancelled && !(renderError instanceof Error && renderError.name === 'RenderingCancelledException')) onRenderError()
      } finally {
        if (!cancelled) setRendering(false)
      }
    }
    renderPage()
    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
    }
  }, [pdf, pageNumber, zoom, onRenderError])

  const activeCrop = crop?.pageNumber === pageNumber ? crop : null
  const cropCursorStyle: CSSProperties = { cursor: 'move' }
  const canvasWidth = pageSize.width
  const canvasHeight = pageSize.height
  const buttonWidth = 176
  const floatingLeft = activeCrop ? Math.min(Math.max(activeCrop.x, 4), Math.max(4, canvasWidth - buttonWidth - 4)) : 0
  const belowCropTop = activeCrop ? activeCrop.y + activeCrop.height + 8 : 0
  const floatingTop = activeCrop ? (belowCropTop + 36 <= canvasHeight ? belowCropTop : Math.max(4, activeCrop.y - 44)) : 0
  const cropHandles: Array<{ handle: CropHandle; className: string; style: CSSProperties }> = activeCrop ? [
    { handle: 'nw', className: '-left-1.5 -top-1.5', style: {} },
    { handle: 'n', className: 'left-1/2 -top-1.5', style: { transform: 'translateX(-50%)' } },
    { handle: 'ne', className: '-right-1.5 -top-1.5', style: {} },
    { handle: 'e', className: '-right-1.5 top-1/2', style: { transform: 'translateY(-50%)' } },
    { handle: 'se', className: '-bottom-1.5 -right-1.5', style: {} },
    { handle: 's', className: '-bottom-1.5 left-1/2', style: { transform: 'translateX(-50%)' } },
    { handle: 'sw', className: '-bottom-1.5 -left-1.5', style: {} },
    { handle: 'w', className: '-left-1.5 top-1/2', style: { transform: 'translateY(-50%)' } },
  ] : []

  return (
    <div className="mx-auto w-fit rounded-md border border-slate-200 bg-slate-50 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3 font-body text-xs text-[#43474d]">
        <span className="rounded-full bg-white px-2 py-1 font-semibold text-[#00152a]">Page {pageNumber}</span>
        {rendering ? <span className="text-blue-700">Rendering…</span> : null}
      </div>
      <div className="relative inline-block select-none" onMouseDown={(event) => onBeginCrop(event, pageNumber)} onMouseMove={(event) => onUpdateCrop(event, pageNumber)} onMouseUp={onFinishCrop} onMouseLeave={onFinishCrop}>
        <canvas ref={(canvas) => { canvasRef.current = canvas; registerCanvas(pageNumber, canvas) }} className={`block bg-white shadow-sm ${canUsePdf && !rendering ? 'cursor-crosshair' : 'cursor-not-allowed opacity-60'}`} />
        {activeCrop ? (
          <>
            <div
              className="absolute border-2 border-blue-600 bg-blue-500/15 shadow-[0_0_0_9999px_rgba(15,23,42,0.12)]"
              style={{ left: activeCrop.x, top: activeCrop.y, width: activeCrop.width, height: activeCrop.height, ...cropCursorStyle }}
              onMouseDown={(event) => onBeginMoveCrop(event, activeCrop)}
            >
              {cropHandles.map(({ handle, className, style }) => (
                <button
                  key={handle}
                  type="button"
                  aria-label={`Resize crop ${handle}`}
                  className={`${HANDLE_CLASS} ${className}`}
                  style={{ ...style, cursor: HANDLE_CURSOR_STYLES[handle] }}
                  onMouseDown={(event) => onBeginResizeCrop(event, activeCrop, handle)}
                />
              ))}
            </div>
            <div className="absolute z-10 max-w-[220px]" style={{ left: floatingLeft, top: floatingTop }} onMouseDown={(event) => event.stopPropagation()}>
              <button type="button" onClick={onAddCrop} disabled={!canAddCrop} className="rounded-md bg-blue-700 px-3 py-2 font-body text-xs font-semibold text-white shadow-lg transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">
                {addLabel}
              </button>
              {invalidMessage ? <p className="mt-1 rounded bg-white/95 px-2 py-1 font-body text-xs font-semibold text-amber-800 shadow-sm">{invalidMessage}</p> : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function PdfCropPanel({ title, helper, fileState, pdfType, cropLabel, addLabel, onAddCrop, nextFileName, resetToken }: PdfCropPanelProps) {
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const [pdf, setPdf] = useState<PdfDocumentProxy | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [zoom, setZoom] = useState(1.2)
  const [crop, setCrop] = useState<CropRect>(null)
  const [interaction, setInteraction] = useState<CropInteraction | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCrop(null)
      setInteraction(null)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [resetToken])

  useEffect(() => {
    if (!crop) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setCrop(null)
        setInteraction(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [crop])

  useEffect(() => {
    // Reset PDF viewer state when the local object URL changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPdf(null)
    setPageCount(0)
    setCrop(null)
    setError(null)
    canvasRefs.current.clear()
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
    }
  }, [fileState?.url])

  function changeZoom(nextZoom: (current: number) => number) {
    setCrop(null)
    setInteraction(null)
    setZoom(nextZoom)
  }

  const pageNumbers = useMemo(() => Array.from({ length: pageCount }, (_, index) => index + 1), [pageCount])

  function registerCanvas(pageNumber: number, canvas: HTMLCanvasElement | null) {
    if (canvas) canvasRefs.current.set(pageNumber, canvas)
    else canvasRefs.current.delete(pageNumber)
  }

  const handleRenderError = useCallback(() => {
    setError('Could not render a PDF page. Try changing zoom or selecting another PDF.')
  }, [])

  function pageBounds(pageNumber: number) {
    const rect = canvasRefs.current.get(pageNumber)?.getBoundingClientRect()
    return { width: rect?.width ?? 0, height: rect?.height ?? 0 }
  }

  function pointFromEvent(event: MouseEvent<HTMLElement>, pageNumber: number) {
    const rect = canvasRefs.current.get(pageNumber)?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: Math.max(0, Math.min(event.clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(event.clientY - rect.top, rect.height)),
    }
  }

  function clampCrop(nextCrop: ActiveCropRect): ActiveCropRect {
    const bounds = pageBounds(nextCrop.pageNumber)
    const width = Math.min(Math.max(2, nextCrop.width), bounds.width || nextCrop.width)
    const height = Math.min(Math.max(2, nextCrop.height), bounds.height || nextCrop.height)
    return {
      ...nextCrop,
      width,
      height,
      x: Math.max(0, Math.min(nextCrop.x, Math.max(0, bounds.width - width))),
      y: Math.max(0, Math.min(nextCrop.y, Math.max(0, bounds.height - height))),
    }
  }

  function cropFromResize(interactionState: Extract<CropInteraction, { mode: 'resize' }>, point: { x: number; y: number }) {
    const { original, handle } = interactionState
    const right = original.x + original.width
    const bottom = original.y + original.height
    let left = original.x
    let top = original.y
    let nextRight = right
    let nextBottom = bottom

    if (handle.includes('w')) left = Math.min(point.x, right - 2)
    if (handle.includes('e')) nextRight = Math.max(point.x, left + 2)
    if (handle.includes('n')) top = Math.min(point.y, bottom - 2)
    if (handle.includes('s')) nextBottom = Math.max(point.y, top + 2)

    return clampCrop({ ...original, x: left, y: top, width: nextRight - left, height: nextBottom - top })
  }

  function beginCrop(event: MouseEvent<HTMLDivElement>, pageNumber: number) {
    if (!pdf || loading || event.button !== 0) return
    const point = pointFromEvent(event, pageNumber)
    setInteraction({ mode: 'draw', pageNumber, startX: point.x, startY: point.y })
    setCrop({ pdfType, pageNumber, x: point.x, y: point.y, width: 0, height: 0 })
  }

  function beginMoveCrop(event: MouseEvent<HTMLDivElement>, activeCrop: ActiveCropRect) {
    if (!pdf || loading || event.button !== 0) return
    event.stopPropagation()
    const point = pointFromEvent(event, activeCrop.pageNumber)
    setInteraction({ mode: 'move', pageNumber: activeCrop.pageNumber, startX: point.x, startY: point.y, original: activeCrop })
  }

  function beginResizeCrop(event: MouseEvent<HTMLButtonElement>, activeCrop: ActiveCropRect, handle: CropHandle) {
    if (!pdf || loading || event.button !== 0) return
    event.stopPropagation()
    const point = pointFromEvent(event, activeCrop.pageNumber)
    setInteraction({ mode: 'resize', pageNumber: activeCrop.pageNumber, handle, startX: point.x, startY: point.y, original: activeCrop })
  }

  function updateCrop(event: MouseEvent<HTMLDivElement>, pageNumber: number) {
    if (!interaction || interaction.pageNumber !== pageNumber) return
    const point = pointFromEvent(event, pageNumber)

    if (interaction.mode === 'draw') {
      setCrop(clampCrop({
        pdfType,
        pageNumber,
        x: Math.min(interaction.startX, point.x),
        y: Math.min(interaction.startY, point.y),
        width: Math.abs(point.x - interaction.startX),
        height: Math.abs(point.y - interaction.startY),
      }))
      return
    }

    if (interaction.mode === 'move') {
      const dx = point.x - interaction.startX
      const dy = point.y - interaction.startY
      setCrop(clampCrop({ ...interaction.original, x: interaction.original.x + dx, y: interaction.original.y + dy }))
      return
    }

    setCrop(cropFromResize(interaction, point))
  }

  function finishCrop() {
    setInteraction(null)
    setCrop((current) => current && current.width >= 2 && current.height >= 2 ? current : null)
  }

  function addCrop() {
    if (!canAddCrop || !crop) return
    const canvas = canvasRefs.current.get(crop.pageNumber)
    if (!canvas) return
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
      toast.success(`${cropLabel} added from page ${crop.pageNumber}.`)
    }, 'image/png')
  }

  const canUsePdf = Boolean(pdf && !loading && !error)
  const canAddCrop = Boolean(crop && crop.width >= MIN_CROP_SIZE && crop.height >= MIN_CROP_SIZE && canUsePdf)
  const canZoomOut = canUsePdf && zoom > 0.7
  const canResetZoom = canUsePdf && zoom !== 1.2
  const canZoomIn = canUsePdf && zoom < 2.4
  const cropInvalidMessage = crop && !canAddCrop ? 'Crop area is too small.' : null
  const floatingAddLabel = pdfType === 'paper' ? 'Add question crop' : 'Add mark scheme crop'

  return (
    <div className="rounded-md border border-[#c3c6ce66] bg-[#fbf9f4] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-headline text-2xl text-[#00152a]">{title}</h3>
          <p className="mt-1 font-body text-sm text-[#43474d]">Drag to select an area. Adjust the crop, then add it.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-label="Zoom out" onClick={() => changeZoom((value) => Math.max(0.7, Number((value - 0.2).toFixed(1))))} disabled={!canZoomOut} className="rounded-md border border-[#c3c6ce66] bg-white p-2 text-[#00152a] shadow-sm transition hover:bg-slate-50 enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"><ZoomOut className="h-4 w-4" aria-hidden="true" /></button>
          <button type="button" aria-label="Reset zoom" onClick={() => changeZoom(() => 1.2)} disabled={!canResetZoom} className="rounded-md border border-[#c3c6ce66] bg-white p-2 text-[#00152a] shadow-sm transition hover:bg-slate-50 enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw className="h-4 w-4" aria-hidden="true" /></button>
          <button type="button" aria-label="Zoom in" onClick={() => changeZoom((value) => Math.min(2.4, Number((value + 0.2).toFixed(1))))} disabled={!canZoomIn} className="rounded-md border border-[#c3c6ce66] bg-white p-2 text-[#00152a] shadow-sm transition hover:bg-slate-50 enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"><ZoomIn className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-3 font-body text-sm text-[#43474d]">
        <span><b>{pageCount ? `${pageCount} page${pageCount === 1 ? '' : 's'}` : 'No pages loaded'}</b></span>
        <span><b>Zoom {Math.round(zoom * 100)}%</b></span>
        {crop ? <span className="font-semibold text-blue-700">Current crop: page {crop.pageNumber}</span> : null}
        {loading ? <span className="font-semibold text-blue-700">Loading…</span> : null}
      </div>
      {error ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700">{error}</p> : null}
      {!fileState ? <p className="mt-4 rounded-md border border-slate-200 bg-white px-4 py-8 text-center font-body text-sm text-slate-500">Select a local PDF in Step 2 to enable cropping.</p> : null}
      {fileState ? (
        <div className="mt-4 max-h-[70vh] overflow-auto rounded-md border border-slate-200 bg-white p-4">
          {pdf ? (
            <div className="space-y-5">
              {pageNumbers.map((pageNumber) => (
                <PdfPageCanvas key={`${fileState.url}-${pageNumber}`} pdf={pdf} pageNumber={pageNumber} zoom={zoom} canUsePdf={canUsePdf} crop={crop} canAddCrop={canAddCrop} addLabel={floatingAddLabel} invalidMessage={cropInvalidMessage} onBeginCrop={beginCrop} onBeginMoveCrop={beginMoveCrop} onBeginResizeCrop={beginResizeCrop} onUpdateCrop={updateCrop} onFinishCrop={finishCrop} onAddCrop={addCrop} registerCanvas={registerCanvas} onRenderError={handleRenderError} />
              ))}
            </div>
          ) : <p className="rounded-md border border-slate-200 bg-white px-4 py-8 text-center font-body text-sm text-slate-500">Loading PDF pages…</p>}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={addCrop} disabled={!canAddCrop} className="tsm-btn-primary disabled:cursor-not-allowed disabled:opacity-50">{addLabel}</button>
        <button type="button" onClick={() => setCrop(null)} disabled={!crop} className="tsm-btn-secondary disabled:cursor-not-allowed disabled:opacity-50">Clear current crop</button>
      </div>
    </div>
  )
}


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

export function QuestionFromPdfForm({ papers, subjects, topics, paperQuestions = [] }: { papers: Paper[]; subjects: Subject[]; topics: Topic[]; paperQuestions?: PaperQuestion[] }) {
  const router = useRouter()
  const defaultSubjectId = subjects.find((subject) => subject.name === 'Mathematics Extended')?.id || subjects.find((subject) => subject.name === 'Mathematics')?.id || subjects[0]?.id || ''
  const [paperMode, setPaperMode] = useState<'existing' | 'new'>('existing')
  const [availablePapers, setAvailablePapers] = useState<Paper[]>(papers)
  const [availablePaperQuestions, setAvailablePaperQuestions] = useState<PaperQuestion[]>(paperQuestions)
  const [subjectId, setSubjectId] = useState(defaultSubjectId)
  const [paperId, setPaperId] = useState('')
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
  const [cropResetToken, setCropResetToken] = useState(0)
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
    setTopicGroupId((current) => current || suggestion.groupId)
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

  const filteredPapers = availablePapers.filter((paper) => !subjectId || relationLabel(paper.subjects, 'id') === subjectId)
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
    setCropResetToken((value) => value + 1)
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
          <PdfFileInput id="paper-pdf" label="Paper PDF" value={paperFile} onChange={setPaperFile} />
          <PdfFileInput id="markscheme-pdf" label="Mark scheme PDF" value={markschemeFile} onChange={setMarkschemeFile} />
        </div>
      </StepCard>

      <div ref={step3Ref}>
        <StepCard step={3} title="Crop question images" state={!step2Complete ? 'locked' : step3Complete ? 'complete' : 'current'} helper="Crop every part needed to answer this question.">
          <PdfCropPanel title="Paper PDF cropper" helper="Use this for question text, diagrams, tables, graphs, and continuation pages." fileState={paperFile} pdfType="paper" cropLabel="Question crop" addLabel="Add crop to question images" onAddCrop={addQuestionCrop} nextFileName={() => `question-${questionNumber.trim() || 'untitled'}-crop-${questionFiles.length + 1}.png`} resetToken={cropResetToken} />
          <div className="mt-5">
            <ImageUploadGroup title="Question image" name="question_image_file" fileKeyName="question_file_key" assetOrderName="question_asset_order" existingAssets={[]} files={questionFiles} setFiles={updateQuestionFiles} order={questionOrder} setOrder={setQuestionOrder} onPreview={(index) => setLightbox({ group: 'question', index })} />
          </div>
        </StepCard>
      </div>

      <StepCard step={4} title="Crop mark scheme images" state={!step3Complete ? 'locked' : step4Complete ? 'complete' : 'current'} helper="Crop the matching mark scheme parts for this one question.">
        <PdfCropPanel title="Mark scheme PDF cropper" helper="Use this for mark allocations, method notes, and answer continuations." fileState={markschemeFile} pdfType="markscheme" cropLabel="Mark scheme crop" addLabel="Add crop to mark scheme images" onAddCrop={addMarkschemeCrop} nextFileName={() => `markscheme-${questionNumber.trim() || 'untitled'}-crop-${markschemeFiles.length + 1}.png`} resetToken={cropResetToken} />
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
