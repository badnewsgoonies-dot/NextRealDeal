/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        success: '#16a34a',
        danger: '#ef4444',
        surface: {
          light: '#ffffff',
          dark: '#0b1220',
        },
      },
      boxShadow: {
        card: '0 4px 14px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
}

