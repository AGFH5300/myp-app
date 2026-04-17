import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, Calculator, FlaskConical, BookOpen, Users, Pencil, Palette, HeartPulse, Languages } from "lucide-react"

interface Subject {
  id: string
  name: string
  code: string
  description: string | null
  color: string | null
  icon: string | null
}

const iconMap: Record<string, React.ReactNode> = {
  calculator: <Calculator className="w-6 h-6" />,
  flask: <FlaskConical className="w-6 h-6" />,
  "book-open": <BookOpen className="w-6 h-6" />,
  users: <Users className="w-6 h-6" />,
  "pencil-ruler": <Pencil className="w-6 h-6" />,
  palette: <Palette className="w-6 h-6" />,
  "heart-pulse": <HeartPulse className="w-6 h-6" />,
  languages: <Languages className="w-6 h-6" />,
}

export function SubjectCard({ subject, paperCount }: { subject: Subject; paperCount: number }) {
  const icon = subject.icon ? iconMap[subject.icon] : <BookOpen className="w-6 h-6" />

  return (
    <Link href={`/dashboard/subjects/${subject.id}`}>
      <Card className="group hover:border-primary/50 transition-all hover:shadow-md cursor-pointer h-full">
        <CardContent className="pt-6">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{ 
              backgroundColor: `${subject.color}20`,
              color: subject.color || "#3b82f6"
            }}
          >
            {icon}
          </div>
          <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
            {subject.name}
          </h3>
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {subject.description || `Practice ${subject.name} questions`}
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {paperCount} {paperCount === 1 ? "paper" : "papers"}
            </span>
            <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
