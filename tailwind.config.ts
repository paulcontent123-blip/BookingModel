import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0A0A',
        blue: { DEFAULT: '#0057FF', dark: '#0047D4' },
        green: '#00875A',
        orange: '#E8541A',
      },
      fontFamily: {
        mont: ['Montserrat', 'Arial', 'sans-serif'],
        arial: ['Arial', 'Helvetica Neue', 'sans-serif'],
        times: ['Times New Roman', 'Times', 'Georgia', 'serif'],
      },
    },
  },
  corePlugins: { preflight: false },
  plugins: [],
};
export default config;
