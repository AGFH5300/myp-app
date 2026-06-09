'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { AppIcon } from '@/components/app-icon'
import { Toaster } from '@/components/ui/toaster'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export type BookmarkActionState = {
  bookmarked: boolean
  message?: string
  error?: string
}

type QuestionBookmarkButtonProps = {
  action: (state: BookmarkActionState, formData: FormData) => Promise<BookmarkActionState>
  initialBookmarked: boolean
  questionId: string
  paperId: string
}

function BookmarkSubmitButton({ bookmarked }: { bookmarked: boolean }) {
  const { pending } = useFormStatus()
  const label = pending ? 'Saving…' : bookmarked ? 'Bookmarked' : 'Bookmark'

  return (
    <button
      type="submit"
      aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark question'}
      aria-pressed={bookmarked}
      disabled={pending}
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 font-body text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#735b2b]/30 disabled:cursor-not-allowed disabled:opacity-70',
        bookmarked
          ? 'border-[#735b2b] bg-[#735b2b] text-white shadow-sm'
          : 'border-[#c3c6ce66] bg-white text-[#735b2b] hover:border-[#735b2b] hover:bg-[#f5f3ee]',
      )}
    >
      <AppIcon name="bookmark" className={cn('size-4', bookmarked ? 'fill-current' : pending ? 'animate-pulse' : '')} />
      {label}
    </button>
  )
}

export function QuestionBookmarkButton({ action, initialBookmarked, questionId, paperId }: QuestionBookmarkButtonProps) {
  const [state, formAction] = useActionState(action, { bookmarked: initialBookmarked })

  useEffect(() => {
    if (state.message) toast({ title: state.message })
    if (state.error) toast({ variant: 'destructive', title: state.error })
  }, [state.message, state.error])

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="question_id" value={questionId} />
      <input type="hidden" name="paper_id" value={paperId} />
      <BookmarkSubmitButton bookmarked={state.bookmarked} />
      {state.error ? <p className="font-body text-sm text-red-700">{state.error}</p> : null}
      <Toaster />
    </form>
  )
}
