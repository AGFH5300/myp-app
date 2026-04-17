import type { Metadata } from 'next'
import { Newsreader, Manrope } from 'next/font/google'
import './globals.css'

const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-newsreader' })
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' })

const siteTitle = 'MYP Atlas'
const siteDescription = 'MYP Atlas is a premium MYP eAssessment preparation workspace for focused, criterion-aligned practice.'

export const metadata: Metadata = {
  metadataBase: new URL('https://mypatlas.com'),
  title: {
    default: siteTitle,
    template: `%s · ${siteTitle}`,
  },
  description: siteDescription,
  applicationName: siteTitle,
  keywords: ['MYP', 'eAssessment', 'study', 'practice', 'IB Middle Years Programme'],
  icons: {
    icon: '/myp-atlas-icon.svg',
    shortcut: '/myp-atlas-icon.svg',
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    type: 'website',
    siteName: siteTitle,
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
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
