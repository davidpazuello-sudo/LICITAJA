/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: "#eff3fa",
        ink: "#111827",
        panel: "#F4F6FB",
        accent: "#2F6FED",
        accentDark: "#234BAA",
        sidebar: "#1F2D57",
        sidebarMuted: "#8FA1D6",
        slate: "#6B7280",
        line: "#E7EBF4",
        softBlue: "#EEF4FF"
      },
      boxShadow: {
        soft: "0 35px 60px -32px rgba(15, 23, 42, 0.28)",
        card: "0 18px 42px -34px rgba(15, 23, 42, 0.38)"
      },
      fontFamily: {
        heading: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

