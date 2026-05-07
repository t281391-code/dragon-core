"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export type DeptTheme = {
  accent: string;
  glow: string;
  dim: string;
};

const DEPT_THEMES: { prefix: string; theme: DeptTheme }[] = [
  { prefix: "/warehouse",  theme: { accent: "#F59E0B", glow: "rgba(245,158,11,0.18)", dim: "rgba(245,158,11,0.08)" } },
  { prefix: "/production", theme: { accent: "#10B981", glow: "rgba(16,185,129,0.18)", dim: "rgba(16,185,129,0.08)" } },
  { prefix: "/safety",     theme: { accent: "#EF4444", glow: "rgba(239,68,68,0.18)",  dim: "rgba(239,68,68,0.08)"  } },
  { prefix: "/logistics",  theme: { accent: "#3B82F6", glow: "rgba(59,130,246,0.18)", dim: "rgba(59,130,246,0.08)" } },
  { prefix: "/shifts",     theme: { accent: "#06B6D4", glow: "rgba(6,182,212,0.18)",  dim: "rgba(6,182,212,0.08)"  } },
];

const DEFAULT_THEME: DeptTheme = DEPT_THEMES[0].theme;

export function useDeptTheme(): DeptTheme {
  const pathname = usePathname();
  const theme = DEPT_THEMES.find(({ prefix }) => pathname.startsWith(prefix))?.theme ?? DEFAULT_THEME;

  useEffect(() => {
    const el = document.documentElement;
    el.style.setProperty("--accent", theme.accent);
    el.style.setProperty("--accent-glow", theme.glow);
    el.style.setProperty("--accent-dim", theme.dim);
  }, [theme.accent, theme.glow, theme.dim]);

  return theme;
}
