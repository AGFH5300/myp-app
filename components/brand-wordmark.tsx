import Link from 'next/link'
import { BrandMark } from '@/components/brand-mark'

export function BrandWordmark({ href = '/', className = '' }: { href?: string; className?: string }) {
  return (
    <Link href={href} aria-label="MYP Atlas" className={`inline-flex items-center gap-2 font-headline tracking-tight text-[#00152a] ${className}`.trim()}>
      <BrandMark className="h-7 w-auto" />
      <span>MYP Atlas</span>
    </Link>
  )
}
