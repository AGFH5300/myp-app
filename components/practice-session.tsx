"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, ArrowRight, Clock, Flag, CheckCircle, X, Loader2 } from "lucide-react"

interface Question {
  id: string
  question_number: string
  question_text: string
  question_type: string
  marks: number
  command_term: string | null
  criterion: string | null
  strand: string | null
  options: string[] | null
  correct_answer: string | null
  mark_scheme: string | null
  order_index: number
}

interface Paper {
  id: string
  title: string
  duration_minutes: number
  total_marks: number
  subjects: { name: string; color: string | null } | null
}

interface QuestionResponse {
  id: string
  question_id: string
  user_answer: string | null
  flagged: boolean
}

interface PracticeSessionProps {
  paper: Paper
  questions: Question[]
  attemptId: string
  existingResponses: QuestionResponse[]
}

export function PracticeSession({
  paper,
  questions,
  attemptId,
  existingResponses,
}: PracticeSessionProps) {
  const router = useRouter()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [showExitDialog, setShowExitDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [timeSpent, setTimeSpent] = useState(0)

  const currentQuestion = questions[currentIndex]
  const progress = ((currentIndex + 1) / questions.length) * 100

  // Initialize from existing responses
  useEffect(() => {
    const initialAnswers: Record<string, string> = {}
    const initialFlagged = new Set<string>()
    existingResponses.forEach((r) => {
      if (r.user_answer) initialAnswers[r.question_id] = r.user_answer
      if (r.flagged) initialFlagged.add(r.question_id)
    })
    setAnswers(initialAnswers)
    setFlagged(initialFlagged)
  }, [existingResponses])

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSpent((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const saveAnswer = useCallback(async (questionId: string, answer: string) => {
    const supabase = createClient()
    await supabase.from("question_responses").upsert(
      {
        attempt_id: attemptId,
        question_id: questionId,
        user_answer: answer,
        flagged: flagged.has(questionId),
      },
      { onConflict: "attempt_id,question_id" }
    )
  }, [attemptId, flagged])

  const handleAnswerChange = (answer: string) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: answer }))
    saveAnswer(currentQuestion.id, answer)
  }

  const toggleFlag = async () => {
    const newFlagged = new Set(flagged)
    if (newFlagged.has(currentQuestion.id)) {
      newFlagged.delete(currentQuestion.id)
    } else {
      newFlagged.add(currentQuestion.id)
    }
    setFlagged(newFlagged)

    const supabase = createClient()
    await supabase.from("question_responses").upsert(
      {
        attempt_id: attemptId,
        question_id: currentQuestion.id,
        user_answer: answers[currentQuestion.id] || null,
        flagged: newFlagged.has(currentQuestion.id),
      },
      { onConflict: "attempt_id,question_id" }
    )
  }

  const goToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    const supabase = createClient()

    // Calculate score
    let totalScore = 0
    for (const question of questions) {
      const userAnswer = answers[question.id]?.trim().toLowerCase()
      const correctAnswer = question.correct_answer?.trim().toLowerCase()

      let isCorrect = false
      let marksAwarded = 0

      if (question.question_type === "multiple_choice") {
        isCorrect = userAnswer === correctAnswer
        marksAwarded = isCorrect ? question.marks : 0
      } else if (userAnswer && correctAnswer) {
        // Simple check for short answers - in production, this would be more sophisticated
        isCorrect = userAnswer.includes(correctAnswer) || correctAnswer.includes(userAnswer)
        marksAwarded = isCorrect ? question.marks : 0
      }

      totalScore += marksAwarded

      await supabase.from("question_responses").upsert(
        {
          attempt_id: attemptId,
          question_id: question.id,
          user_answer: answers[question.id] || null,
          is_correct: isCorrect,
          marks_awarded: marksAwarded,
        },
        { onConflict: "attempt_id,question_id" }
      )
    }

    const maxScore = questions.reduce((sum, q) => sum + q.marks, 0)
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0

    // Update attempt
    await supabase
      .from("attempts")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        time_spent_seconds: timeSpent,
        total_score: totalScore,
        percentage,
      })
      .eq("id", attemptId)

    // Update student progress
    const { data: { user } } = await supabase.auth.getUser()
    if (user && paper.subjects) {
      const { data: subjectData } = await supabase
        .from("subjects")
        .select("id")
        .eq("name", paper.subjects.name)
        .single()

      if (subjectData) {
        const { data: existingProgress } = await supabase
          .from("student_progress")
          .select("*")
          .eq("user_id", user.id)
          .eq("subject_id", subjectData.id)
          .single()

        const correctAnswers = questions.filter((q) => {
          const userAns = answers[q.id]?.trim().toLowerCase()
          const correctAns = q.correct_answer?.trim().toLowerCase()
          return userAns && correctAns && (userAns === correctAns || userAns.includes(correctAns))
        }).length

        await supabase.from("student_progress").upsert(
          {
            user_id: user.id,
            subject_id: subjectData.id,
            total_questions_attempted: (existingProgress?.total_questions_attempted || 0) + questions.length,
            total_questions_correct: (existingProgress?.total_questions_correct || 0) + correctAnswers,
            total_time_spent_seconds: (existingProgress?.total_time_spent_seconds || 0) + timeSpent,
            last_activity_at: new Date().toISOString(),
          },
          { onConflict: "user_id,subject_id" }
        )
      }
    }

    router.push(`/dashboard/results/${attemptId}`)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const answeredCount = Object.keys(answers).filter((k) => answers[k]).length

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setShowExitDialog(true)}>
            <X className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-semibold">{paper.title}</h1>
            <p className="text-sm text-muted-foreground">{paper.subjects?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="gap-1">
            <Clock className="w-3 h-3" />
            {formatTime(timeSpent)}
          </Badge>
          <Badge variant="secondary">
            {answeredCount}/{questions.length} answered
          </Badge>
        </div>
      </div>

      {/* Progress */}
      <Progress value={progress} className="h-2 mb-6" />

      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        {/* Question */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Q{currentQuestion.question_number}</Badge>
                <Badge variant="secondary">{currentQuestion.marks} marks</Badge>
                {currentQuestion.criterion && (
                  <Badge variant="outline">Criterion {currentQuestion.criterion}</Badge>
                )}
              </div>
              <Button
                variant={flagged.has(currentQuestion.id) ? "default" : "ghost"}
                size="sm"
                onClick={toggleFlag}
                className="gap-1"
              >
                <Flag className="w-4 h-4" />
                {flagged.has(currentQuestion.id) ? "Flagged" : "Flag"}
              </Button>
            </div>
            {currentQuestion.command_term && (
              <p className="text-sm text-muted-foreground mt-2">
                Command term: <span className="font-medium">{currentQuestion.command_term}</span>
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="prose prose-invert max-w-none">
              <p className="text-lg whitespace-pre-wrap">{currentQuestion.question_text}</p>
            </div>

            {/* Answer Input */}
            {currentQuestion.question_type === "multiple_choice" && currentQuestion.options ? (
              <RadioGroup
                value={answers[currentQuestion.id] || ""}
                onValueChange={handleAnswerChange}
              >
                {(JSON.parse(currentQuestion.options as unknown as string) as string[]).map((option, idx) => (
                  <div
                    key={idx}
                    className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                  >
                    <RadioGroupItem value={option} id={`option-${idx}`} />
                    <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <Textarea
                placeholder="Enter your answer..."
                value={answers[currentQuestion.id] || ""}
                onChange={(e) => handleAnswerChange(e.target.value)}
                className="min-h-[150px]"
              />
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => goToQuestion(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous
              </Button>
              {currentIndex === questions.length - 1 ? (
                <Button onClick={() => setShowSubmitDialog(true)} className="gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Submit
                </Button>
              ) : (
                <Button onClick={() => goToQuestion(currentIndex + 1)} className="gap-2">
                  Next
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Question Navigator */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = !!answers[q.id]
                const isFlagged = flagged.has(q.id)
                const isCurrent = idx === currentIndex

                return (
                  <Button
                    key={q.id}
                    variant={isCurrent ? "default" : isAnswered ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => goToQuestion(idx)}
                    className={`relative ${isFlagged ? "ring-2 ring-primary" : ""}`}
                  >
                    {idx + 1}
                    {isFlagged && (
                      <Flag className="w-2 h-2 absolute -top-1 -right-1 text-primary" />
                    )}
                  </Button>
                )
              })}
            </div>
            <div className="mt-4 space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-secondary" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border border-border" />
                <span>Not answered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-2 border-primary" />
                <span>Flagged</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submit Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your answers?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered {answeredCount} of {questions.length} questions.
              {answeredCount < questions.length && (
                <span className="block mt-2 text-destructive">
                  Warning: {questions.length - answeredCount} questions are unanswered.
                </span>
              )}
              {flagged.size > 0 && (
                <span className="block mt-1">
                  You have {flagged.size} flagged questions.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review Answers</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Exit Dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit practice?</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress will be saved. You can continue this practice session later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Practice</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push("/dashboard")}>
              Exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
