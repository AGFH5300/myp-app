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
  const [observedValues, setObservedValues] = useState({
    usernameRaw: '',
    fullNameRaw: '',
    emailRaw: '',
    username: '',
    fullName: '',
    email: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [usernameAvailability, setUsernameAvailability] = useState<Availability>({ status: 'idle', message: null })
  const [emailAvailability, setEmailAvailability] = useState<Availability>({ status: 'idle', message: null })
  const [lastUsernameAvailabilityResponse, setLastUsernameAvailabilityResponse] = useState<AvailabilityResponse | null>(null)
  const [lastEmailAvailabilityResponse, setLastEmailAvailabilityResponse] = useState<AvailabilityResponse | null>(null)
  const usernameRequestId = useRef(0)
  const emailRequestId = useRef(0)
  const usernameRef = useRef<HTMLInputElement>(null)
  const fullNameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const signupDebugEnabled = process.env.NODE_ENV === 'development' || DEBUG_FLAG
  const normalizedUsername = observedValues.username
  const normalizedFullName = observedValues.fullName
  const normalizedEmail = observedValues.email
  const isUsernameFormatValid = USERNAME_PATTERN.test(normalizedUsername)
  const isFullNameValid = normalizedFullName.length > 0
  const isEmailFormatValid = EMAIL_PATTERN.test(normalizedEmail)
  const hasUsernameInputValue = observedValues.usernameRaw.length > 0
  const hasEmailInputValue = observedValues.emailRaw.length > 0

  const logSignupDebug = useCallback((event: string, payload: Record<string, unknown>) => {
    if (!signupDebugEnabled) return
    console.log(`[signup-debug] ${event}`, payload)
  }, [signupDebugEnabled])

  const logInputDebug = useCallback((event: string, payload: Record<string, unknown>) => {
    if (!signupDebugEnabled) return
    console.log(`[signup-input] ${event}`, payload)
  }, [signupDebugEnabled])

  const syncFromDom = useCallback((source: string) => {
    const usernameRaw = usernameRef.current?.value ?? ''
    const fullNameRaw = fullNameRef.current?.value ?? ''
    const emailRaw = emailRef.current?.value ?? ''
    const nextValues = {
      usernameRaw,
      fullNameRaw,
      emailRaw,
      username: usernameRaw.trim(),
      fullName: fullNameRaw.trim(),
      email: emailRaw.trim().toLowerCase(),
    }
    setObservedValues((previous) => {
      if (
        previous.usernameRaw === nextValues.usernameRaw &&
        previous.fullNameRaw === nextValues.fullNameRaw &&
        previous.emailRaw === nextValues.emailRaw
      ) {
        return previous
      }
      return nextValues
    })
    logInputDebug('sync-from-dom', { source, nextValues })
  }, [logInputDebug])

  const logAvailabilityDebug = useCallback((event: string, payload: Record<string, unknown>) => {
    if (!signupDebugEnabled) return
    console.log(`[signup-availability] ${event}`, payload)
  }, [signupDebugEnabled])

  const logSubmitDebug = useCallback((event: string, payload: Record<string, unknown>) => {
    if (!signupDebugEnabled) return
    console.log(`[signup-submit] ${event}`, payload)
  }, [signupDebugEnabled])

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

    const hydratedValues = {
      username: initialUsername || cached?.username || '',
      fullName: initialFullName || cached?.fullName || '',
      email: initialEmail || cached?.email || '',
    }
    if (usernameRef.current) usernameRef.current.value = hydratedValues.username
    if (fullNameRef.current) fullNameRef.current.value = hydratedValues.fullName
    if (emailRef.current) emailRef.current.value = hydratedValues.email
    syncFromDom('mount-hydration')
    logSignupDebug('hydrated-initial-values', {
      initialUsername,
      initialFullName,
      initialEmail,
      cached,
      hydratedValues,
    })
  }, [logSignupDebug, syncFromDom])

  useEffect(() => {
    syncFromDom('mount')
    const intervalId = window.setInterval(() => {
      syncFromDom('autofill-interval')
    }, 300)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [syncFromDom])

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
      ...observedValues,
      normalizedUsername,
      normalizedFullName,
      normalizedEmail,
    })
  }, [logSignupDebug, normalizedEmail, normalizedFullName, normalizedUsername, observedValues])

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
    logSubmitDebug('canSubmit-recalculated', { canSubmit, disabledReason })
  }, [canSubmit, disabledReason, logSubmitDebug])

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
    const submitValues = observedValues
    logSubmitDebug('submit-attempt', {
      canSubmit,
      disabledReason,
      isSubmitting,
      payload: {
        username: submitValues.username,
        fullName: submitValues.fullName,
        email: submitValues.email,
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
        username: submitValues.username,
        fullName: submitValues.fullName,
        email: submitValues.email,
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

      <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate autoComplete="off">
        <input type="text" name="fake_username" autoComplete="username" className="hidden" tabIndex={-1} />
        <input type="password" name="fake_password" autoComplete="new-password" className="hidden" tabIndex={-1} />
        <div>
          <label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Username</label>
          <div className="relative">
            <input
              ref={usernameRef}
              className={`tsm-input pr-10 ${fieldStatusClass(usernameAvailability.status)}`}
              type="text"
              name="signup_username_input"
              onChange={(e) => {
                logInputDebug('react-onChange-fired', { field: 'username', value: e.target.value })
                syncFromDom('username-onChange')
              }}
              onInput={(e) => {
                logInputDebug('react-onInput-fired', { field: 'username', value: e.currentTarget.value })
                syncFromDom('username-onInput')
              }}
              onFocus={() => {
                syncFromDom('username-onFocus')
              }}
              required
              disabled={isSubmitting}
              autoComplete="off"
            />
            <div className="pointer-events-none absolute right-2 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center">
              {usernameAvailability.status === 'checking' && <Spinner className="size-4 text-[#00152a]" />}
              {usernameAvailability.status === 'available' && <CheckCircle2 className="size-4 text-[#0c7a43]" />}
              {(usernameAvailability.status === 'invalid' ||
                usernameAvailability.status === 'unavailable' ||
                usernameAvailability.status === 'error') && <AlertCircle className="size-4 text-red-600" />}
            </div>
          </div>
          {signupDebugEnabled ? (
            <p className="mt-1 text-[11px] text-[#6b7280]">
              dom: {JSON.stringify(usernameRef.current?.value ?? '')} | computed: {JSON.stringify(observedValues.username)}
            </p>
          ) : null}
          {hasUsernameInputValue && usernameAvailability.message && usernameAvailability.status !== 'available' ? (
            <p className="mt-2 text-sm text-red-700">{usernameAvailability.message}</p>
          ) : null}
        </div>

        <div>
          <label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Full name</label>
          <input
            ref={fullNameRef}
            className="tsm-input"
            type="text"
            name="signup_full_name_input"
            onChange={(e) => {
              logInputDebug('react-onChange-fired', { field: 'fullName', value: e.target.value })
              syncFromDom('fullName-onChange')
            }}
            onInput={(e) => {
              logInputDebug('react-onInput-fired', { field: 'fullName', value: e.currentTarget.value })
              syncFromDom('fullName-onInput')
            }}
            onFocus={() => {
              syncFromDom('fullName-onFocus')
            }}
            required
            disabled={isSubmitting}
            autoComplete="off"
          />
          {signupDebugEnabled ? (
            <p className="mt-1 text-[11px] text-[#6b7280]">
              dom: {JSON.stringify(fullNameRef.current?.value ?? '')} | computed: {JSON.stringify(observedValues.fullName)}
            </p>
          ) : null}
        </div>

        <div>
          <label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Email</label>
          <div className="relative">
            <input
              ref={emailRef}
              className={`tsm-input pr-10 ${fieldStatusClass(emailAvailability.status)}`}
              type="email"
              name="signup_email_input"
              onChange={(e) => {
                logInputDebug('react-onChange-fired', { field: 'email', value: e.target.value })
                syncFromDom('email-onChange')
              }}
              onInput={(e) => {
                logInputDebug('react-onInput-fired', { field: 'email', value: e.currentTarget.value })
                syncFromDom('email-onInput')
              }}
              onFocus={() => {
                syncFromDom('email-onFocus')
              }}
              required
              disabled={isSubmitting}
              autoComplete="off"
            />
            <div className="pointer-events-none absolute right-2 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center">
              {emailAvailability.status === 'checking' && <Spinner className="size-4 text-[#00152a]" />}
              {emailAvailability.status === 'available' && <CheckCircle2 className="size-4 text-[#0c7a43]" />}
              {(emailAvailability.status === 'invalid' ||
                emailAvailability.status === 'unavailable' ||
                emailAvailability.status === 'error') && <AlertCircle className="size-4 text-red-600" />}
            </div>
          </div>
          {signupDebugEnabled ? (
            <p className="mt-1 text-[11px] text-[#6b7280]">
              dom: {JSON.stringify(emailRef.current?.value ?? '')} | computed: {JSON.stringify(observedValues.email)}
            </p>
          ) : null}
          {hasEmailInputValue && emailAvailability.message && emailAvailability.status !== 'available' ? (
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
            <p><strong>username value:</strong> {JSON.stringify(observedValues.username)}</p>
            <p><strong>fullName value:</strong> {JSON.stringify(observedValues.fullName)}</p>
            <p><strong>email value:</strong> {JSON.stringify(observedValues.email)}</p>
            <p><strong>username raw:</strong> {JSON.stringify(observedValues.usernameRaw)}</p>
            <p><strong>fullName raw:</strong> {JSON.stringify(observedValues.fullNameRaw)}</p>
            <p><strong>email raw:</strong> {JSON.stringify(observedValues.emailRaw)}</p>
            <p><strong>username dom:</strong> {JSON.stringify(usernameRef.current?.value ?? '')}</p>
            <p><strong>fullName dom:</strong> {JSON.stringify(fullNameRef.current?.value ?? '')}</p>
            <p><strong>email dom:</strong> {JSON.stringify(emailRef.current?.value ?? '')}</p>
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
