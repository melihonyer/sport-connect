export default {
  content: [
    "./index.html",
    "./*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        smooch:  ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#e5f9f9',
          100: '#cbf3f3',
          200: '#97e7e8',
          300: '#63dbdc',
          400: '#2fcfd0',
          500: '#00c3c5',
          600: '#00b7ba',
          700: '#009295',
          800: '#006d6f',
          900: '#004849',
          950: '#002324',
        },
        accent: {
          50:  '#f8e8ff',
          100: '#f0d0ff',
          200: '#e1a1ff',
          300: '#d272ff',
          400: '#c343ff',
          500: '#b414ff',
          600: '#981dd8',
          700: '#7a16ad',
          800: '#5c1082',
          900: '#3e0a57',
          950: '#1f052b',
        },
      },
      boxShadow: {
        'card':      '0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        'card-hover':'0 8px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)',
        'glow-brand':'0 0 0 3px rgba(0,183,186,0.25)',
        'glow-sm':   '0 4px 14px rgba(0,183,186,0.30)',
        'glow-md':   '0 8px 32px rgba(0,183,186,0.40)',
        'glow-lg':   '0 12px 48px rgba(0,183,186,0.45)',
      },
      keyframes: {
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%':   { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        popIn: {
          '0%':   { opacity: '0', transform: 'scale(0.92)' },
          '70%':  { transform: 'scale(1.02)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in-up':   'fadeInUp 0.4s ease forwards',
        'fade-in':      'fadeIn 0.3s ease forwards',
        'slide-in-right': 'slideInRight 0.35s ease forwards',
        'pop-in':       'popIn 0.3s ease forwards',
        'shimmer':      'shimmer 2s linear infinite',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      scale: {
        '97': '0.97',
        '98': '0.98',
        '102': '1.02',
        '103': '1.03',
      },
    },
  },
  plugins: [],
}
