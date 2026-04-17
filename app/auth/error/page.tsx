import Link from 'next/link'

export default async function Page({ searchParams }: { searchParams: Promise<{ error: string }> }) {
  const params = await searchParams

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-[#fbf9f4]">
      <div className="w-full max-w-lg border border-[#c3c6ce66] bg-white p-8">
        <h1 className="font-headline text-3xl text-[#00152a]">MYP Atlas authentication issue</h1>
        {params?.error ? (
          <p className="text-sm text-[#43474d] mt-4">Error details: {params.error}</p>
        ) : (
          <p className="text-sm text-[#43474d] mt-4">An unspecified authentication error occurred.</p>
        )}
        <div className="mt-6"><Link href="/auth/login" className="tsm-btn-primary">Back to Login</Link></div>
      </div>
    </div>
  )
}
