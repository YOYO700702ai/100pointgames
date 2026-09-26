module.exports = {
  content: ['./src/**/*.{html,jsx,js}'],
  theme: {
    extend: {
      // These existing game classes are not part of Tailwind's default scale.
      borderWidth: { 3: '3px' },
      zIndex: { 25: '25' },
      fontFamily: { sans: ['Noto Sans TC', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
