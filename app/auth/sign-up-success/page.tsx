import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BookOpen, Mail } from "lucide-react"

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="font-semibold text-xl">MYP Practice</span>
        </Link>

        <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6">
          <Mail className="w-8 h-8 text-accent" />
        </div>

        <h1 className="text-2xl font-bold mb-2">Check your email</h1>
        <p className="text-muted-foreground mb-8">
          We&apos;ve sent you a confirmation link. Please check your email and click the link to activate your account.
        </p>

        <Link href="/auth/login">
          <Button variant="outline">
            Back to sign in
          </Button>
        </Link>
      </div>
    </div>
  )
}
