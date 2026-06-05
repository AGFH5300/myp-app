import Link from 'next/link'
import { AppIcon } from '@/components/app-icon'
import { BrandWordmark } from '@/components/brand-wordmark'
import { createClient } from '@/lib/supabase/server'

type Resource = {
  id: string
  title: string
  subject: string
  category: string | null
  description: string | null
  file_type: string | null
  source_label: string | null
}

function groupResources(resources: Resource[]) {
  const subjects = new Map<string, Map<string, Resource[]>>()

  for (const resource of resources) {
    const subject = resource.subject || 'General'
    const category = resource.category || 'Resources'

    if (!subjects.has(subject)) {
      subjects.set(subject, new Map())
    }

    const categories = subjects.get(subject)!
    categories.set(category, [...(categories.get(category) ?? []), resource])
  }

  return Array.from(subjects.entries())
}

export default async function ResourcesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: resources } = await supabase
    .from('resources')
    .select('id,title,subject,category,description,file_type,source_label')
    .eq('is_published', true)
    .order('subject')
    .order('category')
    .order('title')

  const groupedResources = groupResources((resources ?? []) as Resource[])

  return (
    <div className="min-h-screen bg-[#fbf9f4] text-[#1b1c19]">
      <header className="border-b border-[#f0eee9] bg-[#fbf9f4]/95">
        <div className="tsm-shell flex items-center justify-between py-6">
          <BrandWordmark className="text-2xl" href="/resources" />
          <div className="flex items-center gap-3 font-body text-sm">
            {user ? (
              <Link href="/dashboard" className="tsm-btn-secondary">Dashboard</Link>
            ) : (
              <>
                <Link href="/auth/login" className="px-4 py-2 text-[#00152a] hover:text-[#735b2b]">Log In</Link>
                <Link href="/auth/sign-up" className="tsm-btn-primary">Create Account</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="tsm-shell py-12 lg:py-16">
        <section className="grid gap-8 lg:grid-cols-[1fr_0.38fr] lg:items-start">
          <div>
            <p className="font-label text-xs uppercase tracking-[.16em] text-[#43474d]">Free MYP resources</p>
            <h1 className="mt-5 max-w-3xl font-headline text-5xl leading-tight text-[#00152a] md:text-6xl">
              Browse study files before you sign in.
            </h1>
            <p className="mt-6 max-w-2xl font-body text-lg leading-relaxed text-[#43474d]">
              Subjects, categories, and resource names are public. Sign in only when you are ready to open or download a file.
            </p>
          </div>

          <aside className="rounded-md border border-[#c3c6ce66] bg-white p-6 shadow-[0_20px_44px_rgba(27,28,25,0.06)]">
            <p className="font-label text-xs uppercase tracking-[.14em] text-[#43474d]">Why sign in?</p>
            <p className="mt-3 font-body text-sm leading-relaxed text-[#43474d]">
              MYP Atlas resources are free. Sign-in is used to prevent abuse and understand which resources are useful. Your name/email may be stored with resource access history.
            </p>
          </aside>
        </section>

        <section className="mt-12 space-y-10">
          {groupedResources.length === 0 ? (
            <div className="rounded-md border border-[#c3c6ce66] bg-white p-8">
              <h2 className="font-headline text-3xl text-[#00152a]">No resources published yet.</h2>
              <p className="mt-3 font-body text-[#43474d]">Check back soon for free MYP Atlas files.</p>
            </div>
          ) : (
            groupedResources.map(([subject, categories]) => (
              <div key={subject} className="space-y-5">
                <h2 className="font-headline text-3xl text-[#00152a]">{subject}</h2>
                {Array.from(categories.entries()).map(([category, categoryResources]) => (
                  <div key={`${subject}-${category}`} className="rounded-md border border-[#c3c6ce66] bg-white p-6">
                    <h3 className="font-label text-xs uppercase tracking-[.14em] text-[#735b2b]">{category}</h3>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      {categoryResources.map((resource) => (
                        <article key={resource.id} className="rounded-sm border border-[#d5d8df] bg-[#f8f9fb] p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h4 className="font-headline text-2xl leading-snug text-[#00152a]">{resource.title}</h4>
                              <p className="mt-2 font-body text-sm leading-relaxed text-[#43474d]">{resource.description || 'Free MYP Atlas resource.'}</p>
                            </div>
                            {resource.file_type && <span className="rounded-full bg-[#efe8d7] px-3 py-1 font-label text-[10px] uppercase tracking-widest text-[#735b2b]">{resource.file_type}</span>}
                          </div>
                          {resource.source_label && <p className="mt-4 font-body text-xs text-[#58616c]">Source: {resource.source_label}</p>}
                          <div className="mt-5 flex flex-wrap gap-3">
                            <Link href={`/api/resources/${resource.id}/open`} className="tsm-btn-primary inline-flex items-center gap-2">
                              <AppIcon name="open_in_new" className="size-4" />Open
                            </Link>
                            <Link href={`/api/resources/${resource.id}/download`} className="tsm-btn-secondary inline-flex items-center gap-2">
                              <AppIcon name="download" className="size-4" />Download
                            </Link>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  )
}
