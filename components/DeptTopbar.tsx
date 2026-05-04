"use client";

import { useThemeMode } from "@/components/ThemeProvider";
import { useDeptTheme } from "@/hooks/useDeptTheme";

type Props = {
  icon: string;
  title: string;
};

export function DeptTopbar({ icon, title }: Props) {
  const { accent, glow, dim } = useDeptTheme();
  const { mode, toggleMode } = useThemeMode();

  const now = new Date();
  const dateText = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(
    now.getDate()
  ).padStart(2, "0")}`;

return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <span className="page-dot" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
          <div className="page-title">
            <span>{icon}</span>
            <span>{title}</span>
          </div>
        </div>

        <div className="topbar-right">
          <button className="theme-toggle topbar-theme-toggle" type="button" onClick={toggleMode}>
            <span>{mode === "dark" ? "☀" : "☾"}</span>
            <span>{mode === "dark" ? "Light" : "Dark"}</span>
          </button>
          <div className="tb-date">{dateText}</div>
          <div className="topbar-live-stack">
            <div className="tb-live" style={{ color: accent, background: dim, borderColor: glow }}>
              REALTIME
            </div>
          </div>
        </div>
      </div>

    </>
  );
}
