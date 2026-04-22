"use client"

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AuthShell } from '@/components/auth-shell'
import { Spinner } from '@/components/ui/spinner'
import { createClient } from '@/lib/supabase/client'

const SIGNUP_DRAFT_KEY = 'myp_signup_profile'
const INPUT_SETTLE_DELAY_MS = 600
const MEANINGFUL_MATCH_LENGTH = 3

const STRENGTH_LEVELS = [
  { label: 'Very Weak', color: '#b91c1c', barClass: 'bg-red-700' },
  { label: 'Weak', color: '#c2410c', barClass: 'bg-orange-600' },
  { label: 'Okay', color: '#ca8a04', barClass: 'bg-yellow-500' },
  { label: 'Solid', color: '#15803d', barClass: 'bg-green-600' },
  { label: 'Godly', color: '#7e22ce', barClass: 'bg-purple-700' },
] as const

function evaluatePasswordStrength(value: string) {
  if (!value) {
    return { score: 0, feedback: 'Use 12+ characters with mixed letter case, numbers, and symbols.' }
  }

  let points = 0
  if (value.length >= 8) points += 1
  if (value.length >= 12) points += 1
  if (/[a-z]/.test(value)) points += 1
  if (/[A-Z]/.test(value)) points += 1
  if (/\d/.test(value)) points += 1
  if (/[^A-Za-z0-9]/.test(value)) points += 1
  if (!/(.)\1{2,}/.test(value)) points += 1
  if (!/^(password|123456|qwerty|letmein)/i.test(value)) points += 1

  if (value.length < 8) return { score: 0, feedback: 'Too short. Use at least 8 characters.' }
  if (points <= 3) return { score: 1, feedback: 'Add uppercase letters, numbers, and symbols.' }
  if (points <= 5) return { score: 2, feedback: 'Good start. Add more variety or length.' }
  if (points <= 7) return { score: 3, feedback: 'Strong. A bit more length can make it even better.' }
  return { score: 4, feedback: 'Excellent strength and character variety.' }
}

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [passwordSettled, setPasswordSettled] = useState(false)
  const [confirmSettled, setConfirmSettled] = useState(false)
  const [strengthBoosted, setStrengthBoosted] = useState(false)
  const prevStrengthScoreRef = useRef(0)

  useEffect(() => {
    setPasswordSettled(false)
    if (!password) return
    const timer = window.setTimeout(() => setPasswordSettled(true), INPUT_SETTLE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [password])

  useEffect(() => {
    setConfirmSettled(false)
    if (!confirmPassword) return
    const timer = window.setTimeout(() => setConfirmSettled(true), INPUT_SETTLE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [confirmPassword])

  const strength = useMemo(() => evaluatePasswordStrength(password), [password])
  const strengthLevel = STRENGTH_LEVELS[strength.score]
  const strengthPercent = ((strength.score + 1) / STRENGTH_LEVELS.length) * 100

  useEffect(() => {
    if (strength.score > prevStrengthScoreRef.current) {
      setStrengthBoosted(true)
      const timer = window.setTimeout(() => setStrengthBoosted(false), 260)
      prevStrengthScoreRef.current = strength.score
      return () => window.clearTimeout(timer)
    }
    prevStrengthScoreRef.current = strength.score
  }, [strength.score])

  const showPasswordValidation = submitAttempted || passwordSettled
  const showConfirmValidation = submitAttempted || passwordSettled || confirmSettled
  const canCheckMismatch = password.length >= MEANINGFUL_MATCH_LENGTH && confirmPassword.length >= MEANINGFUL_MATCH_LENGTH

  const passwordError = useMemo(() => {
    if (!showPasswordValidation || !password) return null
    if (password.length < 8) return 'Use at least 8 characters.'
    return null
  }, [password, showPasswordValidation])

  const confirmError = useMemo(() => {
    if (!showConfirmValidation || !canCheckMismatch) return null
    if (password !== confirmPassword) return 'Passwords do not match.'
    return null
  }, [canCheckMismatch, password, confirmPassword, showConfirmValidation])

  const showConfirmSuccess = showConfirmValidation && canCheckMismatch && password === confirmPassword

  const canSubmit = password.length >= 8 && confirmPassword.length >= 8 && password === confirmPassword && !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitAttempted(true)
    setPasswordSettled(true)
    setConfirmSettled(true)

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
            onBlur={() => setPasswordSettled(true)}
            required
            autoComplete="new-password"
            disabled={loading}
          />
          {passwordError && <p className="mt-2 text-sm text-red-700">{passwordError}</p>}

          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-label uppercase tracking-widest text-[#43474d]">
              <span>Password strength</span>
              <span style={{ color: strengthLevel.color }}>{strengthLevel.label}</span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-[#e7ebf1]">
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out ${strengthLevel.barClass} ${strengthBoosted ? 'scale-y-110' : ''} ${strength.score === 4 ? 'shadow-[0_0_10px_rgba(126,34,206,0.45)]' : ''}`}
                style={{ width: `${password ? strengthPercent : 0}%` }}
              />
              {strength.score === 4 && (
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-40 animate-pulse" />
              )}
            </div>
            <p className="text-xs text-[#58616c]">{strength.feedback}</p>
          </div>
        </div>

        <div>
          <label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Confirm password</label>
          <input
            className="tsm-input"
            type="password"
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => setConfirmSettled(true)}
            required
            autoComplete="new-password"
            disabled={loading}
          />
          {confirmError && <p className="mt-2 text-sm text-red-700">{confirmError}</p>}
          {showConfirmSuccess && <p className="mt-2 text-sm text-[#0c7a43]">Passwords match.</p>}
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
