import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type AccessEvent = {
  id: string
  user_id: string | null
  resource_id: string | null
  action: 'open' | 'download'
  created_at: string
  resources: { title: string | null; subject: string | null } | null
}

type RawAccessEvent = Omit<AccessEvent, 'resources'> & {
  resources: { title: string | null; subject: string | null } | { title: string | null; subject: string | null }[] | null
}

function normalizeEvent(event: RawAccessEvent): AccessEvent {
  return {
    ...event,
    resources: Array.isArray(event.resources) ? event.resources[0] ?? null : event.resources,
  }
}

type Profile = {
  id: string
  email: string | null
  full_name: string | null
}

export default async function ResourceAnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: events } = await supabase
    .from('resource_access_events')
    .select('id,user_id,resource_id,action,created_at,resources(title,subject)')
    .order('created_at', { ascending: false })
    .limit(500)

  const accessEvents = ((events ?? []) as unknown as RawAccessEvent[]).map(normalizeEvent)
  const userIds = Array.from(new Set(accessEvents.map((event) => event.user_id).filter((id): id is string => Boolean(id))))
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id,email,full_name').in('id', userIds)
    : { data: [] as Profile[] }

  const profilesById = new Map((profiles as Profile[]).map((item) => [item.id, item]))
  const resourceCounts = new Map<string, { title: string; subject: string; count: number; users: Set<string> }>()

  for (const event of accessEvents) {
    const key = event.resource_id ?? event.resources?.title ?? 'deleted-resource'
    const current = resourceCounts.get(key) ?? {
      title: event.resources?.title ?? 'Deleted resource',
      subject: event.resources?.subject ?? 'Unknown subject',
      count: 0,
      users: new Set<string>(),
    }

    current.count += 1
    if (event.user_id) current.users.add(event.user_id)
    resourceCounts.set(key, current)
  }

  const mostAccessedResources = Array.from(resourceCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const uniqueUsers = new Set(accessEvents.map((event) => event.user_id).filter(Boolean)).size

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-label text-xs uppercase tracking-[.14em] text-[#43474d]">Admin analytics</p>
          <h1 className="mt-3 font-headline text-4xl text-[#00152a]">Resource access</h1>
          <p className="mt-3 font-body text-sm text-[#43474d]">See who opened or downloaded free MYP Atlas resources.</p>
        </div>
        <Link href="/dashboard/admin" className="tsm-btn-secondary">Back to admin</Link>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border border-[#c3c6ce66] bg-white p-6">
          <p className="font-label text-xs uppercase tracking-[.14em] text-[#43474d]">Recent events</p>
          <p className="mt-3 font-headline text-4xl text-[#00152a]">{accessEvents.length}</p>
        </div>
        <div className="rounded-md border border-[#c3c6ce66] bg-white p-6">
          <p className="font-label text-xs uppercase tracking-[.14em] text-[#43474d]">Unique users</p>
          <p className="mt-3 font-headline text-4xl text-[#00152a]">{uniqueUsers}</p>
        </div>
        <div className="rounded-md border border-[#c3c6ce66] bg-white p-6">
          <p className="font-label text-xs uppercase tracking-[.14em] text-[#43474d]">Resources accessed</p>
          <p className="mt-3 font-headline text-4xl text-[#00152a]">{resourceCounts.size}</p>
        </div>
      </section>

      <section className="rounded-md border border-[#c3c6ce66] bg-white p-6">
        <h2 className="font-headline text-2xl text-[#00152a]">Most accessed resources</h2>
        <div className="mt-5 space-y-3">
          {mostAccessedResources.length === 0 ? (
            <p className="font-body text-sm text-[#43474d]">No resource access yet.</p>
          ) : (
            mostAccessedResources.map((resource) => (
              <div key={`${resource.subject}-${resource.title}`} className="flex items-center justify-between gap-4 rounded-sm bg-[#f5f3ee] p-4">
                <div>
                  <p className="font-headline text-lg text-[#00152a]">{resource.title}</p>
                  <p className="font-body text-sm text-[#43474d]">{resource.subject} · {resource.users.size} unique users</p>
                </div>
                <p className="font-label text-xs uppercase tracking-widest text-[#735b2b]">{resource.count} accesses</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-md border border-[#c3c6ce66] bg-white p-6">
        <h2 className="font-headline text-2xl text-[#00152a]">Recent access events</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-[#d5d8df] font-label uppercase tracking-widest text-[#43474d]">
              <tr>
                <th className="py-3 pr-4">User</th>
                <th className="py-3 pr-4">Resource</th>
                <th className="py-3 pr-4">Action</th>
                <th className="py-3 pr-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="font-body text-[#43474d]">
              {accessEvents.map((event) => {
                const eventProfile = event.user_id ? profilesById.get(event.user_id) : null
                return (
                  <tr key={event.id} className="border-b border-[#eef0f3]">
                    <td className="py-4 pr-4">
                      <p className="font-semibold text-[#00152a]">{eventProfile?.full_name || 'Unknown user'}</p>
                      <p className="text-xs">{eventProfile?.email || event.user_id || 'Deleted user'}</p>
                    </td>
                    <td className="py-4 pr-4">
                      <p className="font-semibold text-[#00152a]">{event.resources?.title || 'Deleted resource'}</p>
                      <p className="text-xs">{event.resources?.subject || 'Unknown subject'}</p>
                    </td>
                    <td className="py-4 pr-4 capitalize">{event.action}</td>
                    <td className="py-4 pr-4">{new Date(event.created_at).toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
