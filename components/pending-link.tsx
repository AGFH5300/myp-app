"use client"

import Link from 'next/link'
import { ReactNode, useState } from 'react'

type PendingLinkProps = {
  href: string
  className?: string
  children: ReactNode
  pendingChildren: ReactNode
}

export function PendingLink({ href, className, children, pendingChildren }: PendingLinkProps) {
  const [pending, setPending] = useState(false)

  return (
    <Link
      href={href}
      className={`${className ?? ''} ${pending ? 'pointer-events-none opacity-70' : ''}`}
      aria-disabled={pending}
      onClick={() => setPending(true)}
    >
      {pending ? pendingChildren : children}
    </Link>
  )
}
