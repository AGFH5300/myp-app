"use client"

import Image from 'next/image'
import { useState } from 'react'

export type QuestionImageViewerItem = {
  url: string
  alt: string
}

type QuestionImageViewerProps = {
  images: QuestionImageViewerItem[]
  labelPrefix: string
}

export function QuestionImageViewer({ images, labelPrefix }: QuestionImageViewerProps) {
  const [index, setIndex] = useState(0)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const image = images[index]
  const hasMultipleImages = images.length > 1

  if (!image) return null

  const label = `${labelPrefix} ${index + 1} of ${images.length}`
  const goToPrevious = () => setIndex((current) => Math.max(0, current - 1))
  const goToNext = () => setIndex((current) => Math.min(images.length - 1, current + 1))

  return (
    <div className="max-w-5xl rounded-md border border-[#c3c6ce66] bg-[#fbf9f4] p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-body text-sm font-semibold text-[#43474d]">{label}</p>
        <div className="flex flex-wrap gap-2">
          {hasMultipleImages ? (
            <>
              <button type="button" onClick={goToPrevious} disabled={index === 0} className="rounded-md border border-[#c3c6ce66] bg-white px-3 py-2 font-body text-sm text-[#00152a] disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
              <button type="button" onClick={goToNext} disabled={index === images.length - 1} className="rounded-md border border-[#c3c6ce66] bg-white px-3 py-2 font-body text-sm text-[#00152a] disabled:cursor-not-allowed disabled:opacity-40">Next</button>
            </>
          ) : null}
          <button type="button" onClick={() => setIsPreviewOpen(true)} className="rounded-md border border-[#735b2b] bg-white px-3 py-2 font-body text-sm font-semibold text-[#735b2b]">Open larger preview</button>
        </div>
      </div>

      <button type="button" onClick={() => setIsPreviewOpen(true)} className="mt-3 flex w-full items-center justify-center rounded-md border border-[#c3c6ce66] bg-white p-2 focus:outline-none focus:ring-2 focus:ring-[#735b2b]/30" aria-label={`Open larger preview for ${label}`}>
        <Image src={image.url} alt={image.alt} width={1200} height={800} unoptimized className="max-h-[420px] w-auto max-w-full object-contain sm:max-h-[560px]" />
      </button>

      {hasMultipleImages ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label={`${labelPrefix} thumbnails`}>
          {images.map((item, itemIndex) => (
            <button key={`${item.url}-${itemIndex}`} type="button" onClick={() => setIndex(itemIndex)} className={`shrink-0 rounded-md border bg-white p-1 focus:outline-none focus:ring-2 focus:ring-[#735b2b]/30 ${itemIndex === index ? 'border-[#735b2b]' : 'border-[#c3c6ce66]'}`} aria-label={`Show ${labelPrefix.toLowerCase()} ${itemIndex + 1}`} aria-current={itemIndex === index ? 'true' : undefined}>
              <Image src={item.url} alt="" width={96} height={72} unoptimized className="h-16 w-20 object-contain" />
            </button>
          ))}
        </div>
      ) : null}

      {isPreviewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={label}>
          <div className="max-h-full w-full max-w-6xl overflow-auto rounded-md bg-white p-3 shadow-xl sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-body text-sm font-semibold text-[#00152a]">{label}</p>
              <button type="button" onClick={() => setIsPreviewOpen(false)} className="rounded-md border border-[#c3c6ce66] px-3 py-2 font-body text-sm text-[#00152a]">Close</button>
            </div>
            <div className="flex max-h-[82vh] items-center justify-center overflow-auto bg-[#fbf9f4]">
              <Image src={image.url} alt={image.alt} width={1600} height={1100} unoptimized className="h-auto max-h-[82vh] w-auto max-w-full object-contain" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
