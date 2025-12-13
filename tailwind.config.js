import forms from "@tailwindcss/forms";
import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./main.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-blue': 'linear-gradient(135deg, #003d7a 0%, #0066cc 50%, #0088ff 100%)',
      },
    },
  },
  plugins: [forms, daisyui],
  daisyui: {
    themes: [
      "light",
      "dark",
    ],
    darkTheme: "dark",
  },
};
