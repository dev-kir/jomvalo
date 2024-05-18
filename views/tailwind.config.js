/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.{js,css}",
    "./views/**/*.ejs",
    "./node_modules/tw-elements/js/**/*.js",
  ],
  theme: {
    extend: {
      // custom font-family from google font
      fontFamily: {
        inconsolata: "'Inconsolata', monospace",
        opensans: "'Open Sans', sans-serif",
      }
    },
  },
  plugins: [],
};