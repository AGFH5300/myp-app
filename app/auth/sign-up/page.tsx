"use client"

import { AlertCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AuthShell } from '@/components/auth-shell'
import { Spinner } from '@/components/ui/spinner'
import { createClient } from '@/lib/supabase/client'

type AvailabilityResponse = {
  status?: 'idle' | 'checking' | 'available' | 'invalid' | 'unavailable' | 'error'
  available?: boolean
  reason?: string
  message?: string
}

type FieldStatus = 'untouched' | 'typing' | 'validating' | 'valid' | 'invalid'

type FieldState = {
  touched: boolean
  dirty: boolean
  blurred: boolean
  status: FieldStatus
  error: string | null
  lastValidatedValue: string
}

type AvailabilityFieldState = FieldState & {
  isChecking: boolean
  isAvailable: boolean | null
}

const SIGNUP_DRAFT_KEY = 'myp_signup_profile'
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALIDATION_DEBOUNCE_MS = 600

function fieldStatusClass({ status, isChecking, isAvailable }: { status: FieldStatus; isChecking?: boolean; isAvailable?: boolean | null }) {
  if (isChecking || status === 'validating') return ''
  if (status === 'valid' && isAvailable !== false) return 'border-b-[#0c7a43]'
  if (status === 'invalid') return 'border-b-red-600'
  return ''
}

const INITIAL_FIELD_STATE: FieldState = {
  touched: false,
  dirty: false,
  blurred: false,
  status: 'untouched',
  error: null,
  lastValidatedValue: '',
}

const INITIAL_AVAILABILITY_FIELD_STATE: AvailabilityFieldState = {
  ...INITIAL_FIELD_STATE,
  isChecking: false,
  isAvailable: null,
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
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [usernameField, setUsernameField] = useState<AvailabilityFieldState>(INITIAL_AVAILABILITY_FIELD_STATE)
  const [fullNameField, setFullNameField] = useState<FieldState>(INITIAL_FIELD_STATE)
  const [emailField, setEmailField] = useState<AvailabilityFieldState>(INITIAL_AVAILABILITY_FIELD_STATE)

  const usernameRequestId = useRef(0)
  const emailRequestId = useRef(0)
  const usernameRef = useRef<HTMLInputElement>(null)
  const fullNameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  const normalizedUsername = observedValues.username
  const normalizedFullName = observedValues.fullName
  const normalizedEmail = observedValues.email

  const syncFromDom = useCallback(() => {
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
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const params = new URLSearchParams(window.location.search)
    const shouldRestoreDraft = params.get('restoreDraft') === '1'
    const hasExplicitQueryValues = params.has('username') || params.has('fullName') || params.has('email')
    const initialUsername = params.get('username') ?? ''
    const initialFullName = params.get('fullName') ?? ''
    const initialEmail = params.get('email') ?? ''

    if (!shouldRestoreDraft && !hasExplicitQueryValues) {
      window.sessionStorage.removeItem(SIGNUP_DRAFT_KEY)
    }

    let cached: { username?: string; fullName?: string; email?: string } | null = null
    if (shouldRestoreDraft) {
      const cachedRaw = window.sessionStorage.getItem(SIGNUP_DRAFT_KEY)
      if (cachedRaw) {
        try {
          cached = JSON.parse(cachedRaw)
        } catch {
          cached = null
        }
      }
    }

    const hydratedValues = {
      username: initialUsername || cached?.username || '',
      fullName: initialFullName || cached?.fullName || '',
      email: initialEmail || cached?.email || '',
    }

    if (usernameRef.current) usernameRef.current.value = hydratedValues.username
    if (fullNameRef.current) fullNameRef.current.value = hydratedValues.fullName
    if (emailRef.current) emailRef.current.value = hydratedValues.email

    syncFromDom()
  }, [syncFromDom])

  const validateFullNameField = useCallback((value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setFullNameField((previous) => ({
        ...previous,
        status: 'invalid',
        error: 'Enter your full name.',
        lastValidatedValue: trimmed,
      }))
      return false
    }

    setFullNameField((previous) => ({
      ...previous,
      status: 'valid',
      error: null,
      lastValidatedValue: trimmed,
    }))
    return true
  }, [])

  const validateUsernameField = useCallback(async (value: string, trigger: 'blur' | 'debounce' | 'submit') => {
    const trimmed = value.trim()

    if (!trimmed) {
      setUsernameField((previous) => ({
        ...previous,
        status: 'invalid',
        error: 'Enter a username.',
        isChecking: false,
        isAvailable: null,
        lastValidatedValue: trimmed,
      }))
      return false
    }

    if (!USERNAME_PATTERN.test(trimmed)) {
      setUsernameField((previous) => ({
        ...previous,
        status: 'invalid',
        error: 'Use 3-24 characters: letters, numbers, or underscore.',
        isChecking: false,
        isAvailable: null,
        lastValidatedValue: trimmed,
      }))
      return false
    }

    usernameRequestId.current += 1
    const currentRequestId = usernameRequestId.current
    setUsernameField((previous) => ({
      ...previous,
      status: 'validating',
      error: null,
      isChecking: true,
      isAvailable: null,
    }))

    const requestPath = `/api/auth/availability?type=username&value=${encodeURIComponent(trimmed)}`

    try {
      const response = await fetch(requestPath)
      const payload = (await response.json()) as AvailabilityResponse
      const reason = payload.reason ?? payload.message ?? 'Could not validate username right now.'

      if (currentRequestId !== usernameRequestId.current) {
        return false
      }

      if (!response.ok) {
        setUsernameField((previous) => ({
          ...previous,
          status: 'invalid',
          error: reason,
          isChecking: false,
          isAvailable: false,
          lastValidatedValue: trimmed,
        }))
        return false
      }

      if (payload.status === 'invalid') {
        setUsernameField((previous) => ({
          ...previous,
          status: 'invalid',
          error: reason,
          isChecking: false,
          isAvailable: false,
          lastValidatedValue: trimmed,
        }))
        return false
      }

      if (!payload.available) {
        setUsernameField((previous) => ({
          ...previous,
          status: 'invalid',
          error: reason || 'That username is already taken.',
          isChecking: false,
          isAvailable: false,
          lastValidatedValue: trimmed,
        }))
        return false
      }

      setUsernameField((previous) => ({
        ...previous,
        status: 'valid',
        error: null,
        isChecking: false,
        isAvailable: true,
        lastValidatedValue: trimmed,
      }))
      return true
    } catch {
      if (currentRequestId !== usernameRequestId.current) {
        return false
      }

      setUsernameField((previous) => ({
        ...previous,
        status: 'invalid',
        error: trigger === 'submit' ? 'Could not validate username right now.' : 'Could not validate username right now.',
        isChecking: false,
        isAvailable: false,
        lastValidatedValue: trimmed,
      }))
      return false
    }
  }, [])

  const validateEmailField = useCallback(async (value: string) => {
    const trimmed = value.trim().toLowerCase()

    if (!trimmed) {
      setEmailField((previous) => ({
        ...previous,
        status: 'invalid',
        error: 'Enter your email address.',
        isChecking: false,
        isAvailable: null,
        lastValidatedValue: trimmed,
      }))
      return false
    }

    if (!EMAIL_PATTERN.test(trimmed)) {
      setEmailField((previous) => ({
        ...previous,
        status: 'invalid',
        error: 'Enter a valid email address.',
        isChecking: false,
        isAvailable: null,
        lastValidatedValue: trimmed,
      }))
      return false
    }

    emailRequestId.current += 1
    const currentRequestId = emailRequestId.current
    setEmailField((previous) => ({
      ...previous,
      status: 'validating',
      error: null,
      isChecking: true,
      isAvailable: null,
    }))

    const requestPath = `/api/auth/availability?type=email&value=${encodeURIComponent(trimmed)}`

    try {
      const response = await fetch(requestPath)
      const payload = (await response.json()) as AvailabilityResponse
      const reason = payload.reason ?? payload.message ?? 'Could not validate email right now.'

      if (currentRequestId !== emailRequestId.current) {
        return false
      }

      if (!response.ok) {
        setEmailField((previous) => ({
          ...previous,
          status: 'invalid',
          error: reason,
          isChecking: false,
          isAvailable: false,
          lastValidatedValue: trimmed,
        }))
        return false
      }

      if (payload.status === 'invalid') {
        setEmailField((previous) => ({
          ...previous,
          status: 'invalid',
          error: reason,
          isChecking: false,
          isAvailable: false,
          lastValidatedValue: trimmed,
        }))
        return false
      }

      if (!payload.available) {
        setEmailField((previous) => ({
          ...previous,
          status: 'invalid',
          error: reason || 'That email is already registered.',
          isChecking: false,
          isAvailable: false,
          lastValidatedValue: trimmed,
        }))
        return false
      }

      setEmailField((previous) => ({
        ...previous,
        status: 'valid',
        error: null,
        isChecking: false,
        isAvailable: true,
        lastValidatedValue: trimmed,
      }))
      return true
    } catch {
      if (currentRequestId !== emailRequestId.current) {
        return false
      }

      setEmailField((previous) => ({
        ...previous,
        status: 'invalid',
        error: 'Could not validate email right now.',
        isChecking: false,
        isAvailable: false,
        lastValidatedValue: trimmed,
      }))
      return false
    }
  }, [])

  useEffect(() => {
    if (usernameField.status !== 'typing') return

    const timeoutId = window.setTimeout(() => {
      void validateUsernameField(observedValues.username, 'debounce')
    }, VALIDATION_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [observedValues.username, usernameField.status, validateUsernameField])

  useEffect(() => {
    if (fullNameField.status !== 'typing') return

    const timeoutId = window.setTimeout(() => {
      validateFullNameField(observedValues.fullName)
    }, VALIDATION_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [fullNameField.status, observedValues.fullName, validateFullNameField])

  useEffect(() => {
    if (emailField.status !== 'typing') return

    const timeoutId = window.setTimeout(() => {
      void validateEmailField(observedValues.email)
    }, VALIDATION_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [emailField.status, observedValues.email, validateEmailField])

  const onUsernameInput = useCallback(() => {
    syncFromDom()
    usernameRequestId.current += 1
    setUsernameField((previous) => ({
      ...previous,
      touched: true,
      dirty: true,
      status: 'typing',
      error: null,
      isChecking: false,
      isAvailable: null,
    }))
  }, [syncFromDom])

  const onFullNameInput = useCallback(() => {
    syncFromDom()
    setFullNameField((previous) => ({
      ...previous,
      touched: true,
      dirty: true,
      status: 'typing',
      error: null,
    }))
  }, [syncFromDom])

  const onEmailInput = useCallback(() => {
    syncFromDom()
    emailRequestId.current += 1
    setEmailField((previous) => ({
      ...previous,
      touched: true,
      dirty: true,
      status: 'typing',
      error: null,
      isChecking: false,
      isAvailable: null,
    }))
  }, [syncFromDom])

  const canSubmit = useMemo(() => {
    return (
      !isSubmitting &&
      usernameField.status === 'valid' &&
      fullNameField.status === 'valid' &&
      emailField.status === 'valid' &&
      !usernameField.isChecking &&
      !emailField.isChecking
    )
  }, [emailField.isChecking, emailField.status, fullNameField.status, isSubmitting, usernameField.isChecking, usernameField.status])

  const shouldShowUsernameError = usernameField.status === 'invalid' && usernameField.error && (submitAttempted || usernameField.blurred)
  const shouldShowFullNameError = fullNameField.status === 'invalid' && fullNameField.error && (submitAttempted || fullNameField.blurred)
  const shouldShowEmailError = emailField.status === 'invalid' && emailField.error && (submitAttempted || emailField.blurred)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitAttempted(true)
    setError(null)

    setUsernameField((previous) => ({ ...previous, touched: true, blurred: true }))
    setFullNameField((previous) => ({ ...previous, touched: true, blurred: true }))
    setEmailField((previous) => ({ ...previous, touched: true, blurred: true }))

    const [isUsernameValid, isEmailValid] = await Promise.all([
      validateUsernameField(observedValues.username, 'submit'),
      validateEmailField(observedValues.email),
    ])
    const isFullNameValid = validateFullNameField(observedValues.fullName)

    if (!isUsernameValid || !isFullNameValid || !isEmailValid) {
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const payload = {
        username: observedValues.username,
        fullName: observedValues.fullName,
        email: observedValues.email,
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

      <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate autoComplete="off">
        <input type="text" name="fake_username" autoComplete="username" className="hidden" tabIndex={-1} />
        <input type="password" name="fake_password" autoComplete="new-password" className="hidden" tabIndex={-1} />

        <div>
          <label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Username</label>
          <div className="relative">
            <input
              ref={usernameRef}
              className={`tsm-input pr-10 ${fieldStatusClass(usernameField)}`}
              type="text"
              name="signup_username_input"
              onChange={onUsernameInput}
              onInput={onUsernameInput}
              onBlur={() => {
                syncFromDom()
                setUsernameField((previous) => ({ ...previous, touched: true, blurred: true }))
                void validateUsernameField(usernameRef.current?.value ?? '', 'blur')
              }}
              required
              disabled={isSubmitting}
              autoComplete="off"
            />
            <div className="pointer-events-none absolute right-2 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center">
              {(usernameField.isChecking || usernameField.status === 'validating') && <Spinner className="size-4 text-[#00152a]" />}
              {usernameField.status === 'valid' && usernameField.isAvailable && <CheckCircle2 className="size-4 text-[#0c7a43]" />}
              {usernameField.status === 'invalid' && (submitAttempted || usernameField.blurred) && <AlertCircle className="size-4 text-red-600" />}
            </div>
          </div>
          {shouldShowUsernameError ? <p className="mt-2 text-sm text-red-700">{usernameField.error}</p> : null}
        </div>

        <div>
          <label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Full name</label>
          <input
            ref={fullNameRef}
            className={`tsm-input ${fieldStatusClass({ status: fullNameField.status })}`}
            type="text"
            name="signup_full_name_input"
            onChange={onFullNameInput}
            onInput={onFullNameInput}
            onBlur={() => {
              syncFromDom()
              setFullNameField((previous) => ({ ...previous, touched: true, blurred: true }))
              validateFullNameField(fullNameRef.current?.value ?? '')
            }}
            required
            disabled={isSubmitting}
            autoComplete="off"
          />
          {shouldShowFullNameError ? <p className="mt-2 text-sm text-red-700">{fullNameField.error}</p> : null}
        </div>

        <div>
          <label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Email</label>
          <div className="relative">
            <input
              ref={emailRef}
              className={`tsm-input pr-10 ${fieldStatusClass(emailField)}`}
              type="email"
              name="signup_email_input"
              onChange={onEmailInput}
              onInput={onEmailInput}
              onBlur={() => {
                syncFromDom()
                setEmailField((previous) => ({ ...previous, touched: true, blurred: true }))
                void validateEmailField(emailRef.current?.value ?? '')
              }}
              required
              disabled={isSubmitting}
              autoComplete="off"
            />
            <div className="pointer-events-none absolute right-2 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center">
              {(emailField.isChecking || emailField.status === 'validating') && <Spinner className="size-4 text-[#00152a]" />}
              {emailField.status === 'valid' && emailField.isAvailable && <CheckCircle2 className="size-4 text-[#0c7a43]" />}
              {emailField.status === 'invalid' && (submitAttempted || emailField.blurred) && <AlertCircle className="size-4 text-red-600" />}
            </div>
          </div>
          {shouldShowEmailError ? <p className="mt-2 text-sm text-red-700">{emailField.error}</p> : null}
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
        <Link
          href="/auth/login"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.sessionStorage.removeItem(SIGNUP_DRAFT_KEY)
            }
          }}
          className="ml-1 font-semibold text-[#735b2b]"
        >
          Log In
        </Link>
      </p>
    </AuthShell>
  )
}
