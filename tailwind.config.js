/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#EEF3FB",
          100: "#D6E2F2",
          200: "#A8BFE0",
          300: "#7A9CCE",
          400: "#3C6DB4",
          500: "#003580",
          600: "#002F73",
          700: "#002660",
          800: "#001D4A",
          900: "#001236",
        },
        ink: {
          50:  "#F7F9FC",
          100: "#F1F4F9",
          150: "#E8ECF2",
          200: "#DCE2EB",
          300: "#C2CAD6",
          400: "#9AA3B2",
          500: "#6E7785",
          600: "#4B5563",
          700: "#2F3744",
          800: "#1A2030",
          900: "#0E1320",
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', "var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ['"DM Mono"', "var(--font-geist-mono)", "monospace"],
      },
      boxShadow: {
        card:    "0 1px 0 0 rgba(15,23,42,0.04), 0 1px 2px 0 rgba(15,23,42,0.04)",
        "card-md": "0 4px 12px -4px rgba(15,23,42,0.08), 0 2px 4px -2px rgba(15,23,42,0.04)",
        sheet:   "0 -8px 24px -4px rgba(15,23,42,0.12), 0 -2px 6px -2px rgba(15,23,42,0.06)",
      },
      keyframes: {
        shimmer: {
          "0%":   { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        sheetIn: {
          from: { transform: "translateY(100%)" },
          to:   { transform: "translateY(0)" },
        },
      },
      animation: {
        shimmer:  "shimmer 1.4s linear infinite",
        "slide-up": "slideUp 0.25s ease-out forwards",
        "sheet-in": "sheetIn 0.35s cubic-bezier(.2,.7,.2,1) forwards",
      },
    },
  },
  plugins: [],
};
