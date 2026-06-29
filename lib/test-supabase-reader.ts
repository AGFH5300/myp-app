import { createClient } from '@/lib/supabase/server'

export async function getReaderClient() {
  return createClient()
}
