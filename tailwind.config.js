/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#fdfcf9',
          100: '#faf7f0',
          200: '#f5ede0',
          300: '#ede0cc',
          400: '#d9c4a8',
          500: '#c4a882',
        },
        warm: {
          brown: '#6b4f3a',
          dark: '#3d2b1f',
          light: '#a07850',
        },
        cat: {
          home: '#2f9e5f',
          eatout: '#d6862c',
          cafe: '#d15c87',
          delivery: '#5276c4',
        },
      },
      fontFamily: {
        sans: ['Pretendard', 'Noto Sans KR', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

