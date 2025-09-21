/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Verona Sunset theme colors (Minted+Brides 2025)
        'paper-ivory': '#fdfdf8',
        'ink': {
          900: '#1a1a1a',
        },
        'henna': {
          100: '#fef5f0',
          300: '#f7c5a1',
          400: '#f3a56e',
          500: '#e8863b',
          600: '#d67027',
          700: '#b85817',
        },
        'foil-gold': '#d4af37',
        'foil-pale': '#f4e8a1',
      },
      boxShadow: {
        'foil-soft': '0 2px 8px rgba(212, 175, 55, 0.2)',
      },
      ringColor: {
        'henna-300': '#f7c5a1',
      },
      textDecorationColor: {
        'foil-gold/40': 'rgba(212, 175, 55, 0.4)',
      },
      borderColor: {
        'foil-gold/40': 'rgba(212, 175, 55, 0.4)',
      },
    },
  },
  plugins: [],
}