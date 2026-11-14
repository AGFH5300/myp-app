import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, CheckCircle2, XCircle, Clock, RotateCcw, Home } from "lucide-react"

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ attemptId: string }>
}) {
  const { attemptId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: attempt } = await supabase
    .from("attempts")
    .select("*, papers(*, subjects(name, color))")
    .eq("id", attemptId)
    .eq("user_id", user?.id)
    .single()

  if (!attempt) {
    notFound()
  }

  const { data: responses } = await supabase
    .from("question_responses")
    .select("*, questions(*)")
    .eq("attempt_id", attemptId)
    .order("questions(order_index)")

  const correctCount = responses?.filter((r) => r.is_correct).length || 0
  const totalQuestions = responses?.length || 0
  const percentage = attempt.percentage || 0
  const timeSpent = attempt.time_spent_seconds || 0

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const getGrade = (pct: number) => {
    if (pct >= 90) return { grade: "Excellent", color: "text-green-500" }
    if (pct >= 75) return { grade: "Good", color: "text-blue-500" }
    if (pct >= 60) return { grade: "Satisfactory", color: "text-yellow-500" }
    if (pct >= 40) return { grade: "Needs Improvement", color: "text-orange-500" }
    return { grade: "Practice More", color: "text-red-500" }
  }

  const gradeInfo = getGrade(percentage)

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Practice Results</h1>
          <p className="text-muted-foreground">{attempt.papers?.title}</p>
        </div>
      </div>

      {/* Score Overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-6xl font-bold mb-2">{percentage}%</div>
            <p className={`text-xl font-medium ${gradeInfo.color}`}>{gradeInfo.grade}</p>
            <p className="text-muted-foreground mt-2">
              You scored {attempt.total_score || 0} out of {attempt.max_score || 0} marks
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="text-center p-4 rounded-lg bg-secondary/50">
              <div className="flex items-center justify-center gap-2 text-green-500 mb-1">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-2xl font-bold">{correctCount}</span>
              </div>
              <p className="text-sm text-muted-foreground">Correct</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-secondary/50">
              <div className="flex items-center justify-center gap-2 text-red-500 mb-1">
                <XCircle className="w-5 h-5" />
                <span className="text-2xl font-bold">{totalQuestions - correctCount}</span>
              </div>
              <p className="text-sm text-muted-foreground">Incorrect</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-secondary/50">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Clock className="w-5 h-5" />
                <span className="text-2xl font-bold">{formatTime(timeSpent)}</span>
              </div>
              <p className="text-sm text-muted-foreground">Time Spent</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Question Review */}
      <Card>
        <CardHeader>
          <CardTitle>Question Review</CardTitle>
          <CardDescription>Review your answers and learn from mistakes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {responses?.map((response, index) => (
            <div
              key={response.id}
              className={`p-4 rounded-lg border ${
                response.is_correct ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Q{response.questions?.question_number || index + 1}</Badge>
                  <Badge variant="secondary">{response.questions?.marks} marks</Badge>
                  {response.questions?.criterion && (
                    <Badge variant="outline">Criterion {response.questions.criterion}</Badge>
                  )}
                </div>
                {response.is_correct ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>

              <p className="mb-3 whitespace-pre-wrap">{response.questions?.question_text}</p>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground min-w-[100px]">Your answer:</span>
                  <span className={response.is_correct ? "text-green-500" : "text-red-500"}>
                    {response.user_answer || "(No answer)"}
                  </span>
                </div>
                {!response.is_correct && response.questions?.correct_answer && (
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground min-w-[100px]">Correct answer:</span>
                    <span className="text-green-500">{response.questions.correct_answer}</span>
                  </div>
                )}
                {response.questions?.mark_scheme && (
                  <div className="mt-3 p-3 rounded bg-secondary/50">
                    <p className="text-xs text-muted-foreground mb-1">Mark Scheme:</p>
                    <p className="text-sm">{response.questions.mark_scheme}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-center gap-4">
        <Link href={`/dashboard/practice/${attempt.paper_id}`}>
          <Button variant="outline" className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Practice Again
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button className="gap-2">
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  )
}
