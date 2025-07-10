/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "moley-salmon": "#eb7e77",
        "moley-sage": "#829e9f",
        "moley-darkSage": "#526969",
        "moley-lightSage": "#b0c4c4",
        "moley-beige": "#ecd7cb",
        "moley-blue": "#3a7a7a",
        "moley-lightBlue": "#9cc6c6",
        "moley-backgroundGreen": "#a0b2a5",
        "moley-backgroundLightGreen": "#c4cbc4",
        "moley-backgroundDarkGreen": "#7a8f8f",
        "moley-darkGreen": "#3f7c7c",
        "moley-green": "#6b9c9c",
        "moley-accentGreen": "#4a8c8c",
      },
      screens: {
        "3xl": "2000px",
      }
    },
  },
  plugins: [],
};
