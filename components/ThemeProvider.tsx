"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useDeptTheme } from "@/hooks/useDeptTheme";

type ThemeMode = "dark" | "light";
type AccessibilityMode = "default" | "low-vision" | "color-blind";

type ThemeModeContextValue = {
  mode: ThemeMode;
  accessibilityMode: AccessibilityMode;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
  setAccessibilityMode: (mode: AccessibilityMode) => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);
const themeModeListeners = new Set<() => void>();
const accessibilityListeners = new Set<() => void>();

function notify(listeners: Set<() => void>) {
  listeners.forEach((listener) => listener());
}

function getStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  return window.localStorage.getItem("dashboard-theme-mode") === "dark" ? "dark" : "light";
}

function subscribeThemeMode(listener: () => void) {
  themeModeListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === "dashboard-theme-mode") listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    themeModeListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function setStoredThemeMode(mode: ThemeMode) {
  window.localStorage.setItem("dashboard-theme-mode", mode);
  notify(themeModeListeners);
}

function toggleStoredThemeMode() {
  setStoredThemeMode(getStoredThemeMode() === "dark" ? "light" : "dark");
}

function getStoredAccessibilityMode(): AccessibilityMode {
  if (typeof window === "undefined") return "default";
  const stored = window.localStorage.getItem("dashboard-accessibility-mode");
  return stored === "low-vision" || stored === "color-blind" ? stored : "default";
}

function subscribeAccessibilityMode(listener: () => void) {
  accessibilityListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === "dashboard-accessibility-mode") listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    accessibilityListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function setStoredAccessibilityMode(mode: AccessibilityMode) {
  window.localStorage.setItem("dashboard-accessibility-mode", mode);
  notify(accessibilityListeners);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { accent, glow, dim } = useDeptTheme();
  const mode = useSyncExternalStore<ThemeMode>(subscribeThemeMode, getStoredThemeMode, () => "light");
  const accessibilityMode = useSyncExternalStore<AccessibilityMode>(
    subscribeAccessibilityMode,
    getStoredAccessibilityMode,
    () => "default"
  );

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-glow", glow);
    root.style.setProperty("--accent-dim", dim);

    body.classList.remove("theme-dark", "theme-light");
    body.classList.add(mode === "light" ? "theme-light" : "theme-dark");
    body.style.colorScheme = mode;
  }, [accent, glow, dim, mode]);

  useEffect(() => {
    const body = document.body;

    body.classList.remove("access-low-vision", "access-color-blind");
    if (accessibilityMode === "low-vision") body.classList.add("access-low-vision");
    if (accessibilityMode === "color-blind") body.classList.add("access-color-blind");
  }, [accessibilityMode]);

  const value = useMemo<ThemeModeContextValue>(
    () => ({
      mode,
      accessibilityMode,
      toggleMode: toggleStoredThemeMode,
      setMode: setStoredThemeMode,
      setAccessibilityMode: setStoredAccessibilityMode,
    }),
    [accessibilityMode, mode]
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);

  if (!context) {
    throw new Error("useThemeMode must be used within ThemeProvider");
  }

  return context;
}
