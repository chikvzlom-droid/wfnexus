/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["Orbitron", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        wf: {
          primary: "#00d4ff",
          secondary: "#7b61ff",
          gold: "#d4a843",
          accent: "#2dd4bf",
          dark: "#0a0f1e",
          bg: "var(--wf-bg)",
          card: "var(--wf-card)",
          surface: "var(--wf-surface)",
          danger: "#ef4444",
        },
      },
      boxShadow: {
        glow: "0 0 20px rgba(0, 212, 255, 0.15)",
        "glow-lg": "0 0 40px rgba(0, 212, 255, 0.25)",
        "glow-gold": "0 0 20px rgba(212, 168, 67, 0.15)",
      },
    },
  },
  plugins: [],
};
