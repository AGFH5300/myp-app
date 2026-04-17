'use client'

import { adsConfig } from '@/lib/ads'

type AdSlotProps = {
  slot: string
  label?: string
  className?: string
  minHeight?: number
}

export function AdSlot({ slot, label = 'Sponsored', className = '', minHeight = 110 }: AdSlotProps) {
  if (!adsConfig.enabled) {
    return (
      <aside className={`rounded-md border border-[#c3c6ce66] bg-[#f5f3ee] p-4 ${className}`} aria-label={`${label} placeholder`}>
        <p className="font-label text-[10px] uppercase tracking-[0.18em] text-[#43474d]">{label}</p>
        <div className="mt-2 flex items-center justify-center rounded-sm border border-dashed border-[#c3c6ce] bg-white" style={{ minHeight }}>
          <p className="font-body text-sm text-[#43474d]">Ad slot: {slot}</p>
        </div>
      </aside>
    )
  }

  if (adsConfig.provider === 'adsense' && adsConfig.clientId) {
    return (
      <aside className={className} aria-label={label}>
        <ins
          className="adsbygoogle block rounded-md border border-[#c3c6ce33] bg-white"
          style={{ minHeight }}
          data-ad-client={adsConfig.clientId}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </aside>
    )
  }

  return (
    <aside className={`rounded-md border border-[#c3c6ce66] bg-[#f5f3ee] p-4 ${className}`} aria-label={`${label} placeholder`}>
      <p className="font-label text-[10px] uppercase tracking-[0.18em] text-[#43474d]">{label}</p>
      <div className="mt-2 flex items-center justify-center rounded-sm border border-dashed border-[#c3c6ce] bg-white" style={{ minHeight }}>
        <p className="font-body text-sm text-[#43474d]">Configure {adsConfig.provider} for slot {slot}</p>
      </div>
    </aside>
  )
}
