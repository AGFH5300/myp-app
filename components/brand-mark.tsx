import Image from 'next/image'

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <Image
      src="/myp-atlas-icon.svg"
      alt=""
      aria-hidden="true"
      width={648}
      height={484}
      className={`block shrink-0 ${className}`.trim()}
    />
  )
}
