import type { Metadata } from 'next'
import { Newsreader, Manrope } from 'next/font/google'
import './globals.css'

const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-newsreader' })
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' })

export const metadata: Metadata = {
  title: {
    default: 'MYP Atlas',
    template: '%s · MYP Atlas',
  },
  description: 'Premium MYP eAssessment preparation workspace.',
  icons: {
    icon: '/icon-light-32x32.png',
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-[#fbf9f4]">
      <body className={`${newsreader.variable} ${manrope.variable} min-h-screen bg-[#fbf9f4] text-[#1b1c19] antialiased`}>
        <style>{`.font-headline{font-family:var(--font-newsreader),serif}.font-body,.font-label{font-family:var(--font-manrope),sans-serif}`}</style>
        {children}
      </body>
    </html>
  )
}
