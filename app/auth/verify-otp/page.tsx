import { VerifyOtpForm } from './verify-otp-form'

export default async function VerifyOtpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const emailParam = params.email
  const email = typeof emailParam === 'string' ? emailParam : ''

  return <VerifyOtpForm email={email} />
}
