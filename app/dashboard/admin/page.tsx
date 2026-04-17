import { createClient } from '@/lib/supabase/server'
import { AdSlot } from '@/components/ad-slot'
import { adSlots } from '@/lib/ads'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: papers } = await supabase
    .from('papers')
    .select('id,title,is_published,created_at,subjects(name),exam_sessions(exam_year,exam_month)')
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div>
      <h1 className="font-headline text-4xl text-[#00152a]">Admin Content Console</h1>
      <p className="font-body text-[#43474d] mt-2 mb-8">Manage published and draft papers in MYP Atlas.</p>
      <div className="space-y-4">
        {!papers?.length && <div className="bg-white border border-[#c3c6ce66] p-6 font-body text-[#43474d]">No papers found.</div>}
        {papers?.map((paper) => <div key={paper.id} className="bg-white border border-[#c3c6ce66] p-6 flex items-center justify-between gap-4"><div><h2 className="font-headline text-xl text-[#00152a]">{paper.title}</h2><p className="font-body text-sm text-[#43474d] mt-2">{paper.subjects?.name} · {paper.exam_sessions?.exam_month} {paper.exam_sessions?.exam_year}</p></div><span className={`text-xs uppercase tracking-widest ${paper.is_published ? 'text-[#00152a]' : 'text-[#735b2b]'}`}>{paper.is_published ? 'Published' : 'Draft'}</span></div>)}
      </div>
      <div className="mt-8"><AdSlot slot={adSlots.listFooter} label="Sponsored" /></div>
    </div>
  )
}
