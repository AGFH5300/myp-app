import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'myp-resources'
const SIGNED_URL_TTL_SECONDS = 60 * 5

type RouteContext = {
  params: Promise<{ resourceId: string }>
}

async function handleResourceAccess(request: NextRequest, context: RouteContext, action: 'open' | 'download') {
  const { resourceId } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('next', next)
    return NextResponse.redirect(loginUrl)
  }

  const { data: resource, error: resourceError } = await supabase
    .from('resources')
    .select('id,file_path,is_published')
    .eq('id', resourceId)
    .eq('is_published', true)
    .maybeSingle()

  if (resourceError || !resource) {
    return NextResponse.json({ error: 'Resource not found.' }, { status: 404 })
  }

  const { error: logError } = await supabase
    .from('resource_access_events')
    .insert({ user_id: user.id, resource_id: resource.id, action })

  if (logError) {
    return NextResponse.json({ error: 'Could not log resource access.' }, { status: 500 })
  }

  const options = action === 'download' ? { download: true } : undefined
  const { data: signedUrl, error: signedUrlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(resource.file_path, SIGNED_URL_TTL_SECONDS, options)

  if (signedUrlError || !signedUrl?.signedUrl) {
    return NextResponse.json({ error: 'Could not create resource link.' }, { status: 500 })
  }

  return NextResponse.redirect(signedUrl.signedUrl)
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handleResourceAccess(request, context, 'open')
}
