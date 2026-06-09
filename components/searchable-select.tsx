'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

export type SearchableSelectOption = { value: string; label: string; helper?: string }

type SearchableSelectProps = {
  id: string
  name?: string
  label: string
  value: string
  options: SearchableSelectOption[]
  placeholder: string
  emptyText: string
  clearLabel?: string
  onChange: (value: string) => void
  openSelectId: string | null
  setOpenSelectId: (id: string | null) => void
}

export function SearchableSelect({ id, name, label, value, options, placeholder, emptyText, clearLabel = 'All', onChange, openSelectId, setOpenSelectId }: SearchableSelectProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const open = openSelectId === id
  const selected = options.find((option) => option.value === value)
  const filtered = useMemo(() => options.filter((option) => `${option.label} ${option.helper ?? ''}`.toLowerCase().includes(query.toLowerCase())), [options, query])
  const listOptions = useMemo(() => [{ value: '', label: clearLabel }, ...filtered], [clearLabel, filtered])

  useEffect(() => {
    if (!open) return
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => window.clearTimeout(focusTimer)
  }, [open])

  useEffect(() => {
    if (!open) return
    function closeOnOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpenSelectId(null)
    }
    function closeOnEsc(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setOpenSelectId(null)
    }
    document.addEventListener('mousedown', closeOnOutside)
    window.addEventListener('keydown', closeOnEsc)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      window.removeEventListener('keydown', closeOnEsc)
    }
  }, [open, setOpenSelectId])

  function choose(nextValue: string) {
    onChange(nextValue)
    setOpenSelectId(null)
    setQuery('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpenSelectId(id)
      setActiveIndex((current) => {
        const next = current + (event.key === 'ArrowDown' ? 1 : -1)
        return Math.max(0, Math.min(listOptions.length - 1, next))
      })
    }
    if (event.key === 'Enter' && open && listOptions[activeIndex]) {
      event.preventDefault()
      choose(listOptions[activeIndex].value)
    }
    if (event.key === 'Escape') setOpenSelectId(null)
  }

  return (
    <div ref={rootRef} className="relative font-body text-sm text-[#43474d]">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <label id={`${id}-label`} className="block">{label}</label>
      <button
        id={id}
        type="button"
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        onClick={() => { setActiveIndex(0); setOpenSelectId(open ? null : id) }}
        onKeyDown={handleKeyDown}
        className="tsm-input mt-1 flex w-full cursor-pointer items-center justify-between gap-3 text-left transition hover:border-[#735b2b] focus:outline-none focus:ring-2 focus:ring-[#735b2b]/30"
      >
        <span className={selected ? 'text-[#00152a]' : 'text-[#6f737b]'}>{selected?.label || placeholder}</span>
        <span className="text-[#735b2b]" aria-hidden="true">⌄</span>
      </button>
      {open ? (
        <div className="absolute z-30 mt-2 w-full rounded-md border border-[#c3c6ce66] bg-white p-2 shadow-lg">
          <input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }} placeholder="Search..." className="tsm-input mb-2 w-full" />
          <div id={`${id}-listbox`} role="listbox" aria-labelledby={`${id}-label`} className="max-h-64 overflow-y-auto">
            {listOptions.map((option, index) => (
              <button key={option.value || '__clear'} type="button" role="option" aria-selected={option.value === value} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option.value)} className={`block w-full rounded-sm px-3 py-2 text-left transition ${option.value === value ? 'bg-[#00152a] text-white' : index === activeIndex ? 'bg-[#f5f3ee] text-[#00152a]' : 'text-[#00152a] hover:bg-[#f5f3ee]'}`}>
                <span className="block font-semibold">{option.label}</span>
                {option.helper ? <span className={`block text-xs ${option.value === value ? 'text-[#f5f3ee]' : 'text-[#6f737b]'}`}>{option.helper}</span> : null}
              </button>
            ))}
            {!filtered.length ? <p className="px-3 py-4 text-sm text-[#6f737b]">{emptyText}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
