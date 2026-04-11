import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f7f9",
          100: "#e9ecf1",
          200: "#cfd5df",
          300: "#a8b2c3",
          400: "#74819a",
          500: "#4f5c78",
          600: "#3b475f",
          700: "#2d374b",
          800: "#1d2536",
          900: "#11172a",
        },
        accent: {
          DEFAULT: "#7c5cff",
          soft: "#eae4ff",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(17,23,42,0.04), 0 8px 24px -12px rgba(17,23,42,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
