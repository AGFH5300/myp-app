"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Subject = { id: string; name: string }

export default function OnboardingPage() {
  const [mypYear, setMypYear] = useState('5')
  const [school, setSchool] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [chosenSubjects, setChosenSubjects] = useState<string[]>([])
  const [practiceFocus, setPracticeFocus] = useState('')
  const [preferredSession, setPreferredSession] = useState<'May' | 'November' | ''>('')
  const [preferredYear, setPreferredYear] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    createClient().from('subjects').select('id,name').order('name').then(({ data, error }) => {
      if (error) return setError(error.message)
      setSubjects(data || [])
    })
  }, [])

  async function saveOnboarding() {
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      setError('Session expired. Please log in again.')
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email: authData.user.email,
        myp_year: Number(mypYear),
        school,
        selected_subject_ids: chosenSubjects,
        practice_focus: practiceFocus,
        preferred_session: preferredSession || null,
        preferred_year: preferredYear ? Number(preferredYear) : null,
        onboarding_completed: true,
      })

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen bg-[#fbf9f4] text-[#1b1c19] p-6 md:p-10 lg:p-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative overflow-hidden rounded-md border border-[#c3c6ce66] bg-[#ece7db] p-8 md:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_15%,rgba(115,91,43,0.16),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(0,21,42,0.10),transparent_40%)]" />
          <div className="relative">
            <p className="font-label text-xs uppercase tracking-[.16em] text-[#43474d]">Onboarding</p>
            <h1 className="mt-4 font-headline text-5xl leading-[1.08] text-[#00152a]">Set your archive to match how you revise.</h1>
            <p className="mt-6 max-w-md font-body text-base leading-relaxed text-[#43474d]">
              A few preferences help MYP Atlas surface relevant papers and questions first, so your dashboard starts with context instead of clutter.
            </p>
            <div className="mt-8 rounded-md border border-[#c3c6ce66] bg-white/75 p-5">
              <p className="font-label text-xs uppercase tracking-[.12em] text-[#43474d]">What this influences</p>
              <ul className="mt-4 space-y-2 font-body text-sm text-[#43474d]">
                <li>• Subject-first browsing on your dashboard</li>
                <li>• Session and year defaults for archive views</li>
                <li>• Faster returns to your saved weak areas</li>
              </ul>
            </div>
          </div>
        </aside>

        <section className="rounded-md border border-[#c3c6ce66] bg-white p-8 md:p-10">
          <div>
            <h2 className="font-headline text-4xl text-[#00152a]">Study profile</h2>
            <p className="mt-3 font-body text-[#43474d]">Keep it practical. You can change these preferences later.</p>
          </div>

          <div className="mt-8 grid md:grid-cols-2 gap-6">
            <div><label className="font-label text-xs uppercase tracking-widest text-[#43474d]">MYP year</label><select className="tsm-input" value={mypYear} onChange={(e) => setMypYear(e.target.value)}><option value="4">MYP 4</option><option value="5">MYP 5</option></select></div>
            <div><label className="font-label text-xs uppercase tracking-widest text-[#43474d]">School</label><input className="tsm-input" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Your school" required /></div>
          </div>

          <div className="mt-8">
            <label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Subjects you care about most</label>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              {subjects.map((subject) => {
                const active = chosenSubjects.includes(subject.id)
                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => setChosenSubjects((prev) => prev.includes(subject.id) ? prev.filter((id) => id !== subject.id) : [...prev, subject.id])}
                    className={`text-left px-4 py-3 border rounded-md ${active ? 'border-[#00152a] bg-[#f5f3ee]' : 'border-[#c3c6ce66] bg-white'}`}
                  >
                    {subject.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-8"><label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Current revision focus</label><textarea className="tsm-input min-h-28" value={practiceFocus} onChange={(e) => setPracticeFocus(e.target.value)} placeholder="Examples: command terms in sciences, algebra-heavy papers, November sessions" /></div>

          <div className="mt-8 grid md:grid-cols-2 gap-6">
            <div><label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Preferred session (optional)</label><select className="tsm-input" value={preferredSession} onChange={(e) => setPreferredSession(e.target.value as 'May' | 'November' | '')}><option value="">No preference</option><option value="May">May</option><option value="November">November</option></select></div>
            <div><label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Preferred year (optional)</label><input className="tsm-input" type="number" min={2016} max={2025} value={preferredYear} onChange={(e) => setPreferredYear(e.target.value)} placeholder="2016 to 2025" /></div>
          </div>

          {error && <p className="mt-6 text-sm text-red-700">{error}</p>}
          <div className="mt-8 flex justify-end"><button className="bg-[#00152a] text-white px-8 py-3 rounded-sm" disabled={loading || !school || chosenSubjects.length === 0} onClick={saveOnboarding}>{loading ? 'Saving...' : 'Finish onboarding'}</button></div>
        </section>
      </div>
    </main>
  )
}
