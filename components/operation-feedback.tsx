'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import Link, { type LinkProps } from 'next/link'
import { Loader2 } from 'lucide-react'

type PendingLabelProps = {
  pending: boolean
  pendingText: string
  children: ReactNode
  spinnerClassName?: string
}

export function PendingLabel({ pending, pendingText, children, spinnerClassName = 'size-4' }: PendingLabelProps) {
  return pending ? <><Loader2 className={`${spinnerClassName} animate-spin`} aria-hidden="true" /><span aria-live="polite">{pendingText}</span></> : <>{children}</>
}

type PendingActionLinkProps = LinkProps & {
  className?: string
  children: ReactNode
  onStart?: () => void
}

export function PendingActionLink({ children, onStart, className = '', ...props }: PendingActionLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        props.onClick?.(event)
        if (!event.defaultPrevented) onStart?.()
      }}
      className={className}
    >
      {children}
    </Link>
  )
}

type ConfirmDialogProps = {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  pending?: boolean
  pendingLabel?: string
  error?: string | null
  confirmClassName?: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({ open, title, body, confirmLabel, pending = false, pendingLabel = 'Working…', error, confirmClassName = 'bg-amber-700 text-white hover:bg-amber-800', onConfirm, onClose }: ConfirmDialogProps) {
  const titleId = useId()
  const bodyId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previousActiveElement = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.setTimeout(() => cancelRef.current?.focus(), 0)

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending) onClose()
      if (event.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousActiveElement?.focus?.()
    }
  }, [open, pending, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 px-4 py-6" onMouseDown={() => { if (!pending) onClose() }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} className="w-full max-w-lg rounded-lg border border-[#c3c6ce66] bg-white p-6 font-body text-[#43474d] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id={titleId} className="font-headline text-3xl text-[#00152a]">{title}</h2>
        <p id={bodyId} className="mt-3 text-sm leading-6">{body}</p>
        {error ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" aria-live="assertive">{error}</p> : null}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button ref={cancelRef} type="button" onClick={onClose} disabled={pending} className="tsm-btn-secondary disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={pending} className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmClassName}`}>
            <PendingLabel pending={pending} pendingText={pendingLabel}>{confirmLabel}</PendingLabel>
          </button>
        </div>
      </div>
    </div>
  )
}
