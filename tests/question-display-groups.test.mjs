import assert from 'node:assert/strict'
import test from 'node:test'
import { groupQuestionsForReader, hasRenderableQuestionContent } from '../lib/question-display-groups.ts'

const question = (overrides = {}) => ({
  id: 'q1',
  questionNumber: '1a',
  questionOrder: 1,
  marks: 2,
  promptText: null,
  questionImages: [],
  markschemeImages: [],
  markschemeText: null,
  displayWithQuestionId: null,
  ...overrides,
})

test('student reader includes image-backed or text-backed questions only', () => {
  assert.equal(hasRenderableQuestionContent(question({ promptText: 'Solve for x.' })), true)
  assert.equal(hasRenderableQuestionContent(question({ promptText: '   ' })), false)
  assert.equal(hasRenderableQuestionContent(question({ questionImages: [{ url: '/q.png', alt: 'Question' }] })), true)
  assert.equal(hasRenderableQuestionContent(question()), false)
})

test('continuation questions retain both text prompts', () => {
  const [grouped] = groupQuestionsForReader([
    question({ promptText: 'Use the chart.' }),
    question({ id: 'q2', questionNumber: '1b', questionOrder: 2, promptText: 'Find the mean.', displayWithQuestionId: 'q1' }),
  ])

  assert.equal(grouped.promptText, 'Use the chart.\n\nFind the mean.')
  assert.equal(grouped.marks, 4)
  assert.equal(grouped.questionNumber, '1a and 1b')
})
