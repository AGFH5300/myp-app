"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/auth-shell'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  return (
    <AuthShell
      eyebrow="Sign in"
      title="Pick up exactly where you left off."
      description="Open your saved questions, recent papers, and filtered archive views in one place."
      quote="We do not learn from experience... we learn from reflecting on experience."
      attribution="John Dewey"
      backToHome
    >
      <h1 className="font-headline text-4xl text-[#00152a]">Log in</h1>
      <p className="mt-3 font-body text-[#43474d]">Access your MYP eAssessment workspace.</p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div><label className="font-label text-xs uppercase tracking-[.05em] text-[#43474d]">Email</label><input className="tsm-input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required /></div>
        <div><label className="font-label text-xs uppercase tracking-[.05em] text-[#43474d]">Password</label><input className="tsm-input" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required /></div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button className="w-full bg-[#00152a] text-white py-4 rounded-sm" disabled={loading}>{loading ? 'Logging in...' : 'Log in'}</button>
      </form>
      <p className="mt-8 border-t border-[#c3c6ce55] pt-6 text-center font-body text-[#43474d]">Don&apos;t have an account?<Link href="/auth/sign-up" className="ml-1 font-semibold text-[#00152a]">Sign Up</Link></p>
    </AuthShell>
  )
}
