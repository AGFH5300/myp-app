"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AppIcon } from '@/components/app-icon'
import { BrandWordmark } from '@/components/brand-wordmark'

export default function SignUpPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
        data: { full_name: fullName, role: 'student' },
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/auth/sign-up-success')
  }

  return (
    <div className="h-screen overflow-hidden bg-[#fbf9f4] lg:flex">
      <aside className="hidden lg:flex lg:w-5/12 bg-[#00152a] p-16 text-white"><div className="flex h-full flex-col justify-between"><BrandWordmark className="text-2xl text-white" /><div className="max-w-md"><AppIcon name="auto_stories" className="size-10 text-[#d0b177]" /><h2 className="font-headline text-5xl mt-4">Cultivate your academic focus.</h2><p className="font-body text-lg mt-8 text-white/80">Join a disciplined environment dedicated to rigorous MYP eAssessment preparation.</p></div></div></aside>
      <main className="w-full lg:w-7/12 h-screen overflow-y-auto flex items-center justify-center p-8 sm:p-12 lg:p-16 xl:p-24">
        <div className="w-full max-w-md space-y-10 py-6">
          <div><h2 className="font-headline text-4xl text-[#00152a]">Initiate Enrollment</h2><p className="font-body text-[#43474d] mt-4">Enter your academic credentials to establish your personalized study archive.</p></div>
          <form onSubmit={handleSubmit} className="space-y-7">
            <div><label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Full Name</label><input className="tsm-input" value={fullName} onChange={(e)=>setFullName(e.target.value)} placeholder="e.g., Eleanor Vance" required/></div>
            <div><label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Institutional Email</label><input className="tsm-input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="student@academy.edu" required/></div>
            <div><label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Password</label><input className="tsm-input" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Minimum 12 characters" minLength={6} required/><p className="font-body text-xs text-[#43474d] mt-2">Use at least 6 characters. 12+ is recommended.</p></div>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <button className="w-full bg-[#00152a] text-white py-4 rounded-sm" disabled={loading}>{loading ? 'Establishing...' : 'Create Account'}</button>
          </form>
          <p className="text-center pt-8 border-t border-[#c3c6ce55] font-body text-sm text-[#43474d]">Already have an account?<Link href="/auth/login" className="ml-1 font-semibold text-[#735b2b]">Log In</Link></p>
        </div>
      </main>
    </div>
  )
}
