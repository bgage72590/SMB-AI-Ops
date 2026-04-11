import type { Config } from "tailwindcss";

// Colors are wired to CSS variables defined in src/app/globals.css so the
// same class (e.g. `bg-surface`) follows whichever theme (light/dark)
// is active on the <html> element.
const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--bg) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        "surface-2": "hsl(var(--surface-2) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        "border-strong": "hsl(var(--border-strong) / <alpha-value>)",

        fg: "hsl(var(--fg) / <alpha-value>)",
        "fg-muted": "hsl(var(--fg-muted) / <alpha-value>)",
        "fg-subtle": "hsl(var(--fg-subtle) / <alpha-value>)",

        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          fg: "hsl(var(--accent-fg) / <alpha-value>)",
          soft: "hsl(var(--accent-soft) / <alpha-value>)",
        },

        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          soft: "hsl(var(--success-soft) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          soft: "hsl(var(--warning-soft) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "hsl(var(--danger) / <alpha-value>)",
          soft: "hsl(var(--danger-soft) / <alpha-value>)",
        },
        info: {
          DEFAULT: "hsl(var(--info) / <alpha-value>)",
          soft: "hsl(var(--info-soft) / <alpha-value>)",
        },

        // Legacy ink scale: keep as neutral grays so older components
        // that still reference ink-* don't break until the design pass
        // fully replaces them.
        ink: {
          50: "hsl(var(--surface-2) / <alpha-value>)",
          100: "hsl(var(--border) / <alpha-value>)",
          200: "hsl(var(--border-strong) / <alpha-value>)",
          300: "hsl(var(--fg-subtle) / <alpha-value>)",
          400: "hsl(var(--fg-subtle) / <alpha-value>)",
          500: "hsl(var(--fg-muted) / <alpha-value>)",
          600: "hsl(var(--fg-muted) / <alpha-value>)",
          700: "hsl(var(--fg) / <alpha-value>)",
          800: "hsl(var(--fg) / <alpha-value>)",
          900: "hsl(var(--fg) / <alpha-value>)",
        },
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
        ],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        pop: "var(--shadow-pop)",
      },
      ringColor: {
        DEFAULT: "hsl(var(--ring) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};

export default config;
