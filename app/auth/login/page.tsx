"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BrandWordmark } from '@/components/brand-wordmark'

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
    <div className="min-h-screen bg-[#fbf9f4] text-[#1b1c19] flex items-center justify-center p-8">
      <div className="w-full max-w-md bg-white border border-[#c3c6ce66] p-8 rounded-md">
        <BrandWordmark className="text-xl" />
        <h1 className="font-headline text-4xl text-[#00152a] mt-8">Log in</h1>
        <p className="font-body text-[#43474d] mt-3">Access your MYP eAssessment paper archive workspace.</p>
        <form onSubmit={handleSubmit} className="space-y-6 mt-8">
          <div><label className="font-label text-xs uppercase tracking-[.05em] text-[#43474d]">Email</label><input className="tsm-input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required /></div>
          <div><label className="font-label text-xs uppercase tracking-[.05em] text-[#43474d]">Password</label><input className="tsm-input" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required /></div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="w-full bg-[#00152a] text-white py-4 rounded-sm" disabled={loading}>{loading ? 'Logging in...' : 'Log in'}</button>
        </form>
        <p className="mt-8 pt-6 border-t border-[#c3c6ce55] text-center font-body text-[#43474d]">Don&apos;t have an account?<Link href="/auth/sign-up" className="ml-1 font-semibold text-[#00152a]">Sign Up</Link></p>
      </div>
    </div>
  )
}
