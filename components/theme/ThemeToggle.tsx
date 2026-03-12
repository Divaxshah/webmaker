"use client";

import { Moon, SunMedium } from "lucide-react";
import { useEffect, useState } from "react";
import {
  applyThemeMode,
  getCurrentThemeMode,
  type ThemeMode,
} from "@/hooks/useThemeMode";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    setTheme(getCurrentThemeMode());
  }, []);

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    applyThemeMode(nextTheme);
    setTheme(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-[var(--wm-text)] transition"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? <SunMedium size={14} /> : <Moon size={14} />}
      <span>{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}
