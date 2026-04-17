import Link from 'next/link'

export function SubjectCard({ subject, paperCount }: { subject: any; paperCount: number }) {
  return (
    <Link href={`/dashboard/subjects/${subject.id}`} className="bg-white border border-[#c3c6ce66] p-6 block hover:bg-[#f5f3ee]">
      <span className="material-symbols-outlined text-[#00152a]">menu_book</span>
      <h3 className="font-headline text-2xl text-[#00152a] mt-4">{subject.name}</h3>
      <p className="font-body text-sm text-[#43474d] mt-2">{subject.description || `Practice ${subject.name} questions`}</p>
      <p className="font-label text-xs uppercase tracking-widest text-[#43474d] mt-6">{paperCount} Papers</p>
    </Link>
  )
}
