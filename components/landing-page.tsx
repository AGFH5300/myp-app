"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BookOpen, Target, TrendingUp, Users, ArrowRight, CheckCircle2 } from "lucide-react"

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">MYP Practice</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-6">
            <Target className="w-4 h-4" />
            <span>IB MYP eAssessment Preparation</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-balance">
            Master Your MYP eAssessment with Confidence
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-pretty">
            Practice with real exam-style questions, track your progress across all MYP criteria, and build the skills you need to excel.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/sign-up">
              <Button size="lg" className="gap-2">
                Start Practicing Free
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="outline" size="lg">
                Sign in to Continue
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20 border-t border-border/50">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Everything You Need to Succeed</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Comprehensive practice tools designed specifically for IB MYP students
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <FeatureCard
            icon={<BookOpen className="w-6 h-6" />}
            title="8 Subject Groups"
            description="Practice questions covering all MYP subject groups from Mathematics to Arts"
          />
          <FeatureCard
            icon={<Target className="w-6 h-6" />}
            title="Criterion-Based"
            description="Questions aligned to MYP assessment criteria A, B, C, and D"
          />
          <FeatureCard
            icon={<TrendingUp className="w-6 h-6" />}
            title="Progress Tracking"
            description="Monitor your performance and identify areas for improvement"
          />
          <FeatureCard
            icon={<CheckCircle2 className="w-6 h-6" />}
            title="Instant Feedback"
            description="Get immediate feedback with detailed mark schemes and explanations"
          />
          <FeatureCard
            icon={<Users className="w-6 h-6" />}
            title="Past Papers"
            description="Practice with questions from previous MYP eAssessment sessions"
          />
          <FeatureCard
            icon={<Target className="w-6 h-6" />}
            title="Timed Practice"
            description="Simulate real exam conditions with timed practice sessions"
          />
        </div>
      </section>

      {/* Subject Preview */}
      <section className="container mx-auto px-4 py-20 border-t border-border/50">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">All MYP Subject Groups</h2>
          <p className="text-muted-foreground">
            Comprehensive coverage across the entire MYP curriculum
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <SubjectPill name="Mathematics" color="bg-[oklch(0.65_0.2_250)]" />
          <SubjectPill name="Sciences" color="bg-[oklch(0.7_0.18_165)]" />
          <SubjectPill name="Language & Literature" color="bg-[oklch(0.65_0.2_300)]" />
          <SubjectPill name="Individuals & Societies" color="bg-[oklch(0.75_0.17_80)]" />
          <SubjectPill name="Design" color="bg-[oklch(0.7_0.2_350)]" />
          <SubjectPill name="Arts" color="bg-[oklch(0.7_0.15_200)]" />
          <SubjectPill name="PHE" color="bg-[oklch(0.65_0.2_25)]" />
          <SubjectPill name="Language Acquisition" color="bg-[oklch(0.75_0.18_130)]" />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center bg-card rounded-2xl p-8 md:p-12 border border-border">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to Start Practicing?</h2>
          <p className="text-muted-foreground mb-6">
            Join students worldwide preparing for their MYP eAssessment
          </p>
          <Link href="/auth/sign-up">
            <Button size="lg" className="gap-2">
              Create Free Account
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>MYP eAssessment Practice Platform</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors">
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
        {icon}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function SubjectPill({ name, color }: { name: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-card border border-border">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-sm font-medium truncate">{name}</span>
    </div>
  )
}
