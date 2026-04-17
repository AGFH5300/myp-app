import Link from 'next/link'

export function BrandWordmark({ href = '/', className = '' }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`font-headline tracking-tight text-[#00152a] ${className}`.trim()}>
      MYP Atlas
    </Link>
  )
}
