"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { AuthShell } from '@/components/auth-shell'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Spinner } from '@/components/ui/spinner'
import { createClient } from '@/lib/supabase/client'

const SIGNUP_DRAFT_KEY = 'myp_signup_profile'
const OTP_LENGTH = 6

export function VerifyOtpForm({ email, username, fullName }: { email: string; username: string; fullName: string }) {
  const router = useRouter()
  const [otpCode, setOtpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const normalizedEmail = email.trim().toLowerCase()
  const canVerify = otpCode.length === OTP_LENGTH && !loading

  const fallbackToSignUp = useMemo(() => '/auth/sign-up?restoreDraft=1', [])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()

    if (!canVerify || !normalizedEmail) {
      return
    }

    setLoading(true)
    setError(null)
    setNotice(null)

    const supabase = createClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: otpCode,
      type: 'email',
    })

    if (verifyError) {
      setError(verifyError.message)
      setLoading(false)
      return
    }

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        SIGNUP_DRAFT_KEY,
        JSON.stringify({ email: normalizedEmail, username: username.trim(), fullName: fullName.trim() }),
      )
    }

    router.push('/auth/set-password')
  }

  async function handleResend() {
    if (!normalizedEmail || resending) {
      return
    }

    setResending(true)
    setError(null)
    setNotice(null)

    const supabase = createClient()
    const { error: resendError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
        data: {
          username: username.trim(),
          full_name: fullName.trim(),
          onboarding_completed: false,
        },
      },
    })

    if (resendError) {
      setError(resendError.message)
      setResending(false)
      return
    }

    setNotice(`A new ${OTP_LENGTH}-digit code has been sent to your email.`)
    setResending(false)
  }

  return (
    <AuthShell
      eyebrow="Email verification"
      title="Verify your email to continue sign-up."
      description={`Use the one-time ${OTP_LENGTH}-digit code sent to your inbox. After verification, you will set your password and be signed in automatically.`}
      backToHome
    >
      <h1 className="font-headline text-4xl text-[#00152a]">Verify email code</h1>
      <p className="mt-3 font-body text-[#43474d]">
        Enter the one-time code sent to <span className="font-semibold">{normalizedEmail || 'your email'}</span>.
      </p>

      <form onSubmit={handleVerify} className="mt-8 space-y-6" noValidate>
        <div>
          <label className="mb-3 block font-label text-xs uppercase tracking-widest text-[#43474d]">Verification code</label>
          <InputOTP
            maxLength={OTP_LENGTH}
            value={otpCode}
            onChange={(value) => {
              setOtpCode(value.replace(/\D/g, '').slice(0, OTP_LENGTH))
              setError(null)
            }}
            disabled={loading}
            containerClassName="justify-between"
            className="w-full"
            pattern={`\\d{${OTP_LENGTH}}`}
            inputMode="numeric"
          >
            <InputOTPGroup
              className="grid w-full gap-2"
              style={{ gridTemplateColumns: `repeat(${OTP_LENGTH}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                <InputOTPSlot key={index} index={index} className="h-12 w-full rounded-sm border border-[#c3c6ce] bg-white text-base" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {notice && <p className="text-sm text-[#0c7a43]">{notice}</p>}
        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#00152a] py-4 text-white transition-colors disabled:cursor-not-allowed disabled:border disabled:border-[#b6bec8] disabled:bg-[#d6dce5] disabled:text-[#667281]"
          disabled={!canVerify}
          type="submit"
        >
          {loading ? (
            <>
              <Spinner className="size-4" />
              <span>Verifying code...</span>
            </>
          ) : (
            'Verify code'
          )}
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between gap-4 text-sm font-body text-[#43474d]">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || loading || !normalizedEmail}
          className="font-semibold text-[#735b2b] disabled:cursor-not-allowed disabled:text-[#9d937f]"
        >
          {resending ? 'Resending...' : 'Resend code'}
        </button>

        <Link href={fallbackToSignUp} className="font-semibold text-[#735b2b]">
          Change email
        </Link>
      </div>
    </AuthShell>
  )
}
