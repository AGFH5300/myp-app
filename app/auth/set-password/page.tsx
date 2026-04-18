"use client"

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/auth-shell'

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      setError('Your verification session expired. Please sign up again.')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    const cached = typeof window !== 'undefined' ? window.sessionStorage.getItem('myp_signup_profile') : null
    const parsed = cached ? JSON.parse(cached) : null

    await supabase.from('profiles').upsert({
      id: authData.user.id,
      email: authData.user.email,
      username: parsed?.username ?? null,
      full_name: parsed?.fullName ?? authData.user.user_metadata?.full_name ?? null,
      onboarding_completed: false,
    })

    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('myp_signup_profile')
    }

    router.push('/onboarding')
  }

  return (
    <AuthShell
      eyebrow="Set password"
      title="Create your password and finish account setup."
      description="After this step, you are logged in automatically and moved to onboarding."
      backToHome
    >
      <h1 className="font-headline text-4xl text-[#00152a]">Set your password</h1>
      <p className="font-body text-[#43474d] mt-3">Create a password to finish signup. You will be logged in automatically.</p>
      <form onSubmit={handleSubmit} className="space-y-6 mt-8">
        <div><label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Password</label><input className="tsm-input" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <div><label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Confirm password</label><input className="tsm-input" type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button className="w-full bg-[#00152a] text-white py-4 rounded-sm" disabled={loading}>{loading ? 'Saving...' : 'Set password and continue'}</button>
      </form>
    </AuthShell>
  )
}
