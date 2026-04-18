"use client"

import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { AuthShell } from '@/components/auth-shell'
import { Spinner } from '@/components/ui/spinner'
import { createClient } from '@/lib/supabase/client'

type Availability = {
  status: 'idle' | 'checking' | 'available' | 'invalid' | 'unavailable'
  message: string | null
}

const SIGNUP_DRAFT_KEY = 'myp_signup_profile'
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function fieldStatusClass(status: Availability['status']) {
  if (status === 'available') return 'border-b-[#0c7a43]'
  if (status === 'invalid' || status === 'unavailable') return 'border-b-red-600'
  return ''
}

export default function SignUpPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [usernameAvailability, setUsernameAvailability] = useState<Availability>({ status: 'idle', message: null })
  const [emailAvailability, setEmailAvailability] = useState<Availability>({ status: 'idle', message: null })

  const normalizedUsername = username.trim()
  const normalizedFullName = fullName.trim()
  const normalizedEmail = email.trim().toLowerCase()

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const params = new URLSearchParams(window.location.search)
    const initialUsername = params.get('username') ?? ''
    const initialFullName = params.get('fullName') ?? ''
    const initialEmail = params.get('email') ?? ''
    const cachedRaw = window.sessionStorage.getItem(SIGNUP_DRAFT_KEY)
    const cached = cachedRaw ? JSON.parse(cachedRaw) : null

    setUsername(initialUsername || cached?.username || '')
    setFullName(initialFullName || cached?.fullName || '')
    setEmail(initialEmail || cached?.email || '')
  }, [])

  useEffect(() => {
    if (!normalizedUsername) {
      setUsernameAvailability({ status: 'idle', message: null })
      return
    }

    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setUsernameAvailability({
        status: 'invalid',
        message: 'Use 3-24 characters: letters, numbers, or underscore.',
      })
      return
    }

    const controller = new AbortController()
    setUsernameAvailability({ status: 'checking', message: null })

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/auth/availability?type=username&value=${encodeURIComponent(normalizedUsername)}`, {
          signal: controller.signal,
        })

        const payload = (await response.json()) as { available?: boolean; message?: string }

        if (!response.ok) {
          setUsernameAvailability({ status: 'unavailable', message: payload.message ?? 'Could not validate username right now.' })
          return
        }

        if (payload.available) {
          setUsernameAvailability({ status: 'available', message: 'Username is available.' })
          return
        }

        setUsernameAvailability({ status: 'unavailable', message: payload.message ?? 'That username is already taken.' })
      } catch {
        if (controller.signal.aborted) {
          return
        }
        setUsernameAvailability({ status: 'unavailable', message: 'Could not validate username right now.' })
      }
    }, 450)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [normalizedUsername])

  useEffect(() => {
    if (!normalizedEmail) {
      setEmailAvailability({ status: 'idle', message: null })
      return
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setEmailAvailability({ status: 'invalid', message: 'Enter a valid email address.' })
      return
    }

    const controller = new AbortController()
    setEmailAvailability({ status: 'checking', message: null })

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/auth/availability?type=email&value=${encodeURIComponent(normalizedEmail)}`, {
          signal: controller.signal,
        })

        const payload = (await response.json()) as { available?: boolean; message?: string }

        if (!response.ok) {
          setEmailAvailability({ status: 'unavailable', message: payload.message ?? 'Could not validate email right now.' })
          return
        }

        if (payload.available) {
          setEmailAvailability({ status: 'available', message: 'Email can be used for sign-up.' })
          return
        }

        setEmailAvailability({ status: 'unavailable', message: payload.message ?? 'That email is already registered.' })
      } catch {
        if (controller.signal.aborted) {
          return
        }
        setEmailAvailability({ status: 'unavailable', message: 'Could not validate email right now.' })
      }
    }, 450)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [normalizedEmail])

  const canSubmit = useMemo(() => {
    return (
      normalizedUsername.length > 0 &&
      normalizedFullName.length > 0 &&
      normalizedEmail.length > 0 &&
      usernameAvailability.status === 'available' &&
      emailAvailability.status === 'available' &&
      !isSubmitting
    )
  }, [emailAvailability.status, isSubmitting, normalizedEmail.length, normalizedFullName.length, normalizedUsername.length, usernameAvailability.status])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!canSubmit) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()
      const payload = {
        username: normalizedUsername,
        fullName: normalizedFullName,
        email: normalizedEmail,
      }

      const { error: signUpError } = await supabase.auth.signInWithOtp({
        email: payload.email,
        options: {
          shouldCreateUser: true,
          data: {
            username: payload.username,
            full_name: payload.fullName,
            onboarding_completed: false,
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify(payload))
      }

      const query = new URLSearchParams({
        email: payload.email,
        username: payload.username,
        fullName: payload.fullName,
        mode: 'signup',
      })

      router.push(`/auth/verify-otp?${query.toString()}`)
    } catch {
      setError('Something went wrong while creating your account. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Create account"
      title="Set up your account in a few calm steps."
      description="Enter your details, verify your email, then continue to a tailored onboarding flow."
      quote="The goal of education is not to increase the amount of knowledge but to create the possibilities for a child to invent and discover."
      attribution="Jean Piaget"
      backToHome
    >
      <h1 className="font-headline text-4xl text-[#00152a]">Create account</h1>
      <p className="mt-3 font-body text-[#43474d]">Create your account to start structured, source-based revision.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
        <div>
          <label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Username</label>
          <div className="relative">
            <input
              className={`tsm-input pr-10 ${fieldStatusClass(usernameAvailability.status)}`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={isSubmitting}
              autoComplete="username"
            />
            <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2">
              {usernameAvailability.status === 'checking' && <Spinner className="size-4 text-[#00152a]" />}
              {usernameAvailability.status === 'available' && <CheckCircle2 className="size-4 text-[#0c7a43]" />}
            </div>
          </div>
          {usernameAvailability.message && usernameAvailability.status !== 'available' ? (
            <p className="mt-2 text-sm text-red-700">{usernameAvailability.message}</p>
          ) : null}
        </div>

        <div>
          <label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Full name</label>
          <input
            className="tsm-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={isSubmitting}
            autoComplete="name"
          />
        </div>

        <div>
          <label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Email</label>
          <div className="relative">
            <input
              className={`tsm-input pr-10 ${fieldStatusClass(emailAvailability.status)}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
              autoComplete="email"
            />
            <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2">
              {emailAvailability.status === 'checking' && <Spinner className="size-4 text-[#00152a]" />}
              {emailAvailability.status === 'available' && <CheckCircle2 className="size-4 text-[#0c7a43]" />}
            </div>
          </div>
          {emailAvailability.message && emailAvailability.status !== 'available' ? (
            <p className="mt-2 text-sm text-red-700">{emailAvailability.message}</p>
          ) : null}
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#00152a] py-4 text-white transition-colors disabled:cursor-not-allowed disabled:border disabled:border-[#b6bec8] disabled:bg-[#d6dce5] disabled:text-[#667281]"
          disabled={!canSubmit}
          aria-disabled={!canSubmit}
        >
          {isSubmitting ? (
            <>
              <Spinner className="size-4" />
              <span>Sending verification code...</span>
            </>
          ) : (
            'Create account'
          )}
        </button>
      </form>

      <p className="mt-8 border-t border-[#c3c6ce55] pt-6 text-center font-body text-sm text-[#43474d]">
        Already have an account?
        <Link href="/auth/login" className="ml-1 font-semibold text-[#735b2b]">
          Log In
        </Link>
      </p>
    </AuthShell>
  )
}
