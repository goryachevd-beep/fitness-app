/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#070b14',
          900: '#0b1120',
          850: '#111a2e',
          800: '#16213a',
          700: '#1e2b47',
          600: '#2a3a5c',
        },
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        lime: {
          400: '#a3e635',
          500: '#84cc16',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(52,211,153,0.2), 0 8px 30px -10px rgba(16,185,129,0.35)',
      },
    },
  },
  plugins: [],
};
