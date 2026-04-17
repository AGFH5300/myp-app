"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AppIcon } from '@/components/app-icon'

type Subject = { id: string; name: string; icon: string | null }

export default function OnboardingPage() {
  const [gradeLevel, setGradeLevel] = useState(5)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const selectedSet = useMemo(() => new Set(selected), [selected])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('subjects').select('id,name,icon').order('name').then(({ data, error }) => {
      if (error) {
        setError(error.message)
        return
      }
      setSubjects(data || [])
      setSelected((data || []).slice(0, 2).map((s) => s.id))
    })
  }, [])

  async function saveOnboarding() {
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      setError('Please log in again to continue onboarding.')
      setLoading(false)
      return
    }

    const userId = authData.user.id
    const { data: existingSubjects } = await supabase
      .from('student_subjects')
      .select('subject_id')
      .eq('student_id', userId)

    const existingIds = new Set(existingSubjects?.map((s) => s.subject_id) ?? [])
    const toInsert = selected.filter((id) => !existingIds.has(id)).map((id) => ({ student_id: userId, subject_id: id }))
    const toDelete = [...existingIds].filter((id) => !selectedSet.has(id))

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from('student_subjects').insert(toInsert)
      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }
    }

    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase.from('student_subjects').delete().eq('student_id', userId).in('subject_id', toDelete)
      if (deleteError) {
        setError(deleteError.message)
        setLoading(false)
        return
      }
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ grade_level: gradeLevel, onboarding_completed: true })
      .eq('id', userId)

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen bg-[#fbf9f4] text-[#1b1c19] flex items-center justify-center p-6 md:p-12 lg:p-24">
      <div className="max-w-4xl w-full grid lg:grid-cols-12 gap-12 lg:gap-24">
        <div className="lg:col-span-5">
          <h1 className="font-headline text-5xl md:text-6xl text-[#00152a]">Welcome to MYP Atlas.</h1>
          <p className="font-body text-lg text-[#43474d] mt-4">Select your year and disciplines to tailor your workspace.</p>
        </div>
        <div className="lg:col-span-7 space-y-10">
          <section>
            <h2 className="font-headline text-2xl text-[#00152a] mb-4">Academic Year</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[4, 5].map((level) => <button key={level} onClick={() => setGradeLevel(level)} className={`p-6 border text-left ${gradeLevel === level ? 'bg-[#d1e4ff] border-[#d1e4ff]' : 'bg-white border-[#c3c6ce66]'}`}>MYP {level}</button>)}
            </div>
          </section>
          <section>
            <div className="flex justify-between items-baseline mb-4"><h2 className="font-headline text-2xl text-[#00152a]">Disciplines</h2><span className="font-label text-sm uppercase text-[#43474d]">Select Multiple</span></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">{subjects.map((subject) => {
              const active = selectedSet.has(subject.id)
              return <button key={subject.id} onClick={() => setSelected((prev) => prev.includes(subject.id) ? prev.filter((s) => s !== subject.id) : [...prev, subject.id])} className={`h-32 p-4 border rounded-lg flex flex-col items-center justify-center gap-3 ${active ? 'bg-[#f5f3ee] border-[#00152a]' : 'bg-white border-[#c3c6ce66]'}`}><AppIcon name={subject.icon || 'menu_book'} className="size-7 text-[#00152a]" /><span className="font-body text-sm text-center">{subject.name}</span></button>
            })}</div>
          </section>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end"><button className="bg-[#00152a] text-white px-8 py-3" disabled={loading || selected.length === 0} onClick={saveOnboarding}>{loading ? 'Saving...' : 'Continue'}</button></div>
        </div>
      </div>
    </main>
  )
}
