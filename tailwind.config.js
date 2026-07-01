/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Shared with @kariya/ui (kariya-ui/tailwind.config.base.js) — kept in
        // sync manually for Alpha 1. See README for rationale on not consuming
        // @kariya/ui as a package dependency yet.
        kariya: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea6100',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        navy: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d8fe',
          300: '#a4befd',
          400: '#7f9ef9',
          500: '#6076f4',
          600: '#4655e7',
          700: '#3844cc',
          800: '#2f37a5',
          900: '#1e1f4f',
          950: '#0f1028',
        },
        threat: {
          low: '#22c55e',
          medium: '#f59e0b',
          high: '#ef4444',
          critical: '#7c3aed',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
