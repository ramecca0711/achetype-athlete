/**
 * AUTO-DOC: File overview
 * Purpose: Tailwind CSS configuration for design tokens and class scanning.
 * Related pages/files:
 * - Internal module with no static import map match.
 * Note: Update related files together when changing data shape or shared behavior.
 */
import type { Config } from "tailwindcss";

// Tailwind content globs for App Router and reusable components.
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {}
  },
  plugins: []
};

export default config;
