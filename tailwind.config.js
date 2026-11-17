/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './*.{js,ts,jsx,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        tennis: {
          ball: '#ccff00',
          clay: '#c2410c',
          court: '#059669',
          hard: '#0284c7',
        },
      },
    },
  },
  plugins: [],
};
