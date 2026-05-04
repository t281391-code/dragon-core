"use client";

import type { ReactNode } from "react";

export const REALTIME_REFRESH_MS = 5000;

type RealtimeBadgeProps = {
  lastUpdated: Date | null;
  label?: string;
};

export function RealtimeBadge({ lastUpdated, label = "LIVE" }: RealtimeBadgeProps) {
  return (
    <div className="realtime-badge" title="Dashboard data auto refreshes every 5 seconds">
      <span className="realtime-badge__dot" aria-hidden="true" />
      <span>{label}</span>
      <strong>
        {lastUpdated
          ? lastUpdated.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
          : "--:--:--"}
      </strong>
    </div>
  );
}

type ChartHintProps = {
  children: ReactNode;
};

export function ChartHint({ children }: ChartHintProps) {
  return (
    <div className="chart-hint">
      <span className="chart-hint__marker" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
