export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1B4FD8', 50: '#EEF2FF', 100: '#C7D2FE', 500: '#3B82F6', 600: '#1B4FD8', 700: '#1D40AF' },
        brand: { green: '#0F6E56' }
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: []
}
