import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1d9bf0',
        background: '#000000',
        surface: '#0f1419',
        'surface-elevated': '#16181c',
        border: '#2f3336',
        'text-primary': '#dfe3ea',
        'text-muted': '#71767b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'body-lg': ['15px', { lineHeight: '1.6', letterSpacing: '0', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '400' }],
        'label-caps': ['11px', { lineHeight: '1', letterSpacing: '0.05em', fontWeight: '600' }],
        'display-lg': ['32px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '800' }],
        'headline-md': ['20px', { lineHeight: '1.4', letterSpacing: '-0.01em', fontWeight: '700' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      maxWidth: {
        'layout': '1300px',
      },
      width: {
        'sidebar-left': '256px',
        'sidebar-right': '320px',
        'center': '600px',
      },
    },
  },
  plugins: [],
}

export default config