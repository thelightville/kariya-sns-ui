import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'K-SNS Operator Console',
  description: 'Dedicated Security Nervous System operator UI for Kariya.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
