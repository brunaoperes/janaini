import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Nova paleta feminina e tecnológica
        pink: {
          50: '#FCEBFB',
          100: '#F9D7F7',
          200: '#F4B0EF',
          300: '#EE88E7',
          400: '#E961DF',
          500: '#E339D7',
          600: '#B82DAC',
          700: '#8A2281',
          800: '#5C1756',
          900: '#2E0B2B',
        },
        purple: {
          50: '#F4EBFE',
          100: '#E9D7FD',
          200: '#D3AFFB',
          300: '#BD87F9',
          400: '#A75FF7',
          500: '#7B2FF7',
          600: '#6326C6',
          700: '#4B1C94',
          800: '#321363',
          900: '#190931',
        },
        lilac: {
          50: '#F8F3FE',
          100: '#F1E7FD',
          200: '#E3CFFB',
          300: '#D5B7F9',
          400: '#C89BFA',
          500: '#BA83F8',
          600: '#9569C6',
          700: '#704F95',
          800: '#4A3463',
          900: '#251A32',
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #FCEBFB, #C89BFA, #7B2FF7)',
        'gradient-soft': 'linear-gradient(135deg, #FCEBFB 0%, #F1E7FD 50%, #E9D7FD 100%)',
        'gradient-hover': 'linear-gradient(135deg, #E9D7FD, #BD87F9, #7B2FF7)',
        'gradient-dark': 'linear-gradient(135deg, #7B2FF7, #6326C6, #4B1C94)',
      },
      borderRadius: {
        'xl': '14px',
        '2xl': '16px',
        '3xl': '18px',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(123, 47, 247, 0.08)',
        'soft-lg': '0 4px 16px rgba(123, 47, 247, 0.12)',
        'soft-xl': '0 8px 24px rgba(123, 47, 247, 0.16)',
        'glow': '0 0 20px rgba(123, 47, 247, 0.3)',
        'glow-pink': '0 0 20px rgba(227, 57, 215, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'fade-in-up': 'fadeInUp 0.4s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'modal-in': 'modalIn 0.3s ease-out',
        'progress': 'progress 1s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        modalIn: {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(-10px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        progress: {
          '0%': { width: '0%' },
          '100%': { width: '100%' },
        },
      },
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [],
};
export default config;
