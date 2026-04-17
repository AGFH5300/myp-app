import { createClient } from "@/lib/supabase/server"
import { SubjectCard } from "@/components/subject-card"

export default async function SubjectsPage() {
  const supabase = await createClient()

  const { data: subjects } = await supabase
    .from("subjects")
    .select("*, papers(count)")
    .order("name")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subject Groups</h1>
        <p className="text-muted-foreground mt-1">
          Choose a subject to start practicing
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {subjects?.map((subject) => (
          <SubjectCard
            key={subject.id}
            subject={subject}
            paperCount={subject.papers?.[0]?.count || 0}
          />
        ))}
      </div>

      {(!subjects || subjects.length === 0) && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No subjects available yet.</p>
        </div>
      )}
    </div>
  )
}
