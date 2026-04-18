import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
type AvailabilityStatus = 'available' | 'unavailable' | 'invalid' | 'error'

function jsonResponse(
  status: AvailabilityStatus,
  available: boolean,
  reason: string,
  init?: { status?: number },
) {
  return NextResponse.json(
    {
      status,
      available,
      reason,
      message: reason,
    },
    init,
  )
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawType = searchParams.get('type') ?? searchParams.get('field')
  const rawValue = searchParams.get('value') ?? searchParams.get('query')
  const type = rawType === 'username' || rawType === 'email' ? rawType : null
  const value = rawValue?.trim() ?? ''

  if (!type) {
    return jsonResponse('error', false, 'Invalid check type. Use type=username or type=email.', { status: 400 })
  }

  if (!value) {
    return jsonResponse('error', false, 'Value is required.', { status: 400 })
  }

  if (type === 'username' && !USERNAME_PATTERN.test(value)) {
    return jsonResponse('invalid', false, 'Use 3-24 characters: letters, numbers, or underscore.')
  }

  if (type === 'email' && !EMAIL_PATTERN.test(value)) {
    return jsonResponse('invalid', false, 'Enter a valid email address.')
  }

  const supabase = await createClient()

  if (type === 'username') {
    const { data, error } = await supabase.rpc('is_username_available', {
      p_username: value,
    })

    if (error) {
      return jsonResponse('error', false, 'Could not validate username right now.', { status: 500 })
    }

    const available = Boolean(data)
    return jsonResponse(
      available ? 'available' : 'unavailable',
      available,
      available ? 'Username is available.' : 'That username is already taken.',
    )
  }

  const { data, error } = await supabase.rpc('is_email_available', {
    p_email: value.toLowerCase(),
  })

  if (error) {
    return jsonResponse('error', false, 'Could not validate email right now.', { status: 500 })
  }

  const available = Boolean(data)
  return jsonResponse(
    available ? 'available' : 'unavailable',
    available,
    available ? 'Email can be used for sign-up.' : 'That email is already registered.',
  )
}
