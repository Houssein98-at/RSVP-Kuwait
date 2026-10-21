/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        burgundy: {
          50: '#FBF2F4',
          100: '#F5E2E6',
          200: '#ECC8D0',
          300: '#DC9FB0',
          400: '#A63E5A',
          500: '#832B43',
          600: '#6B2337', // User-specified Primary Burgundy
          700: '#551B2B',
          800: '#431422',
          900: '#2D0B16',
          950: '#1D050D',
        },
        beige: {
          50: '#FAF8F4', // Warm white
          100: '#F5EFE5',
          200: '#EDE1CF', // User-specified Primary Beige
          300: '#DFCBB2',
          400: '#CEB392',
          500: '#BA9A73',
          600: '#A1805B',
          700: '#826444',
          800: '#634C32',
          900: '#443320',
        },
        olive: {
          50: '#F6F7F1',
          100: '#ECEFE1',
          200: '#D9DEC5',
          300: '#BFC7A2',
          400: '#8F9B64',
          500: '#78844F',
          600: '#667044', // User-specified Primary Olive Green
          700: '#505835',
          800: '#3D4328',
          900: '#2A2E1C',
        },
        charcoal: {
          50: '#F7F7F6',
          100: '#EDEDEB',
          200: '#D8D8D5',
          300: '#AEAEA8',
          400: '#797972',
          500: '#52524C',
          600: '#3E3E39',
          700: '#31312C',
          800: '#252522', // User-specified Dark Charcoal
          900: '#1C1C19',
          950: '#121210',
        },
        warmwhite: '#FAF8F4',
        // Backward-compatibility aliases mapped to new palette
        gold: {
          50: '#FAF8F4',
          100: '#F5EFE5',
          200: '#EDE1CF',
          300: '#DFCBB2',
          400: '#8F9B64',
          500: '#667044',
          600: '#6B2337',
          700: '#551B2B',
          800: '#431422',
          900: '#2D0B16',
        },
        ivory: {
          50: '#FAF8F4',
          100: '#F5EFE5',
          200: '#EDE1CF',
          300: '#DFCBB2',
          400: '#CEB392',
        },
        emerald: {
          950: '#0C201A',
          900: '#13352B',
          800: '#1D4D3E',
          700: '#15803D',
          600: '#16A34A',
          500: '#22C55E',
        }
      },
      fontFamily: {
        arabic: ['Amiri', 'Cairo', 'Tajawal', 'serif'],
        cairo: ['Cairo', 'sans-serif'],
        tajawal: ['Tajawal', 'sans-serif'],
        display: ['Playfair Display', 'Cinzel', 'serif'],
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'luxury': '0 10px 30px -5px rgba(107, 35, 55, 0.12), 0 0 0 1px rgba(107, 35, 55, 0.18)',
        'luxury-hover': '0 20px 40px -10px rgba(107, 35, 55, 0.22), 0 0 0 1px rgba(107, 35, 55, 0.32)',
        'olive': '0 10px 25px -5px rgba(102, 112, 68, 0.25), 0 0 0 1px rgba(102, 112, 68, 0.2)',
        'card': '0 4px 20px -2px rgba(37, 37, 34, 0.05), 0 0 0 1px rgba(223, 203, 178, 0.7)',
      },
      animation: {
        'pulse-subtle': 'pulseSubtle 3s ease-in-out infinite',
        'scan-laser': 'scanLaser 2.2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
      },
      keyframes: {
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        scanLaser: {
          '0%, 100%': { transform: 'translateY(0%)', opacity: '0.9' },
          '50%': { transform: 'translateY(100%)', opacity: '0.5' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
