import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111827',
        graphite: '#1f2937',
        signal: '#2563eb',
        resolve: '#059669',
        warn: '#d97706',
        danger: '#dc2626',
      },
      boxShadow: {
        panel: '0 1px 2px rgba(17, 24, 39, 0.08)',
      },
    },
  },
  plugins: [],
}

export default config
