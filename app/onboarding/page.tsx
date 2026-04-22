"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Subject = { id: string; name: string }
const SIGNUP_DRAFT_KEY = 'myp_signup_profile'

export default function OnboardingPage() {
  const [mypYear, setMypYear] = useState('5')
  const [school, setSchool] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [chosenSubjects, setChosenSubjects] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    createClient().from('subjects').select('id,name').order('name').then(({ data, error }) => {
      if (error) {
        setError('Unable to load subjects right now. Please add/check subjects in Supabase and refresh.')
        return
      }
      if (!data || data.length === 0) {
        setError('No subjects found yet. Add subjects in Supabase to continue.')
        return
      }
      setSubjects(data)
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
        myp_year: mypYear === 'other' ? null : Number(mypYear),
        school,
        selected_subject_ids: chosenSubjects,
        onboarding_completed: true,
      })

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(SIGNUP_DRAFT_KEY)
    }

    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen bg-[#fbf9f4] text-[#1b1c19] p-6 md:p-10 lg:p-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative overflow-hidden rounded-md border border-[#c3c6ce66] bg-[#ece7db] p-8 md:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_15%,rgba(115,91,43,0.16),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(0,21,42,0.10),transparent_40%)]" />
          <div className="relative">
            <h1 className="font-headline text-5xl leading-[1.08] text-[#00152a]">Set your archive to match how you revise.</h1>
            <p className="mt-6 max-w-md font-body text-base leading-relaxed text-[#43474d]">
              A few preferences help MYP Atlas surface relevant papers and questions first, so your dashboard starts with context instead of clutter.
            </p>
            <div className="mt-8 rounded-md border border-[#c3c6ce66] bg-white/75 p-5">
              <p className="font-label text-xs uppercase tracking-[.12em] text-[#43474d]">What this influences</p>
              <ul className="mt-4 space-y-2 font-body text-sm text-[#43474d]">
                <li>• Subject-first browsing on your dashboard</li>
                <li>• Better paper recommendations for your MYP level</li>
                <li>• Faster returns to the topics you revise most often</li>
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
            <div><label className="font-label text-xs uppercase tracking-widest text-[#43474d]">MYP year</label><select className="tsm-input" value={mypYear} onChange={(e) => setMypYear(e.target.value)}><option value="3">MYP 3</option><option value="4">MYP 4</option><option value="5">MYP 5</option><option value="other">Other</option></select></div>
            <div><label className="font-label text-xs uppercase tracking-widest text-[#43474d]">School</label><input className="tsm-input" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Your school" required /></div>
          </div>

          <div className="mt-8">
            <label className="font-label text-xs uppercase tracking-widest text-[#43474d]">Subjects to focus on</label>
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
            {subjects.length === 0 && <p className="mt-3 font-body text-sm text-[#43474d]">No subjects available yet. Add subject rows in Supabase first, then refresh this page.</p>}
          </div>

          {error && <p className="mt-6 text-sm text-red-700">{error}</p>}
          <div className="mt-8 flex justify-end"><button className="bg-[#00152a] text-white px-8 py-3 rounded-sm" disabled={loading || !school || chosenSubjects.length === 0} onClick={saveOnboarding}>{loading ? 'Saving...' : 'Finish onboarding'}</button></div>
        </section>
      </div>
    </main>
  )
}
