"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function VerifyOtpForm({ email }: { email: string }) {
  const router = useRouter()
  const [otpCode, setOtpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: 'email',
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/auth/set-password')
  }

  return (
    <div className="min-h-screen bg-[#fbf9f4] text-[#1b1c19] flex items-center justify-center p-8">
      <div className="w-full max-w-md bg-white border border-[#c3c6ce66] p-8 rounded-md">
        <h1 className="font-headline text-4xl text-[#00152a]">Verify email code</h1>
        <p className="font-body text-[#43474d] mt-3">Enter the one-time code sent to <span className="font-semibold">{email}</span>.</p>
        <form onSubmit={handleVerify} className="space-y-6 mt-8">
          <div><label className="font-label text-xs uppercase tracking-widest text-[#43474d]">OTP code</label><input className="tsm-input tracking-[0.3em]" inputMode="numeric" minLength={6} maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value)} required /></div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="w-full bg-[#00152a] text-white py-4 rounded-sm" disabled={loading}>{loading ? 'Verifying...' : 'Verify code'}</button>
        </form>
        <p className="font-body text-sm text-[#43474d] mt-6">Wrong email? <Link href="/auth/sign-up" className="text-[#735b2b]">Start again</Link></p>
      </div>
    </div>
  )
}
