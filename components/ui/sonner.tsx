'use client'

import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--surface-container-lowest)',
          '--normal-text': 'var(--text)',
          '--normal-border': 'var(--outline)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
