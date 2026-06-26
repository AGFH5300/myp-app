'use client'

import { ArrowUp } from 'lucide-react'
import { useEffect, useState } from 'react'

export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    function updateVisibility() {
      setIsVisible(window.scrollY > 400)
    }

    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })
    return () => window.removeEventListener('scroll', updateVisibility)
  }, [])

  function scrollToTop() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  if (!isVisible) return null

  return (
    <button
      type="button"
      onClick={scrollToTop}
      className="fixed bottom-5 right-5 z-40 inline-flex cursor-pointer items-center gap-2 rounded-sm border border-[#735b2b] bg-[#00152a] px-3 py-2 font-body text-sm font-semibold text-white shadow-lg transition hover:bg-[#17324a] focus:outline-none focus:ring-2 focus:ring-[#735b2b] focus:ring-offset-2"
      aria-label="Back to top"
    >
      <ArrowUp aria-hidden="true" className="size-4" />
      <span>Back to top</span>
    </button>
  )
}
