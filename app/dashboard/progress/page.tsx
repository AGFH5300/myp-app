import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Target, Clock, TrendingUp, Award } from "lucide-react"

export default async function ProgressPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: progress } = await supabase
    .from("student_progress")
    .select("*, subjects(*)")
    .eq("user_id", user?.id)
    .order("last_activity_at", { ascending: false })

  const { data: recentAttempts } = await supabase
    .from("attempts")
    .select("*, papers(title, subjects(name, color))")
    .eq("user_id", user?.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(10)

  const totalQuestionsAttempted = progress?.reduce((sum, p) => sum + (p.total_questions_attempted || 0), 0) || 0
  const totalCorrect = progress?.reduce((sum, p) => sum + (p.total_questions_correct || 0), 0) || 0
  const totalTimeSpent = progress?.reduce((sum, p) => sum + (p.total_time_spent_seconds || 0), 0) || 0
  const overallAccuracy = totalQuestionsAttempted > 0 ? Math.round((totalCorrect / totalQuestionsAttempted) * 100) : 0

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Your Progress</h1>
        <p className="text-muted-foreground mt-1">
          Track your learning journey across all subjects
        </p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalQuestionsAttempted}</p>
                <p className="text-xs text-muted-foreground">Total Questions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overallAccuracy}%</p>
                <p className="text-xs text-muted-foreground">Overall Accuracy</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-chart-3/10 flex items-center justify-center text-chart-3">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatTime(totalTimeSpent)}</p>
                <p className="text-xs text-muted-foreground">Time Practiced</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-chart-4/10 flex items-center justify-center text-chart-4">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recentAttempts?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Papers Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subject Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Progress by Subject</CardTitle>
          <CardDescription>Your performance in each subject group</CardDescription>
        </CardHeader>
        <CardContent>
          {progress && progress.length > 0 ? (
            <div className="space-y-6">
              {progress.map((p) => {
                const accuracy = p.total_questions_attempted > 0
                  ? Math.round((p.total_questions_correct / p.total_questions_attempted) * 100)
                  : 0

                return (
                  <div key={p.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: p.subjects?.color || "#3b82f6" }}
                        />
                        <span className="font-medium">{p.subjects?.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{p.total_questions_attempted} questions</span>
                        <Badge variant={accuracy >= 70 ? "default" : "secondary"}>
                          {accuracy}% accuracy
                        </Badge>
                      </div>
                    </div>
                    <Progress value={accuracy} className="h-2" />
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No progress yet. Start practicing to see your progress here!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Attempts */}
      {recentAttempts && recentAttempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Practice Sessions</CardTitle>
            <CardDescription>Your latest completed practice papers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: attempt.papers?.subjects?.color || "#3b82f6" }}
                    />
                    <div>
                      <p className="font-medium text-sm">{attempt.papers?.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(attempt.completed_at || "").toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={Number(attempt.percentage) >= 70 ? "default" : "secondary"}>
                    {attempt.percentage}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
