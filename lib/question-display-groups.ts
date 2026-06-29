export type ReaderImage = {
  url: string
  alt: string
}

export type ReaderQuestionWithDisplayGroup = {
  id: string
  questionNumber: string
  questionOrder: number | null
  marks: number | null
  isPublished?: boolean | null
  promptText?: string | null
  questionImages: ReaderImage[]
  markschemeImages: ReaderImage[]
  markschemeText?: string | null
  displayWithQuestionId?: string | null
}

export type ReaderQuestion = Omit<ReaderQuestionWithDisplayGroup, 'displayWithQuestionId'>

function combineMarks(first: number | null, second: number | null) {
  if (first === null) return second
  if (second === null) return first
  return first + second
}

function combineText(first: string | null | undefined, second: string | null | undefined) {
  return [first, second].filter((value): value is string => Boolean(value?.trim())).join('\n\n') || null
}

/**
 * Combines an explicitly linked continuation with its earlier source question.
 * The continuation remains a database question for marks and markscheme data,
 * but the paper reader renders one shared visual block instead of a duplicate
 * image or an incorrect "Question image missing" state.
 */
export function groupQuestionsForReader(questions: ReaderQuestionWithDisplayGroup[]): ReaderQuestion[] {
  const grouped: ReaderQuestion[] = []

  for (const question of questions) {
    const sourceIndex = question.displayWithQuestionId
      ? grouped.findIndex((candidate) => candidate.id === question.displayWithQuestionId)
      : -1

    if (sourceIndex === -1) {
      const { displayWithQuestionId: _displayWithQuestionId, ...readerQuestion } = question
      grouped.push(readerQuestion)
      continue
    }

    const source = grouped[sourceIndex]
    grouped[sourceIndex] = {
      ...source,
      questionNumber: `${source.questionNumber} and ${question.questionNumber}`,
      marks: combineMarks(source.marks, question.marks),
      questionImages: [...source.questionImages, ...question.questionImages],
      markschemeImages: [...source.markschemeImages, ...question.markschemeImages],
      markschemeText: combineText(source.markschemeText, question.markschemeText),
    }
  }

  return grouped
}
