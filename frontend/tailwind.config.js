/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Editorial wedding redesign — Cormorant Garamond for display serif,
        // Jost for UI/body. See "Wedding Gallery.dc.html" design handoff.
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Jost', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Wedding palette
        cream: '#f7f3ec',
        ink: '#2c271f',
        terracotta: '#ad5f3c',
        sand: {
          line: '#e6dfd2',   // hairline borders
          rule: '#d8cfbf',   // masthead rule
          edge: '#d9b9a8',   // button outline
          mute: '#9a9082',   // muted labels
          soft: '#7d7466',   // utility-bar text
          dim: '#8c8375',    // inactive tabs
          faint: '#bcae9b',  // footer / decorative
        },
      },
      maxWidth: {
        shell: '1280px',
      },
    },
  },
  plugins: [],
}