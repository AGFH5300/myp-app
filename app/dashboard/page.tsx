import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, BookOpen, Clock, Target, TrendingUp } from "lucide-react"
import { SubjectCard } from "@/components/subject-card"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id)
    .single()

  const { data: subjects } = await supabase
    .from("subjects")
    .select("*, papers(count)")
    .order("name")

  const { data: recentAttempts } = await supabase
    .from("attempts")
    .select("*, papers(title, subjects(name, color))")
    .eq("user_id", user?.id)
    .order("created_at", { ascending: false })
    .limit(3)

  const { data: progress } = await supabase
    .from("student_progress")
    .select("*, subjects(name)")
    .eq("user_id", user?.id)

  const totalQuestionsAttempted = progress?.reduce((sum, p) => sum + (p.total_questions_attempted || 0), 0) || 0
  const totalCorrect = progress?.reduce((sum, p) => sum + (p.total_questions_correct || 0), 0) || 0
  const totalTimeSpent = progress?.reduce((sum, p) => sum + (p.total_time_spent_seconds || 0), 0) || 0
  const overallAccuracy = totalQuestionsAttempted > 0 ? Math.round((totalCorrect / totalQuestionsAttempted) * 100) : 0

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {profile?.full_name?.split(" ")[0] || "Student"}
        </h1>
        <p className="text-muted-foreground mt-1">
          Continue your MYP eAssessment preparation
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Target className="w-5 h-5" />}
          label="Questions Attempted"
          value={totalQuestionsAttempted.toString()}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Accuracy Rate"
          value={`${overallAccuracy}%`}
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Time Practiced"
          value={formatTime(totalTimeSpent)}
        />
        <StatCard
          icon={<BookOpen className="w-5 h-5" />}
          label="Subjects Started"
          value={(progress?.length || 0).toString()}
        />
      </div>

      {/* Quick Actions */}
      {recentAttempts && recentAttempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <CardDescription>Continue where you left off</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentAttempts.map((attempt) => (
                <Link
                  key={attempt.id}
                  href={`/dashboard/attempt/${attempt.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: attempt.papers?.subjects?.color || "#3b82f6" }}
                    />
                    <div>
                      <p className="font-medium text-sm">{attempt.papers?.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {attempt.status === "completed" 
                          ? `Completed - ${attempt.percentage}%`
                          : "In progress"}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subject Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Subject Groups</h2>
          <Link href="/dashboard/subjects">
            <Button variant="ghost" size="sm" className="gap-1">
              View all
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {subjects?.slice(0, 4).map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              paperCount={subject.papers?.[0]?.count || 0}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}
