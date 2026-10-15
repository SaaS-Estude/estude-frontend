import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './context/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#12233f',
        brand: {
          50: '#eef7ff',
          100: '#d9ecff',
          200: '#bcddff',
          300: '#8ec8ff',
          400: '#59a8ff',
          500: '#3488fb',
          600: '#2269ef',
          700: '#1a53dc',
          800: '#1c45b2',
          900: '#1d3d8c',
        },
      },
      boxShadow: {
        soft: '0 24px 80px rgba(24, 58, 112, 0.14)',
        card: '0 14px 40px rgba(28, 57, 104, 0.08)',
      },
      animation: {
        float: 'float 7s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
