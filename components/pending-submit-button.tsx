"use client"

import { useFormStatus } from 'react-dom'

type PendingSubmitButtonProps = {
  className?: string
  label: string
  pendingLabel: string
  disabled?: boolean
}

export function PendingSubmitButton({ className, label, pendingLabel, disabled }: PendingSubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <button type="submit" className={className} disabled={disabled || pending}>
      {pending ? pendingLabel : label}
    </button>
  )
}
