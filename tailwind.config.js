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
        // ── KURUMSAL PALET ─────────────────────────────────────
        // 01 Deep Teal  #114956 → büyük koyu yüzeyler + birincil aksiyon
        // 02 Yellow     #F4F818 → tek vurgu rengi (az ve yerinde)
        // 03 Carbon     #1F2121 → metin (büyük zemin olarak KULLANILMAZ)
        // 04 WhiteSmoke #F4F4F4 → sayfa zemini
        // Ana1/Ana2 logo renkleri sadece ikon, ok, çizgi gibi küçük öğelerde.
        brand: {
          50:  '#eef4f6',
          100: '#d6e5e9',
          200: '#adc9d1',
          300: '#7fa9b5',
          400: '#54889a',
          500: '#2d6779',
          600: '#114956',
          700: '#0e3c47',
          800: '#0b2f38',
          900: '#08232a',
          950: '#04171c',
        },
        accent: {
          50:  '#f2ecf7',
          100: '#e3d8ee',
          200: '#c7b1dd',
          300: '#a888c9',
          400: '#8a63b1',
          500: '#744d9b',
          600: '#643e87',
          700: '#52326f',
          800: '#3f2756',
          900: '#2c1b3c',
          950: '#180f21',
        },
        // 02 — vurgu sarısı
        pop: {
          50:  '#fdfee0',
          100: '#fbfdb3',
          200: '#f8fb66',
          300: '#f6fa3f',
          400: '#f4f818',
          500: '#f4f818',
          600: '#d4d800',
          700: '#a8ab00',
          800: '#7c7e00',
          900: '#4f5100',
        },
        // 03 — karbon (metin ve ince çizgiler)
        ink: {
          DEFAULT: '#1F2121',
          900: '#1F2121',
          800: '#2e3131',
          700: '#454949',
          600: '#5c6161',
          500: '#767b7b',
          400: '#9aa0a0',
          300: '#c2c7c7',
          200: '#dee1e1',
          100: '#ebeded',
          50:  '#f4f4f4',
        },
        // 01 ve Ana renkler — küçük öğeler için doğrudan erişim
        logo: {
          teal:   '#00a499',
          purple: '#643e87',
        },
        smoke: '#F4F4F4',
      },
      boxShadow: {
        'card':      '0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        'card-hover':'0 8px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)',
        'glow-brand':'0 0 0 3px rgba(17,73,86,0.22)',
        'glow-sm':   '0 4px 14px rgba(17,73,86,0.22)',
        'glow-md':   '0 8px 32px rgba(17,73,86,0.28)',
        'glow-lg':   '0 12px 48px rgba(17,73,86,0.32)',
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
