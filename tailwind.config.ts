import type { Config } from 'tailwindcss';

export default {
  content: [
    './client/src/**/*.{ts,tsx,css}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0B1F3A',
          cyan: '#00C2B8',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
