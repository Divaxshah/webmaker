"use client";

export type ThemeMode = "dark" | "light";

export const getCurrentThemeMode = (): ThemeMode => {
  if (typeof document === "undefined") {
    return "dark";
  }

  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
};

export const applyThemeMode = (theme: ThemeMode): void => {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem("webmaker-theme", theme);
};
