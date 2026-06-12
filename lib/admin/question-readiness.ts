export type WarningFilter = 'missing-markscheme' | 'missing-topic' | 'missing-subtopic' | 'missing-question-image' | 'duplicate-order'

export type TopicRef = {
  id?: string | null
  name?: string | null
  parent_topic_id?: string | null
  subject_id?: string | null
  is_active?: boolean | null
}

type AssetRef = { asset_type?: string | null; storage_path?: string | null; public_url?: string | null }
type QuestionTopicRef = { topics?: unknown }

type QuestionReadinessInput = {
  id?: string | null
  paper_id?: string | null
  question_order?: number | null
  marks?: number | null
  question_image_path?: string | null
  markscheme_image_path?: string | null
  image_url?: string | null
  markscheme_image_url?: string | null
  question_topics?: QuestionTopicRef[] | null
  question_assets?: AssetRef[] | null
}

export function relationValue<T extends string | number | boolean>(relation: unknown, key: string) {
  const item = Array.isArray(relation) ? relation[0] : relation
  return (item as Record<string, T | null> | null | undefined)?.[key]
}

export function relationTopic(relation: unknown) {
  const item = Array.isArray(relation) ? relation[0] : relation
  return item as TopicRef | null | undefined
}

export function isActiveSubjectTopic(topic: TopicRef | null | undefined, subjectId: string | null | undefined) {
  return Boolean(topic?.id && subjectId && topic.subject_id === subjectId && topic.is_active !== false)
}

export function isActiveChildTopic(topic: TopicRef | null | undefined, subjectId: string | null | undefined, topicsById: Map<string, TopicRef>) {
  if (!isActiveSubjectTopic(topic, subjectId) || !topic?.parent_topic_id) return false
  return isActiveSubjectTopic(topicsById.get(topic.parent_topic_id), subjectId)
}

export function cleanTopicLabel(label: string) {
  return label.replace(/^(?:Math Unit|Num|Chem Unit|Chem Topic|Physics Unit|Physics Topic|Unit|Topic):\s*/i, '').trim()
}

export function compactTopicPair(parentName: string | null | undefined, topicName: string | null | undefined) {
  if (!topicName) return ''
  return parentName ? `${cleanTopicLabel(parentName)} → ${cleanTopicLabel(topicName)}` : cleanTopicLabel(topicName)
}

export function topicSummary(topicRows: QuestionTopicRef[], subjectId: string | null | undefined, topicsById: Map<string, TopicRef>) {
  const selectedTopics = topicRows
    .map((row) => relationTopic(row.topics))
    .filter((topic) => isActiveSubjectTopic(topic, subjectId))

  const childTopics = selectedTopics.filter((topic) => isActiveChildTopic(topic, subjectId, topicsById))
  const topicsToShow = childTopics.length ? childTopics : selectedTopics.filter((topic) => !topic?.parent_topic_id)
  const topicLabels = topicsToShow
    .map((topic) => {
      const parent = topic?.parent_topic_id ? topicsById.get(topic.parent_topic_id) : null
      return compactTopicPair(parent?.name, topic?.name)
    })
    .filter(Boolean)
  const visibleTopicLabels = topicLabels.slice(0, 2)
  const moreCount = topicLabels.length - visibleTopicLabels.length

  return `${visibleTopicLabels.join(', ')}${moreCount > 0 ? ` +${moreCount} more` : ''}`
}

export function hasAsset(question: QuestionReadinessInput, type: 'question' | 'markscheme') {
  return question.question_assets?.some((asset) => asset.asset_type === type && (asset.storage_path || asset.public_url)) ?? false
}

export function warningKey(warning: string): WarningFilter | null {
  if (warning === 'Missing mark scheme') return 'missing-markscheme'
  if (warning === 'Missing topic') return 'missing-topic'
  if (warning === 'Missing subtopic') return 'missing-subtopic'
  if (warning === 'Missing question image') return 'missing-question-image'
  if (warning === 'Duplicate order') return 'duplicate-order'
  return null
}

export function questionWarnings({
  question,
  paper,
  topicsById,
  orderCounts,
}: {
  question: QuestionReadinessInput
  paper: unknown
  topicsById: Map<string, TopicRef>
  orderCounts: Map<string, number>
}) {
  const questionTopics = question.question_topics ?? []
  const paperSubjectId = relationValue<string>(paper, 'subject_id')
  const hasTopicRows = questionTopics.some((row) => Boolean(relationValue<string>(row.topics, 'id')))
  const hasSubtopic = questionTopics.some((row) => isActiveChildTopic(relationTopic(row.topics), paperSubjectId, topicsById))
  const hasQuestionImage = Boolean(question.question_image_path || question.image_url || hasAsset(question, 'question'))
  const hasMarkschemeImage = Boolean(question.markscheme_image_path || question.markscheme_image_url || hasAsset(question, 'markscheme'))
  const orderKey = question.paper_id && question.question_order !== null && question.question_order !== undefined ? `${question.paper_id}:${question.question_order}` : ''

  return [
    !hasQuestionImage ? 'Missing question image' : null,
    !hasMarkschemeImage ? 'Missing mark scheme' : null,
    !hasTopicRows ? 'Missing topic' : null,
    hasTopicRows && !hasSubtopic ? 'Missing subtopic' : null,
    question.marks === null || question.marks === undefined ? 'Missing marks' : null,
    orderKey && (orderCounts.get(orderKey) ?? 0) > 1 ? 'Duplicate order' : null,
    !paper ? 'Missing paper' : null,
    paper && relationValue<boolean>(paper, 'is_published') === false ? 'Paper not published' : null,
  ].filter((warning): warning is string => Boolean(warning))
}

export function seriousQuestionWarnings(warnings: string[]) {
  return warnings.filter((warning) => warning !== 'Paper not published')
}
