import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const value = searchParams.get('value')?.trim() ?? ''

  if (type !== 'username' && type !== 'email') {
    return NextResponse.json({ message: 'Invalid check type.' }, { status: 400 })
  }

  if (!value) {
    return NextResponse.json({ message: 'Value is required.' }, { status: 400 })
  }

  if (type === 'username' && !USERNAME_PATTERN.test(value)) {
    return NextResponse.json({ available: false, message: 'Use 3-24 characters: letters, numbers, or underscore.' })
  }

  if (type === 'email' && !EMAIL_PATTERN.test(value)) {
    return NextResponse.json({ available: false, message: 'Enter a valid email address.' })
  }

  const supabase = await createClient()

  if (type === 'username') {
    const { data, error } = await supabase.rpc('is_username_available', {
      p_username: value,
    })

    if (error) {
      return NextResponse.json({ message: 'Could not validate username right now.' }, { status: 500 })
    }

    const available = Boolean(data)
    return NextResponse.json({
      available,
      message: available ? 'Username is available.' : 'That username is already taken.',
    })
  }

  const { data, error } = await supabase.rpc('is_email_available', {
    p_email: value.toLowerCase(),
  })

  if (error) {
    return NextResponse.json({ message: 'Could not validate email right now.' }, { status: 500 })
  }

  const available = Boolean(data)
  return NextResponse.json({
    available,
    message: available ? 'Email can be used for sign-up.' : 'That email is already registered.',
  })
}
