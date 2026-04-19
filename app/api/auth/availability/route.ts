import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
type AvailabilityStatus = 'available' | 'unavailable' | 'invalid' | 'error'
const availabilityDebugEnabled = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_SIGNUP_DEBUG === 'true'

function jsonResponse(
  status: AvailabilityStatus,
  available: boolean,
  reason: string,
  init?: { status?: number; debug?: Record<string, unknown> },
) {
  if (availabilityDebugEnabled) {
    console.log('[signup-availability] response', {
      httpStatus: init?.status ?? 200,
      status,
      available,
      reason,
      debug: init?.debug ?? null,
    })
  }
  return NextResponse.json(
    {
      status,
      available,
      reason,
      message: reason,
      ...(availabilityDebugEnabled ? { debug: init?.debug ?? null } : {}),
    },
    { status: init?.status },
  )
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawType = searchParams.get('type') ?? searchParams.get('field')
  const rawValue = searchParams.get('value') ?? searchParams.get('query')
  const type = rawType === 'username' || rawType === 'email' ? rawType : null
  const value = rawValue?.trim() ?? ''
  const requestMeta = {
    rawType,
    rawValue,
    parsedType: type,
    parsedValue: value,
  }

  if (availabilityDebugEnabled) {
    console.log('[signup-availability] request-received', requestMeta)
  }

  if (!rawType && !rawValue) {
    return jsonResponse('error', false, 'Availability check requires both type and value query params.', {
      status: 200,
      debug: { ...requestMeta, validationPath: 'empty_query_params' },
    })
  }

  if (!type) {
    return jsonResponse('error', false, 'Invalid check type. Use type=username or type=email.', {
      status: 400,
      debug: { ...requestMeta, validationPath: 'missing_or_invalid_type' },
    })
  }

  if (!value) {
    return jsonResponse('error', false, 'Value is required.', {
      status: 400,
      debug: { ...requestMeta, validationPath: 'missing_value' },
    })
  }

  if (type === 'username' && !USERNAME_PATTERN.test(value)) {
    return jsonResponse('invalid', false, 'Use 3-24 characters: letters, numbers, or underscore.', {
      debug: { ...requestMeta, validationPath: 'username_pattern_failed' },
    })
  }

  if (type === 'email' && !EMAIL_PATTERN.test(value)) {
    return jsonResponse('invalid', false, 'Enter a valid email address.', {
      debug: { ...requestMeta, validationPath: 'email_pattern_failed' },
    })
  }

  const supabase = await createClient()

  if (type === 'username') {
    const { data, error } = await supabase.rpc('is_username_available', {
      p_username: value,
    })

    if (error) {
      return jsonResponse('error', false, 'Could not validate username right now.', {
        status: 500,
        debug: {
          ...requestMeta,
          validationPath: 'rpc_is_username_available_failed',
          rpcError: error.message,
          rpcCode: error.code,
          rpcDetails: error.details,
        },
      })
    }

    const available = Boolean(data)
    return jsonResponse(
      available ? 'available' : 'unavailable',
      available,
      available ? 'Username is available.' : 'That username is already taken.',
      {
        debug: {
          ...requestMeta,
          validationPath: 'rpc_is_username_available_succeeded',
          rpcData: data,
        },
      },
    )
  }

  const { data, error } = await supabase.rpc('is_email_available', {
    p_email: value.toLowerCase(),
  })

  if (error) {
    return jsonResponse('error', false, 'Could not validate email right now.', {
      status: 500,
      debug: {
        ...requestMeta,
        validationPath: 'rpc_is_email_available_failed',
        rpcError: error.message,
        rpcCode: error.code,
        rpcDetails: error.details,
      },
    })
  }

  const available = Boolean(data)
  return jsonResponse(
    available ? 'available' : 'unavailable',
    available,
    available ? 'Email can be used for sign-up.' : 'That email is already registered.',
    {
      debug: {
        ...requestMeta,
        validationPath: 'rpc_is_email_available_succeeded',
        rpcData: data,
      },
    },
  )
}
