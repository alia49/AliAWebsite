/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');

// Colour tokens live in src/index.css as RGB triplets (e.g. `--g500: 115 115 115`)
// so Tailwind's opacity modifiers (`bg-ink/10`) keep working.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const ramp = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

module.exports = {
  content: ['./public/index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        ink: token('ink'),
        danger: token('danger'),
        g: Object.fromEntries(ramp.map((step) => [step, token(`g${step}`)])),
      },
      fontFamily: {
        sans: ['Geist', ...defaultTheme.fontFamily.sans],
        mono: ['"Geist Mono"', ...defaultTheme.fontFamily.mono],
        serif: ['"Source Serif 4"', ...defaultTheme.fontFamily.serif],
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(.16,1,.3,1)',
        deck: 'cubic-bezier(.22,1,.36,1)',
      },
    },
  },
  plugins: [],
};
