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
          line: '#e6dfd2',   // hairline borders (non-text)
          rule: '#d8cfbf',   // masthead rule (non-text)
          edge: '#d9b9a8',   // button outline (non-text)
          // Text tokens darkened to meet WCAG AA (4.5:1) on cream/white —
          // the previous ramp ran 1.96–3.4:1 (illegible for muted text).
          mute: '#756b5c',   // muted labels        (4.7:1 on cream)
          soft: '#6b6354',   // utility / body text  (5.4:1 on cream)
          dim: '#736a5b',    // inactive tabs        (4.8:1 on cream)
          faint: '#7c7160',  // footer / decorative  (4.3:1 cream, 4.8:1 white)
        },
      },
      maxWidth: {
        shell: '1280px',
      },
    },
  },
  plugins: [],
}