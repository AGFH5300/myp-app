import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PracticeHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  redirect(user ? '/dashboard/papers' : '/auth/login?next=/dashboard/papers')
}
