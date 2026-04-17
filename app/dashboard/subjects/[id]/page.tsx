import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Clock, FileText, Play, CheckCircle2 } from "lucide-react"

export default async function SubjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: subject } = await supabase
    .from("subjects")
    .select("*")
    .eq("id", id)
    .single()

  if (!subject) {
    notFound()
  }

  const { data: papers } = await supabase
    .from("papers")
    .select("*, questions(count)")
    .eq("subject_id", id)
    .eq("is_active", true)
    .order("year", { ascending: false })

  const { data: userAttempts } = await supabase
    .from("attempts")
    .select("paper_id, status, percentage")
    .eq("user_id", user?.id)
    .in("paper_id", papers?.map(p => p.id) || [])

  const attemptsByPaper = userAttempts?.reduce((acc, attempt) => {
    if (!acc[attempt.paper_id] || attempt.status === "completed") {
      acc[attempt.paper_id] = attempt
    }
    return acc
  }, {} as Record<string, typeof userAttempts[0]>) || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/subjects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: subject.color || "#3b82f6" }}
            />
            <h1 className="text-2xl font-bold">{subject.name}</h1>
          </div>
          <p className="text-muted-foreground mt-1">{subject.description}</p>
        </div>
      </div>

      <div className="grid gap-4">
        {papers?.map((paper) => {
          const attempt = attemptsByPaper[paper.id]
          const questionCount = paper.questions?.[0]?.count || 0

          return (
            <Card key={paper.id} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{paper.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {paper.description}
                    </CardDescription>
                  </div>
                  {attempt?.status === "completed" && (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {attempt.percentage}%
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      {questionCount} questions
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {paper.duration_minutes} min
                    </span>
                    <Badge variant="outline">{paper.session} {paper.year}</Badge>
                  </div>
                  <Link href={`/dashboard/practice/${paper.id}`}>
                    <Button className="gap-2">
                      <Play className="w-4 h-4" />
                      {attempt?.status === "in_progress" ? "Continue" : "Start Practice"}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {(!papers || papers.length === 0) && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>No papers available for this subject yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
