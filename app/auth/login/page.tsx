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
    <div className="min-h-screen bg-[#fbf9f4] text-[#1b1c19] lg:flex">
      <aside className="hidden lg:flex lg:w-5/12 bg-[#e4e2dd] relative p-16"><div className="flex flex-col justify-between h-full"><BrandWordmark className="text-2xl" /><div><blockquote className="font-headline text-4xl leading-[1.2] text-[#00152a]">"Education is not the learning of facts, but the training of the mind to think."</blockquote><div className="w-12 h-[2px] bg-[#735b2b] mt-6 mb-4" /><p className="font-body text-xs uppercase tracking-widest text-[#43474d]">Albert Einstein</p></div></div></aside>
      <main className="w-full lg:w-7/12 flex items-center justify-center p-8 sm:p-16 md:p-24">
        <div className="w-full max-w-md">
          <h1 className="font-headline text-5xl text-[#00152a] mb-4">Log In</h1>
          <p className="font-body text-lg text-[#43474d] mb-14">Enter your credentials to access your MYP Atlas workspace and continue your preparation.</p>
          <form onSubmit={handleSubmit} className="space-y-10">
            <div><label className="font-label text-xs uppercase tracking-[.05em] text-[#43474d]">Email Address</label><input className="tsm-input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="scholar@institution.edu" required /></div>
            <div><div className="flex justify-between"><label className="font-label text-xs uppercase tracking-[.05em] text-[#43474d]">Password</label><a href="#" className="font-label text-xs text-[#735b2b]">Forgot Password?</a></div><input className="tsm-input" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••" required /></div>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <button className="w-full bg-[#00152a] text-white py-5 uppercase tracking-widest text-sm rounded-sm" disabled={loading}>{loading ? 'Accessing...' : 'Enter Workspace'}</button>
          </form>
          <p className="mt-12 pt-8 border-t border-[#c3c6ce55] text-center font-body text-[#43474d]">Don&apos;t have an account?<Link href="/auth/sign-up" className="ml-1 font-semibold text-[#00152a]">Sign Up</Link></p>
        </div>
      </main>
    </div>
  )
}
