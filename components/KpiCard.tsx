"use client";

import { memo } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { useDeptTheme } from "@/hooks/useDeptTheme";

type Props = {
  label: string;
  value: ReactNode;
  change: ReactNode;
  icon?: ReactNode;
  cardClass?: string;
  valueClass?: string;
  valueStyle?: CSSProperties;
  changeClass?: string;
  changeStyle?: CSSProperties;
  sparkline?: number[];
  sparklineColor?: string;
  onClick?: () => void;
};

export const KpiCard = memo(function KpiCard({
  label,
  value,
  change,
  icon,
  cardClass = "",
  valueClass = "",
  valueStyle,
  changeClass = "",
  changeStyle,
  sparkline,
  sparklineColor,
  onClick,
}: Props) {
  const { glow, accent } = useDeptTheme();
  const lineColor = sparklineColor ?? accent;
  const sparkData = sparkline?.map((v) => ({ v }));

  return (
    <div
      className={`kpi-card ${cardClass}`}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      } : undefined}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <div className="kpi-card-glow" style={{ background: glow }} />
      {icon ? <div className="kpi-icon">{icon}</div> : null}
      <div className="kpi-label">{label}</div>
      <div className={`kpi-val${valueClass ? ` ${valueClass}` : ""}`} style={valueStyle}>
        {value}
      </div>
      <div className={`kpi-sub${changeClass ? ` ${changeClass}` : ""}`} style={changeStyle}>
        {change}
      </div>
      {sparkData && sparkData.length > 1 ? (
        <div style={{ height: 44, marginTop: 10, marginLeft: -4, marginRight: -4 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={lineColor}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
});
