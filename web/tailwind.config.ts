import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F4F1EA",
        surface: "#FBFAF6",
        rule: "#E2DDD1",
        ink: "#1A1A17",
        body: "#3D3A34",
        muted: "#8A8578",
        accent: "#2F5D50",
        bar: "#C9C3B5",
        track: "#EEEAE1"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"]
      },
      boxShadow: {
        hairline: "0 1px 2px rgba(26, 26, 23, 0.025)"
      }
    }
  },
  plugins: []
};

export default config;
