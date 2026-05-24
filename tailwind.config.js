/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        crbn: {
          black: '#000000',
          white: '#ffffff',
          gray: '#f5f5f5',
        },
      },
    },
  },
  plugins: [],
};
