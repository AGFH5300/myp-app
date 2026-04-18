"use client"

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { AuthShell } from '@/components/auth-shell'
import { Spinner } from '@/components/ui/spinner'
import { createClient } from '@/lib/supabase/client'

const SIGNUP_DRAFT_KEY = 'myp_signup_profile'

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordError = useMemo(() => {
    if (!password) return null
    if (password.length < 8) return 'Use at least 8 characters.'
    return null
  }, [password])

  const confirmError = useMemo(() => {
    if (!confirmPassword) return null
    if (password !== confirmPassword) return 'Passwords do not match.'
    return null
  }, [confirmPassword, password])

  const canSubmit = password.length >= 8 && confirmPassword.length >= 8 && password === confirmPassword && !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!canSubmit) {
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

    const cached = typeof window !== 'undefined' ? window.sessionStorage.getItem(SIGNUP_DRAFT_KEY) : null
    const parsed = cached ? JSON.parse(cached) : null

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: authData.user.id,
      email: authData.user.email,
      username: parsed?.username ?? authData.user.user_metadata?.username ?? null,
      full_name: parsed?.fullName ?? authData.user.user_metadata?.full_name ?? null,
      onboarding_completed: false,
    })

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(SIGNUP_DRAFT_KEY)
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
      <p className="mt-3 font-body text-[#43474d]">Create a password to finish signup. You will be logged in automatically.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
        <div>
          <label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Password</label>
          <input
            className="tsm-input"
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            disabled={loading}
          />
          {passwordError && <p className="mt-2 text-sm text-red-700">{passwordError}</p>}
        </div>

        <div>
          <label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Confirm password</label>
          <input
            className="tsm-input"
            type="password"
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            disabled={loading}
          />
          {confirmError && <p className="mt-2 text-sm text-red-700">{confirmError}</p>}
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#00152a] py-4 text-white transition-colors disabled:cursor-not-allowed disabled:border disabled:border-[#b6bec8] disabled:bg-[#d6dce5] disabled:text-[#667281]"
          disabled={!canSubmit}
          type="submit"
        >
          {loading ? (
            <>
              <Spinner className="size-4" />
              <span>Saving password...</span>
            </>
          ) : (
            'Set password and continue'
          )}
        </button>
      </form>
    </AuthShell>
  )
}
