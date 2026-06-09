"use client"

import { useState } from 'react'
import { SearchableSelect, type SearchableSelectOption } from '@/components/searchable-select'

export function PaperTopicFilterForm({ selectedTopic, topics }: { selectedTopic: string; topics: SearchableSelectOption[] }) {
  const [openSelectId, setOpenSelectId] = useState<string | null>(null)
  const [topic, setTopic] = useState(selectedTopic)

  return (
    <form className="flex items-end gap-2">
      <div className="min-w-56">
        <SearchableSelect id="paper-detail-topic" name="topic" label="Topic" value={topic} onChange={setTopic} placeholder="All topics" emptyText="No matching topics found." options={topics} openSelectId={openSelectId} setOpenSelectId={setOpenSelectId} />
      </div>
      <button type="submit" className="tsm-btn-secondary mb-0.5">Filter</button>
    </form>
  )
}
