import Link from 'next/link'
import { AppIcon } from '@/components/app-icon'
import { AuthShell } from '@/components/auth-shell'

export default function AuthEntryPage() {
  return (
    <AuthShell
      eyebrow="MYP Atlas access"
      title="Sign in or create your archive workspace."
      description="Use your account to open real MYP eAssessment papers, question records, and markschemes from 2016 to 2025."
      quote="The hard part is not finding a paper file. It is finding the exact question for a specific weak topic."
      attribution="Built for structured eAssessment revision"
      backToHome
    >
      <h1 className="font-headline text-4xl text-[#00152a]">Welcome back</h1>
      <p className="mt-3 font-body text-[#43474d]">Choose how you want to continue.</p>
      <div className="mt-8 space-y-3">
        <Link href="/auth/login" className="tsm-btn-primary flex w-full items-center justify-center gap-2 text-center">
          Log in <AppIcon name="arrow_forward" className="size-4" />
        </Link>
        <Link href="/auth/sign-up" className="tsm-btn-secondary flex w-full items-center justify-center gap-2 text-center">
          Create account <AppIcon name="chevron_right" className="size-4" />
        </Link>
      </div>
    </AuthShell>
  )
}
