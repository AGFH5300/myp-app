import { AppIcon } from '@/components/app-icon'
import Link from 'next/link'
import { BrandWordmark } from '@/components/brand-wordmark'

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen bg-[#fbf9f4] flex flex-col">
      <header className="py-6 border-b border-[#c3c6ce55]"><div className="tsm-shell"><BrandWordmark className="text-xl" /></div></header>
      <main className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-lg mx-auto bg-white border border-[#c3c6ce66] p-10 md:p-16 text-center shadow-[0_12px_32px_rgba(27,28,25,0.06)]">
          <div className="mb-10 w-24 h-24 rounded-full bg-[#f5f3ee] border border-[#c3c6ce66] mx-auto flex items-center justify-center"><AppIcon name="mark_email_read" className="size-12 text-[#735b2b]" /></div>
          <h1 className="font-headline text-4xl md:text-5xl text-[#00152a] mb-6">Verification email sent</h1>
          <p className="font-body text-lg text-[#43474d] mb-10">Check your inbox to activate your account. We&apos;ve sent a link to confirm your address.</p>
          <Link href="/auth/login" className="block w-full bg-[#00152a] text-white py-4 rounded-sm">Return to Log In</Link>
        </div>
      </main>
      <footer className="py-10 border-t border-[#c3c6ce66] text-center"><p className="font-label text-xs tracking-widest uppercase text-[#00152a]">© 2026 MYP Atlas. All rights reserved.</p></footer>
    </div>
  )
}
