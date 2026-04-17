import type { Metadata } from 'next'
import { Newsreader, Manrope } from 'next/font/google'
import './globals.css'

const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-newsreader' })
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' })

const siteTitle = 'MYP Atlas'
const siteDescription = 'MYP Atlas provides real MYP eAssessment past papers, real questions, and real markschemes from 2016 to 2025.'

export const metadata: Metadata = {
  metadataBase: new URL('https://mypatlas.com'),
  title: {
    default: siteTitle,
    template: `%s · ${siteTitle}`,
  },
  description: siteDescription,
  applicationName: siteTitle,
  keywords: ['MYP', 'eAssessment', 'past papers', 'markscheme', '2016', '2025', 'IB Middle Years Programme'],
  icons: {
    icon: '/myp-atlas-icon.svg',
    shortcut: '/myp-atlas-icon.svg',
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
