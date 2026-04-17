"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BrandWordmark } from '@/components/brand-wordmark'

export default function SignUpPage() {
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: {
          username,
          full_name: fullName,
          onboarding_completed: false,
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('myp_signup_profile', JSON.stringify({ username, fullName, email }))
    }

    router.push(`/auth/verify-otp?email=${encodeURIComponent(email)}&mode=signup`)
  }

  return (
    <div className="min-h-screen bg-[#fbf9f4] text-[#1b1c19] flex items-center justify-center p-8">
      <div className="w-full max-w-md bg-white border border-[#c3c6ce66] p-8 rounded-md">
        <BrandWordmark className="text-xl" />
        <h1 className="font-headline text-4xl text-[#00152a] mt-8">Create account</h1>
        <p className="font-body text-[#43474d] mt-3">Sign up to access real MYP eAssessment past papers and markschemes.</p>
        <form onSubmit={handleSubmit} className="space-y-6 mt-8">
          <div><label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Username</label><input className="tsm-input" value={username} onChange={(e) => setUsername(e.target.value)} required /></div>
          <div><label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Full name</label><input className="tsm-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
          <div><label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Email</label><input className="tsm-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="w-full bg-[#00152a] text-white py-4 rounded-sm" disabled={loading}>{loading ? 'Sending code...' : 'Send verification code'}</button>
        </form>
        <p className="text-center pt-6 mt-8 border-t border-[#c3c6ce55] font-body text-sm text-[#43474d]">Already have an account?<Link href="/auth/login" className="ml-1 font-semibold text-[#735b2b]">Log In</Link></p>
      </div>
    </div>
  )
}
