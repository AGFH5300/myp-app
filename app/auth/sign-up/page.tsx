"use client"

import { AlertCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AuthShell } from '@/components/auth-shell'
import { Spinner } from '@/components/ui/spinner'
import { createClient } from '@/lib/supabase/client'

type Availability = {
  status: 'idle' | 'checking' | 'available' | 'invalid' | 'unavailable' | 'error'
  message: string | null
}
type AvailabilityResponse = {
  status?: Availability['status']
  available?: boolean
  reason?: string
  message?: string
  debug?: Record<string, unknown>
}

const SIGNUP_DRAFT_KEY = 'myp_signup_profile'
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEBUG_FLAG = process.env.NEXT_PUBLIC_SIGNUP_DEBUG === 'true'

function fieldStatusClass(status: Availability['status']) {
  if (status === 'available') return 'border-b-[#0c7a43]'
  if (status === 'invalid' || status === 'unavailable' || status === 'error') return 'border-b-red-600'
  return ''
}

export default function SignUpPage() {
  const router = useRouter()
  const [formValues, setFormValues] = useState({
    username: '',
    fullName: '',
    email: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [usernameAvailability, setUsernameAvailability] = useState<Availability>({ status: 'idle', message: null })
  const [emailAvailability, setEmailAvailability] = useState<Availability>({ status: 'idle', message: null })
  const [hasUsernameInput, setHasUsernameInput] = useState(false)
  const [hasEmailInput, setHasEmailInput] = useState(false)
  const [lastUsernameAvailabilityResponse, setLastUsernameAvailabilityResponse] = useState<AvailabilityResponse | null>(null)
  const [lastEmailAvailabilityResponse, setLastEmailAvailabilityResponse] = useState<AvailabilityResponse | null>(null)
  const usernameRequestId = useRef(0)
  const emailRequestId = useRef(0)
  const usernameInputRef = useRef<HTMLInputElement>(null)
  const fullNameInputRef = useRef<HTMLInputElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const signupDebugEnabled = process.env.NODE_ENV === 'development' || DEBUG_FLAG
  const username = formValues.username
  const fullName = formValues.fullName
  const email = formValues.email

  const normalizedUsername = username.trim()
  const normalizedFullName = fullName.trim()
  const normalizedEmail = email.trim().toLowerCase()
  const isUsernameFormatValid = USERNAME_PATTERN.test(normalizedUsername)
  const isFullNameValid = normalizedFullName.length > 0
  const isEmailFormatValid = EMAIL_PATTERN.test(normalizedEmail)

  const logSignupDebug = useCallback((event: string, payload: Record<string, unknown>) => {
    if (!signupDebugEnabled) return
    console.log(`[signup-debug] ${event}`, payload)
  }, [signupDebugEnabled])

  const logInputDebug = useCallback((event: string, payload: Record<string, unknown>) => {
    if (!signupDebugEnabled) return
    console.log(`[signup-input] ${event}`, payload)
  }, [signupDebugEnabled])

  const logAvailabilityDebug = useCallback((event: string, payload: Record<string, unknown>) => {
    if (!signupDebugEnabled) return
    console.log(`[signup-availability] ${event}`, payload)
  }, [signupDebugEnabled])

  const logSubmitDebug = useCallback((event: string, payload: Record<string, unknown>) => {
    if (!signupDebugEnabled) return
    console.log(`[signup-submit] ${event}`, payload)
  }, [signupDebugEnabled])

  const updateField = useCallback((field: 'username' | 'fullName' | 'email', rawValue: string, source: string) => {
    setFormValues((prev) => {
      const next = { ...prev, [field]: rawValue }
      logInputDebug('field-update', {
        source,
        field,
        domValue: rawValue,
        prevValue: prev[field],
        nextValue: next[field],
      })
      return next
    })

    if (field === 'username') {
      setHasUsernameInput(rawValue.length > 0)
    }
    if (field === 'email') {
      setHasEmailInput(rawValue.length > 0)
    }
  }, [logInputDebug])

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

    const nextFormValues = {
      username: initialUsername || cached?.username || '',
      fullName: initialFullName || cached?.fullName || '',
      email: initialEmail || cached?.email || '',
    }

    setFormValues(nextFormValues)
    setHasUsernameInput(nextFormValues.username.length > 0)
    setHasEmailInput(nextFormValues.email.length > 0)
    logSignupDebug('hydrated-initial-values', {
      initialUsername,
      initialFullName,
      initialEmail,
      cached,
      nextFormValues,
    })
  }, [logSignupDebug])

  const syncAutofilledValues = useCallback((reason: string) => {
    const nextUsername = usernameInputRef.current?.value ?? ''
    const nextFullName = fullNameInputRef.current?.value ?? ''
    const nextEmail = emailInputRef.current?.value ?? ''
    logInputDebug('autofill-dom-scan', {
      reason,
      domValues: {
        username: nextUsername,
        fullName: nextFullName,
        email: nextEmail,
      },
      reactValues: {
        username,
        fullName,
        email,
      },
    })

    if (nextUsername !== username) {
      updateField('username', nextUsername, `autofill-sync:${reason}`)
    }
    if (nextFullName !== fullName) {
      updateField('fullName', nextFullName, `autofill-sync:${reason}`)
    }
    if (nextEmail !== email) {
      updateField('email', nextEmail, `autofill-sync:${reason}`)
    }
  }, [email, fullName, logInputDebug, updateField, username])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      syncAutofilledValues('timeout-0')
    }, 0)

    const rafId = window.requestAnimationFrame(() => {
      syncAutofilledValues('raf')
    })

    const delayedTimeoutId = window.setTimeout(() => {
      syncAutofilledValues('timeout-750')
    }, 750)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearTimeout(delayedTimeoutId)
      window.cancelAnimationFrame(rafId)
    }
  }, [syncAutofilledValues])

  useEffect(() => {
    const inputs = [
      { field: 'username' as const, ref: usernameInputRef },
      { field: 'fullName' as const, ref: fullNameInputRef },
      { field: 'email' as const, ref: emailInputRef },
    ]

    const detachListeners = inputs.map(({ field, ref }) => {
      const element = ref.current
      if (!element) return () => undefined

      const handleNativeInput = () => {
        updateField(field, element.value, 'native-input-listener')
      }
      const handleNativeChange = () => {
        updateField(field, element.value, 'native-change-listener')
      }

      element.addEventListener('input', handleNativeInput)
      element.addEventListener('change', handleNativeChange)
      return () => {
        element.removeEventListener('input', handleNativeInput)
        element.removeEventListener('change', handleNativeChange)
      }
    })

    return () => {
      detachListeners.forEach((detach) => detach())
    }
  }, [updateField])

  useEffect(() => {
    if (!normalizedUsername) {
      setUsernameAvailability({ status: 'idle', message: null })
      setLastUsernameAvailabilityResponse(null)
      return
    }

    if (!isUsernameFormatValid) {
      setUsernameAvailability({
        status: 'invalid',
        message: 'Use 3-24 characters: letters, numbers, or underscore.',
      })
      setLastUsernameAvailabilityResponse({
        status: 'invalid',
        available: false,
        reason: 'Client-side username format validation failed.',
      })
      return
    }

    const controller = new AbortController()
    usernameRequestId.current += 1
    const currentRequestId = usernameRequestId.current
    setUsernameAvailability({ status: 'checking', message: null })

    const timeoutId = window.setTimeout(async () => {
      const requestPath = `/api/auth/availability?type=username&value=${encodeURIComponent(normalizedUsername)}`
      logAvailabilityDebug('username-request-start', {
        requestId: currentRequestId,
        type: 'username',
        value: normalizedUsername,
        requestPath,
      })
      try {
        const response = await fetch(requestPath, {
          signal: controller.signal,
        })

        const payload = (await response.json()) as AvailabilityResponse
        setLastUsernameAvailabilityResponse(payload)
        logAvailabilityDebug('username-response', {
          requestId: currentRequestId,
          statusCode: response.status,
          ok: response.ok,
          payload,
        })
        const reason = payload.reason ?? payload.message ?? 'Could not validate username right now.'
        const payloadStatus = payload.status

        if (currentRequestId !== usernameRequestId.current) {
          logAvailabilityDebug('username-response-ignored-stale', {
            requestId: currentRequestId,
            latestRequestId: usernameRequestId.current,
          })
          return
        }
        if (!response.ok) {
          setUsernameAvailability({ status: 'error', message: reason })
          logAvailabilityDebug('username-state-updated', { nextStatus: 'error', reason })
          return
        }

        if (payloadStatus === 'invalid') {
          setUsernameAvailability({ status: 'invalid', message: reason })
          logAvailabilityDebug('username-state-updated', { nextStatus: 'invalid', reason })
          return
        }

        if (payload.available) {
          setUsernameAvailability({ status: 'available', message: reason })
          logAvailabilityDebug('username-state-updated', { nextStatus: 'available', reason })
          return
        }

        setUsernameAvailability({ status: 'unavailable', message: reason || 'That username is already taken.' })
        logAvailabilityDebug('username-state-updated', { nextStatus: 'unavailable', reason })
      } catch (availabilityError) {
        if (controller.signal.aborted) {
          logAvailabilityDebug('username-request-aborted', { requestId: currentRequestId })
          return
        }
        setUsernameAvailability({ status: 'error', message: 'Could not validate username right now.' })
        logAvailabilityDebug('username-request-failed', {
          requestId: currentRequestId,
          error: availabilityError instanceof Error ? availabilityError.message : String(availabilityError),
        })
      }
    }, 450)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [isUsernameFormatValid, normalizedUsername])

  useEffect(() => {
    if (!normalizedEmail) {
      setEmailAvailability({ status: 'idle', message: null })
      setLastEmailAvailabilityResponse(null)
      return
    }

    if (!isEmailFormatValid) {
      setEmailAvailability({ status: 'invalid', message: 'Enter a valid email address.' })
      setLastEmailAvailabilityResponse({
        status: 'invalid',
        available: false,
        reason: 'Client-side email format validation failed.',
      })
      return
    }

    const controller = new AbortController()
    emailRequestId.current += 1
    const currentRequestId = emailRequestId.current
    setEmailAvailability({ status: 'checking', message: null })

    const timeoutId = window.setTimeout(async () => {
      const requestPath = `/api/auth/availability?type=email&value=${encodeURIComponent(normalizedEmail)}`
      logAvailabilityDebug('email-request-start', {
        requestId: currentRequestId,
        type: 'email',
        value: normalizedEmail,
        requestPath,
      })
      try {
        const response = await fetch(requestPath, {
          signal: controller.signal,
        })

        const payload = (await response.json()) as AvailabilityResponse
        setLastEmailAvailabilityResponse(payload)
        logAvailabilityDebug('email-response', {
          requestId: currentRequestId,
          statusCode: response.status,
          ok: response.ok,
          payload,
        })
        const reason = payload.reason ?? payload.message ?? 'Could not validate email right now.'
        const payloadStatus = payload.status

        if (currentRequestId !== emailRequestId.current) {
          logAvailabilityDebug('email-response-ignored-stale', {
            requestId: currentRequestId,
            latestRequestId: emailRequestId.current,
          })
          return
        }
        if (!response.ok) {
          setEmailAvailability({ status: 'error', message: reason })
          logAvailabilityDebug('email-state-updated', { nextStatus: 'error', reason })
          return
        }

        if (payloadStatus === 'invalid') {
          setEmailAvailability({ status: 'invalid', message: reason })
          logAvailabilityDebug('email-state-updated', { nextStatus: 'invalid', reason })
          return
        }

        if (payload.available) {
          setEmailAvailability({ status: 'available', message: reason })
          logAvailabilityDebug('email-state-updated', { nextStatus: 'available', reason })
          return
        }

        setEmailAvailability({ status: 'unavailable', message: reason || 'That email is already registered.' })
        logAvailabilityDebug('email-state-updated', { nextStatus: 'unavailable', reason })
      } catch (availabilityError) {
        if (controller.signal.aborted) {
          logAvailabilityDebug('email-request-aborted', { requestId: currentRequestId })
          return
        }
        setEmailAvailability({ status: 'error', message: 'Could not validate email right now.' })
        logAvailabilityDebug('email-request-failed', {
          requestId: currentRequestId,
          error: availabilityError instanceof Error ? availabilityError.message : String(availabilityError),
        })
      }
    }, 450)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [isEmailFormatValid, normalizedEmail])

  useEffect(() => {
    logSignupDebug('field-values-updated', {
      username,
      fullName,
      email,
      normalizedUsername,
      normalizedFullName,
      normalizedEmail,
    })
  }, [email, fullName, logSignupDebug, normalizedEmail, normalizedFullName, normalizedUsername, username])

  useEffect(() => {
    logSignupDebug('sync-validation-state', {
      isUsernameFormatValid,
      isFullNameValid,
      isEmailFormatValid,
    })
  }, [isEmailFormatValid, isFullNameValid, isUsernameFormatValid])

  useEffect(() => {
    logAvailabilityDebug('username-status-transition', {
      status: usernameAvailability.status,
      message: usernameAvailability.message,
    })
  }, [usernameAvailability.message, usernameAvailability.status])

  useEffect(() => {
    logAvailabilityDebug('email-status-transition', {
      status: emailAvailability.status,
      message: emailAvailability.message,
    })
  }, [emailAvailability.message, emailAvailability.status])

  const isUsernameReady = usernameAvailability.status === 'available'
  const isEmailReady = emailAvailability.status === 'available'

  const disabledReason = useMemo(() => {
    if (isSubmitting) return 'submission in progress'
    if (normalizedUsername.length === 0) return 'username empty'
    if (normalizedFullName.length === 0) return 'full name empty'
    if (normalizedEmail.length === 0) return 'email empty'
    if (!isUsernameFormatValid) return 'username invalid'
    if (!isEmailFormatValid) return 'email invalid'
    if (usernameAvailability.status === 'checking') return 'username availability still checking'
    if (emailAvailability.status === 'checking') return 'email availability still checking'
    if (usernameAvailability.status === 'unavailable') return 'username unavailable'
    if (emailAvailability.status === 'unavailable') return 'email unavailable'
    if (usernameAvailability.status === 'error') return 'username availability error'
    if (emailAvailability.status === 'error') return 'email availability error'
    if (!isUsernameReady) return 'username not ready'
    if (!isEmailReady) return 'email not ready'
    return 'ready'
  }, [
    emailAvailability.status,
    isEmailFormatValid,
    isEmailReady,
    isSubmitting,
    isUsernameFormatValid,
    isUsernameReady,
    normalizedEmail.length,
    normalizedFullName.length,
    normalizedUsername.length,
    usernameAvailability.status,
  ])

  const canSubmit = disabledReason === 'ready'

  useEffect(() => {
    logSubmitDebug('submit-state-evaluated', {
      canSubmit,
      isSubmitting,
      disabledReason,
      isUsernameReady,
      isEmailReady,
      usernameStatus: usernameAvailability.status,
      emailStatus: emailAvailability.status,
      username: normalizedUsername,
      fullName: normalizedFullName,
      email: normalizedEmail,
      isUsernameFormatValid,
      isFullNameValid,
      isEmailFormatValid,
    })
  }, [
    canSubmit,
    disabledReason,
    emailAvailability.status,
    isEmailFormatValid,
    isFullNameValid,
    isEmailReady,
    isSubmitting,
    isUsernameFormatValid,
    isUsernameReady,
    normalizedEmail,
    normalizedFullName,
    normalizedUsername,
    usernameAvailability.status,
  ])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    logSubmitDebug('submit-attempt', {
      canSubmit,
      disabledReason,
      isSubmitting,
      payload: {
        username: normalizedUsername,
        fullName: normalizedFullName,
        email: normalizedEmail,
      },
    })

    if (!canSubmit) {
      logSubmitDebug('submit-blocked', { disabledReason })
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
      logSubmitDebug('submission-started', payload)

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
        logSubmitDebug('submission-failed', {
          message: signUpError.message,
          code: signUpError.code,
          name: signUpError.name,
        })
        setError(signUpError.message)
        return
      }
      logSubmitDebug('submission-succeeded', { email: payload.email, username: payload.username })

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
      logSubmitDebug('submission-navigation', { destination: `/auth/verify-otp?${query.toString()}` })
    } catch (submitError) {
      logSubmitDebug('submission-exception', {
        error: submitError instanceof Error ? submitError.message : String(submitError),
      })
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
              ref={usernameInputRef}
              className={`tsm-input pr-10 ${fieldStatusClass(usernameAvailability.status)}`}
              type="text"
              name="username"
              value={username}
              onChange={(e) => updateField('username', e.target.value, 'react-onChange')}
              onInput={(e) => updateField('username', e.currentTarget.value, 'react-onInput')}
              onFocus={() => syncAutofilledValues('username-focus')}
              required
              disabled={isSubmitting}
              autoComplete="username"
            />
            <div className="pointer-events-none absolute right-2 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center">
              {usernameAvailability.status === 'checking' && <Spinner className="size-4 text-[#00152a]" />}
              {usernameAvailability.status === 'available' && <CheckCircle2 className="size-4 text-[#0c7a43]" />}
              {(usernameAvailability.status === 'invalid' ||
                usernameAvailability.status === 'unavailable' ||
                usernameAvailability.status === 'error') && <AlertCircle className="size-4 text-red-600" />}
            </div>
          </div>
          {hasUsernameInput && usernameAvailability.message && usernameAvailability.status !== 'available' ? (
            <p className="mt-2 text-sm text-red-700">{usernameAvailability.message}</p>
          ) : null}
        </div>

        <div>
          <label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Full name</label>
          <input
            ref={fullNameInputRef}
            className="tsm-input"
            type="text"
            name="fullName"
            value={fullName}
            onChange={(e) => updateField('fullName', e.target.value, 'react-onChange')}
            onInput={(e) => updateField('fullName', e.currentTarget.value, 'react-onInput')}
            onFocus={() => syncAutofilledValues('fullName-focus')}
            required
            disabled={isSubmitting}
            autoComplete="name"
          />
        </div>

        <div>
          <label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Email</label>
          <div className="relative">
            <input
              ref={emailInputRef}
              className={`tsm-input pr-10 ${fieldStatusClass(emailAvailability.status)}`}
              type="email"
              name="email"
              value={email}
              onChange={(e) => updateField('email', e.target.value, 'react-onChange')}
              onInput={(e) => updateField('email', e.currentTarget.value, 'react-onInput')}
              onFocus={() => syncAutofilledValues('email-focus')}
              required
              disabled={isSubmitting}
              autoComplete="email"
            />
            <div className="pointer-events-none absolute right-2 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center">
              {emailAvailability.status === 'checking' && <Spinner className="size-4 text-[#00152a]" />}
              {emailAvailability.status === 'available' && <CheckCircle2 className="size-4 text-[#0c7a43]" />}
              {(emailAvailability.status === 'invalid' ||
                emailAvailability.status === 'unavailable' ||
                emailAvailability.status === 'error') && <AlertCircle className="size-4 text-red-600" />}
            </div>
          </div>
          {hasEmailInput && emailAvailability.message && emailAvailability.status !== 'available' ? (
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

      {signupDebugEnabled ? (
        <details className="mt-6 rounded-sm border border-[#c3c6ce] bg-[#f8fafc] p-4">
          <summary className="cursor-pointer font-label text-xs uppercase tracking-widest text-[#00152a]">
            Temporary sign-up debug panel (dev-only)
          </summary>
          <div className="mt-4 space-y-3 text-xs text-[#1f2937]">
            <p><strong>username value:</strong> {JSON.stringify(username)}</p>
            <p><strong>fullName value:</strong> {JSON.stringify(fullName)}</p>
            <p><strong>email value:</strong> {JSON.stringify(email)}</p>
            <p><strong>username format valid:</strong> {String(isUsernameFormatValid)}</p>
            <p><strong>fullName valid:</strong> {String(isFullNameValid)}</p>
            <p><strong>email format valid:</strong> {String(isEmailFormatValid)}</p>
            <p><strong>usernameStatus:</strong> {usernameAvailability.status}</p>
            <p><strong>emailStatus:</strong> {emailAvailability.status}</p>
            <p><strong>usernameError:</strong> {usernameAvailability.message ?? 'null'}</p>
            <p><strong>emailError:</strong> {emailAvailability.message ?? 'null'}</p>
            <p><strong>canSubmit:</strong> {String(canSubmit)}</p>
            <p><strong>isSubmitting:</strong> {String(isSubmitting)}</p>
            <p><strong>disabledReason:</strong> {disabledReason}</p>
            <p className="font-semibold">last username availability response</p>
            <pre className="overflow-x-auto rounded bg-white p-2">{JSON.stringify(lastUsernameAvailabilityResponse, null, 2)}</pre>
            <p className="font-semibold">last email availability response</p>
            <pre className="overflow-x-auto rounded bg-white p-2">{JSON.stringify(lastEmailAvailabilityResponse, null, 2)}</pre>
          </div>
        </details>
      ) : null}

      <p className="mt-8 border-t border-[#c3c6ce55] pt-6 text-center font-body text-sm text-[#43474d]">
        Already have an account?
        <Link href="/auth/login" className="ml-1 font-semibold text-[#735b2b]">
          Log In
        </Link>
      </p>
    </AuthShell>
  )
}
