"use client"

import { type CSSProperties, type DragEvent, type MouseEvent, type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, Upload, ZoomIn, ZoomOut } from 'lucide-react'
import { toast } from 'sonner'

type LocalPreview = { id: string; file: File; name: string; url: string }

type PdfDocumentProxy = import('pdfjs-dist').PDFDocumentProxy

export type PdfFileState = { file: File; url: string } | null
export type PdfCropType = 'paper' | 'markscheme'
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

export function makeCropPreview(file: File): LocalPreview {
  return { id: crypto.randomUUID(), file, name: file.name, url: URL.createObjectURL(file) }
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export function PdfFileInput({ id, label, selectedHelper, value, onChange }: { id: string; label: string; selectedHelper: string; value: PdfFileState; onChange: (value: PdfFileState) => void }) {
  const [dropActive, setDropActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function setFile(file: File | undefined) {
    if (value?.url) URL.revokeObjectURL(value.url)
    if (!file) {
      onChange(null)
      return
    }
    if (!isPdfFile(file)) {
      toast.error('Please select a PDF file.')
      return
    }
    onChange({ file, url: URL.createObjectURL(file) })
  }

  function chooseDroppedFile(files: FileList) {
    const allFiles = Array.from(files)
    const firstPdf = allFiles.find(isPdfFile)
    if (allFiles.length > 1 && firstPdf) toast.warning('Only one PDF can be selected. Using the first PDF.')
    if (!firstPdf) {
      toast.error('Please select a PDF file.')
      return
    }
    setFile(firstPdf)
  }

  function handleDrop(event: DragEvent<HTMLLabelElement | HTMLDivElement>) {
    event.preventDefault()
    setDropActive(false)
    chooseDroppedFile(event.dataTransfer.files)
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setFile(file)
  }

  const dropHandlers = {
    onDragEnter: () => setDropActive(true),
    onDragOver: (event: DragEvent<HTMLLabelElement | HTMLDivElement>) => { event.preventDefault(); setDropActive(true) },
    onDragLeave: (event: DragEvent<HTMLLabelElement | HTMLDivElement>) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropActive(false) },
    onDrop: handleDrop,
  }

  if (value) {
    return (
      <div>
        <div {...dropHandlers} className={`relative overflow-hidden rounded-lg border p-5 font-body text-sm transition focus-within:ring-2 focus-within:ring-blue-300 ${dropActive ? 'border-blue-500 bg-blue-100 shadow-inner' : 'border-blue-200 bg-blue-50/70'}`}>
          <input ref={inputRef} id={id} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={handleInputChange} />
          <span className="block font-semibold text-[#00152a]">{label}</span>
          <span className="mt-2 block text-base font-semibold text-blue-800">{selectedHelper}</span>
          <span className="mt-1 block break-all text-[#43474d]">{value.file.name}</span>
          <span className="mt-1 block text-xs text-[#5f646c]">{formatFileSize(value.file.size)}</span>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} className="rounded-md border border-blue-200 bg-white px-3 py-2 font-body text-sm font-semibold text-blue-800 hover:bg-blue-50">Replace PDF</button>
            <button type="button" onClick={() => setFile(undefined)} className="rounded-md border border-red-200 bg-white px-3 py-2 font-body text-sm font-semibold text-red-700 hover:bg-red-50">Remove</button>
          </div>
          <span className="mt-3 block text-xs text-[#5f646c]">Drop another PDF here to replace this file.</span>
          {dropActive ? (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#00152a]/75 text-white backdrop-blur-[1px]">
              <Upload className="size-8" aria-hidden="true" />
              <span className="font-body text-base font-semibold">Drop PDF to replace</span>
            </span>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div>
      <label htmlFor={id} {...dropHandlers} className={`relative block cursor-pointer overflow-hidden rounded-lg border-2 border-dashed p-5 text-center font-body text-sm text-[#43474d] transition focus-within:ring-2 focus-within:ring-blue-300 ${dropActive ? 'border-blue-500 bg-blue-100 shadow-inner' : 'border-blue-200 bg-blue-50/50 hover:border-blue-400 hover:bg-blue-50'}`}>
        <span className="block font-semibold text-[#00152a]">{label}</span>
        <span className="mt-2 block text-base font-semibold text-blue-800">Drag a PDF here or click to upload</span>
        <span className="mt-1 block">No PDF selected yet.</span>
        <span className="mt-1 block text-xs text-[#5f646c]">Use the question paper PDF or mark scheme PDF for cropping.</span>
        {dropActive ? (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#00152a]/75 text-white backdrop-blur-[1px]">
            <Upload className="size-8" aria-hidden="true" />
            <span className="font-body text-base font-semibold">Drop PDF to upload</span>
          </span>
        ) : null}
        <input ref={inputRef} id={id} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={handleInputChange} />
      </label>
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

export function PdfCropPanel({ title, helper, fileState, pdfType, cropLabel, addLabel, onAddCrop, nextFileName }: PdfCropPanelProps) {
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const [pdf, setPdf] = useState<PdfDocumentProxy | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [zoom, setZoom] = useState(1.2)
  const [crop, setCrop] = useState<CropRect>(null)
  const [interaction, setInteraction] = useState<CropInteraction | null>(null)
  const [loading, setLoading] = useState(Boolean(fileState?.url))
  const [error, setError] = useState<string | null>(null)

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
    const pdfUrl = fileState?.url ?? ''
    if (!pdfUrl) return

    let cancelled = false
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
          <p className="mt-1 font-body text-sm text-[#43474d]">{helper}</p>
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
