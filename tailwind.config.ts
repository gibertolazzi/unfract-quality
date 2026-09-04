import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./layout.tsx",
    "./page.tsx"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["SF Pro", "sans-serif"],
        halfre: ["Halfre", "sans-serif"],
      },
      colors: {
        background: "#080808",
        foreground: "#FFFFFF",
      },
      animation: {
        'blob': "blob 7s infinite",
        'blob-delayed': "blob 7s infinite 2s",
        'pulse-slow': "pulse-slow 8s ease-in-out infinite",
        'float-slow': "float-slow 12s ease-in-out infinite",
        'float-delayed': "float-slow 12s ease-in-out infinite 6s",
      },
      keyframes: {
        blob: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(20px, -30px) scale(1.1)" },
          "66%": { transform: "translate(-10px, 20px) scale(0.9)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" }
        },
        'pulse-slow': {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        'float-slow': {
          "0%": { transform: "translate(-50%, -50%) rotate(0deg) scale(1)" },
          "33%": { transform: "translate(-48%, -52%) rotate(2deg) scale(1.05)" },
          "66%": { transform: "translate(-52%, -48%) rotate(-2deg) scale(0.95)" },
          "100%": { transform: "translate(-50%, -50%) rotate(0deg) scale(1)" },
        }
      }
    },
  },
  plugins: [],
};
export default config;
