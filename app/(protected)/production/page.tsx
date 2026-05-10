"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/components/AuthProvider";
import { AiDecisionCenter, DashboardEmptyState, PriorityStatusBar } from "@/components/DashboardUX";
import { DeptTopbar } from "@/components/DeptTopbar";
import { KpiCard } from "@/components/KpiCard";
import { ChartHint, RealtimeBadge, REALTIME_REFRESH_MS } from "@/components/RealtimeBadge";
import { getDefaultEquipmentRpm, getSuggestedEquipmentNames } from "@/lib/equipmentConfig";
import {
  getProductRecipe,
  MANUAL_EXPLOSIVE_INPUTS,
  requiresManualMaterialUsage,
} from "@/lib/productionFlowConfig";
import { printReport } from "@/lib/reportPrint";

type ProductionLog = {
  id: string;
  lotNumber: string;
  productionDate: string;
  productName: string;
  outputQuantity: number;
  shipmentQuantity: number;
  scheduledDate: string | null;
  destinationMine: string | null;
  status: string;
  workerInfo: string | null;
  density: number | null;
  note: string | null;
  createdBy: { fullName: string };
  material: { name: string; unit: string };
  telemetryLogs: EquipmentTelemetryLog[];
};

type Material = { id: string; name: string; unit: string; category?: string; currentStock?: number };
type ProductionPlan = {
  id: string;
  planDate: string;
  targetQuantity: number;
};
type ProductionLogsResponse = {
  data: ProductionLog[];
  plans: ProductionPlan[];
};
type EquipmentTelemetryLog = {
  id: string;
  productionLogId: string;
  rpm: number;
  maxRpm: number;
  loadPercent: number;
  temperature: number | null;
  pressure: number | null;
  vibration: number | null;
  status: string;
  note: string | null;
  recordedAt: string;
  createdAt: string;
  equipment: {
    id: string;
    name: string;
    type: string;
    maxRpm: number;
  };
};
type EquipmentOption = { id: string; name: string; type: string; maxRpm: number; department: string; isActive: boolean };
type EquipmentRpmFormRow = {
  rowId: string;
  equipmentId: string;
  equipmentName: string;
  rpm: string;
  maxRpm: string;
  temperature: string;
  pressure: string;
  vibration: string;
  note: string;
};
type RpmChartPoint = {
  id: string;
  time: string;
  label: string;
  productType: string;
  producedKg: number;
  equipmentId: string;
  equipmentName: string;
  rpm: number;
  maxRpm: number;
  loadPercent: number;
  temperature: number | null;
  pressure: number | null;
  vibration: number | null;
  status: string;
};
type EquipmentSummary = {
  equipmentId: string;
  equipmentName: string;
  equipmentType: string;
  maxRpm: number;
  latestRpm: number | null;
  latestLoadPercent: number | null;
  avgRpm: number | null;
  avgLoadPercent: number | null;
  temperature: number | null;
  pressure: number | null;
  vibration: number | null;
  status: string;
  lastRecordedAt: string | null;
  healthScore: number | null;
  trend: { time: string; rpm: number; loadPercent: number }[];
};
type RpmSummaryResponse = {
  data: {
    latestRpm: number | null;
    avgRpm: number | null;
    maxRpm: number | null;
    minRpm: number | null;
    avgLoadPercent: number | null;
    warningCount: number;
    criticalCount: number;
    chartData: RpmChartPoint[];
    equipmentSummaries: EquipmentSummary[];
  };
  filters: {
    from: string;
    to: string;
    products: string[];
    equipment: EquipmentOption[];
  };
};

const PRODUCTS = [
  "ANDO-V 90MM","ANDO-V 120MM","ANDO-V 60MM",
  "ANDO-EV 32MM","ANDO-EV 25MM","ANDO-SPLIT 38MM",
] as const;

const PRODUCT_COLORS: Record<string, string> = {
  "ANDO-V 90MM": "#10B981","ANDO-V 120MM": "#3B82F6","ANDO-V 60MM": "#F59E0B",
  "ANDO-EV 32MM": "#A78BFA","ANDO-EV 25MM": "#14B8A6","ANDO-SPLIT 38MM": "#F97316",
};

function rpmStatus(percent: number) {
  if (percent >= 95) return { label: "Critical", color: "#EF4444", bg: "rgba(239,68,68,.12)", border: "rgba(239,68,68,.34)" };
  if (percent >= 80) return { label: "Warning", color: "#F59E0B", bg: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.34)" };
  return { label: "Normal", color: "#10B981", bg: "rgba(16,185,129,.12)", border: "rgba(16,185,129,.34)" };
}

function rpmStatusFromLabel(status: string) {
  if (status === "CRITICAL") return { label: "Critical", color: "#EF4444", bg: "rgba(239,68,68,.12)", border: "rgba(239,68,68,.34)" };
  if (status === "WARNING") return { label: "Warning", color: "#F59E0B", bg: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.34)" };
  if (status === "NO_DATA") return { label: "No data", color: "#64748B", bg: "rgba(100,116,139,.12)", border: "rgba(100,116,139,.28)" };
  return { label: "Normal", color: "#10B981", bg: "rgba(16,185,129,.12)", border: "rgba(16,185,129,.34)" };
}

function toDateTimeInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function localDateTimeToIso(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function getTelemetryStatus(loadPercent: number) {
  if (loadPercent >= 95) return "CRITICAL";
  if (loadPercent >= 80) return "WARNING";
  return "NORMAL";
}

function makeEquipmentRowId() {
  return globalThis.crypto?.randomUUID?.() ?? `rpm-${Date.now()}`;
}

function createBlankEquipmentRow(): EquipmentRpmFormRow {
  return {
    rowId: makeEquipmentRowId(),
    equipmentId: "",
    equipmentName: "",
    rpm: "",
    maxRpm: "",
    temperature: "",
    pressure: "",
    vibration: "",
    note: "",
  };
}

function createEquipmentRowFromOption(option: EquipmentOption): EquipmentRpmFormRow {
  const defaultRpm = getDefaultEquipmentRpm(option.name);
  return {
    ...createBlankEquipmentRow(),
    equipmentId: option.id,
    equipmentName: option.name,
    rpm: defaultRpm === null ? "" : String(defaultRpm),
    maxRpm: String(option.maxRpm),
  };
}

function getSuggestedEquipmentRows(product: string, equipment: EquipmentOption[]) {
  const names = getSuggestedEquipmentNames(product);
  const rows = names
    .map((name) => equipment.find((item) => item.name === name))
    .filter((item): item is EquipmentOption => Boolean(item))
    .map(createEquipmentRowFromOption);
  return rows.length ? rows : [createBlankEquipmentRow()];
}
const MINE_OPTIONS = ["Оюутолгой","Эрдэнэт","Тавантолгой","Нарийнсухайт","Цагаан суварга"];
const PAGE_SIZE = 20;
const REPORT_DAYS = 14;

const fetcher = (url: string) => fetch(url).then(r => r.json());

function toDateInputValue(date = new Date()) { return date.toISOString().split("T")[0]; }
function toKg(amount: string, unit: "kg" | "ton") {
  const n = Number(amount);
  return (!n || n <= 0) ? 0 : unit === "ton" ? n * 1000 : n;
}
function fmtKg(v: number) { return `${v.toLocaleString("mn-MN")} кг`; }
function getAverage(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Always show tons when >= 1000 kg for unit consistency
function fmtDisplay(v: number) {
  if (v >= 1000) {
    const t = v / 1000;
    return `${t % 1 === 0 ? t.toLocaleString("mn-MN") : t.toFixed(1)} тн`;
  }
  return `${v.toLocaleString("mn-MN")} кг`;
}

function formatDateTime(value: Date | null) {
  if (!value) return "--:--:--";
  return value.toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatShortDate(value: Date) {
  return value.toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function fmtDensity(v: number | null) {
  return typeof v === "number" && Number.isFinite(v) ? `${v.toLocaleString("mn-MN")} г/см³` : "Бүртгээгүй";
}

function getShipmentQuantity(log: ProductionLog) {
  return log.shipmentQuantity > 0 ? log.shipmentQuantity : log.outputQuantity;
}

function splitWorkerInfo(value: string | null) {
  return (value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function makeLotNumber() {
  const d = new Date();
  return `LOT-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${Math.floor(Math.random()*900+100)}`;
}

// Row urgency based on scheduled shipment date
function rowUrgency(l: ProductionLog): "crit" | "warn" | "ok" {
  if (!l.scheduledDate) return "ok";
  const days = Math.floor((new Date(l.scheduledDate).getTime() - Date.now()) / 86400000);
  if (days <= 0) return "crit";
  if (days <= 3) return "warn";
  return "ok";
}

function buildDailySeries(logs: ProductionLog[], plans: ProductionPlan[], anchor = new Date()) {
  const now = new Date(anchor);
  const pts = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - 6 + i);
    return { key: d.toISOString().slice(0,10), date:`${d.getMonth()+1}/${d.getDate()}`, produced:0, shipment:0, target:null as number | null };
  });
  const map = new Map(pts.map(p=>[p.key,p]));
  for (const l of logs) {
    const b = map.get(l.productionDate.slice(0,10));
    if (b) b.produced += l.outputQuantity;
    if (l.scheduledDate) { const s = map.get(l.scheduledDate.slice(0,10)); if (s) s.shipment += getShipmentQuantity(l); }
  }
  for (const plan of plans) {
    const b = map.get(plan.planDate.slice(0,10));
    if (b) b.target = plan.targetQuantity;
  }
  return pts;
}

function buildProductionReportDailyRows(logs: ProductionLog[], plans: ProductionPlan[], now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (REPORT_DAYS - 1));
  const rows = Array.from({ length: REPORT_DAYS }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: formatDateKey(date),
      label: formatShortDate(date),
      produced: 0,
      shipment: 0,
      target: 0,
      count: 0,
    };
  });
  const map = new Map(rows.map((row) => [row.key, row]));

  for (const log of logs) {
    const productionRow = map.get(log.productionDate.slice(0, 10));
    if (productionRow) {
      productionRow.produced += log.outputQuantity;
      productionRow.count += 1;
    }
    if (log.scheduledDate) {
      const shipmentRow = map.get(log.scheduledDate.slice(0, 10));
      if (shipmentRow) shipmentRow.shipment += getShipmentQuantity(log);
    }
  }

  for (const plan of plans) {
    const row = map.get(plan.planDate.slice(0, 10));
    if (row) row.target += plan.targetQuantity;
  }

  return rows;
}

type ChartPayload = {
  dataKey?: string;
  color?: string;
  name?: string;
  value?: number | string;
};

function ProdTooltip({ active, payload, label }: { active?: boolean; payload?: ChartPayload[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"var(--panel,#fff)", border:"1px solid var(--border,#e2e8f0)", borderRadius:10, padding:"10px 14px", fontSize:12, boxShadow:"0 4px 16px rgba(0,0,0,0.08)" }}>
      <div style={{ fontWeight:700, marginBottom:6, color:"var(--text)" }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color:p.color, marginBottom:2 }}>
          {p.name}: <strong>{fmtDisplay(Number(p.value))}</strong>
        </div>
      ))}
    </div>
  );
}

function SemiCircleRpmGauge({ percent, rpm, max, color, animate }: { percent: number; rpm: number | null; max: number; color: string; animate: boolean }) {
  const gaugeValue = animate ? Math.min(100, Math.max(0, percent)) : 0;

  return (
    <div className="scada-gauge" aria-label={`${rpm ?? 0} rpm, ${percent}% load`}>
      <svg viewBox="0 0 120 74" role="img">
        <path className="scada-gauge__track" pathLength={100} d="M12 62 A48 48 0 0 1 108 62" />
        <path
          className="scada-gauge__value"
          pathLength={100}
          d="M12 62 A48 48 0 0 1 108 62"
          stroke={color}
          style={{ strokeDashoffset: 100 - gaugeValue }}
        />
        <text x="60" y="45" textAnchor="middle" className="scada-gauge__rpm">{rpm === null ? "--" : rpm.toLocaleString("mn-MN")}</text>
        <text x="60" y="59" textAnchor="middle" className="scada-gauge__meta">/{max.toLocaleString("mn-MN")} rpm</text>
      </svg>
      <div className="scada-gauge__load" style={{ color }}>{percent}% LOAD</div>
    </div>
  );
}

function WaveformTrace({ values, color, delay = 0 }: { values: readonly number[]; color: string; delay?: number }) {
  const pointCount = Math.max(values.length, 8);
  const points = Array.from({ length: pointCount }, (_, index) => {
    const x = (index / Math.max(pointCount - 1, 1)) * 120;
    return `${x.toFixed(1)},17`;
  })
    .join(" ");

  return (
    <svg className="scada-waveform" viewBox="0 0 120 34" preserveAspectRatio="none" aria-label="Saved RPM load trace">
      <polyline className="scada-waveform__base" points={points} />
      <polyline className="scada-waveform__line" points={points} stroke={color} style={{ animationDelay: `${delay}s` }} />
    </svg>
  );
}

function EquipmentMachineCard({ summary, animate, index }: { summary: EquipmentSummary; animate: boolean; index: number }) {
  const load = Math.round(summary.latestLoadPercent ?? 0);
  const loadStatus = rpmStatus(load);
  const status = rpmStatusFromLabel(summary.status);
  const maintenanceLabel = summary.status === "WARNING" || summary.status === "CRITICAL" ? "CHECK" : "MNT OK";
  const trendValues = summary.trend.length ? summary.trend.map((point) => point.loadPercent) : [0, 0, 0, 0];
  const isConnected = summary.status !== "NO_DATA";

  return (
    <div className="scada-machine-card" style={{ borderColor: status.border }}>
      <div className="scada-machine-card__head">
        <div className="scada-machine-card__identity">
          <span className={`scada-status-light ${isConnected ? "is-online" : "is-offline"}`} />
          <div>
            <div className="scada-machine-card__name">{summary.equipmentName}</div>
            <div className="scada-machine-card__role">
              {summary.equipmentType} · {summary.lastRecordedAt ? new Date(summary.lastRecordedAt).toLocaleString("mn-MN") : "RPM бүртгэлгүй"}
            </div>
          </div>
        </div>
        <div className="scada-machine-card__badges">
          <span className={`scada-link-badge ${isConnected ? "is-connected" : "is-disconnected"}`}>
            {isConnected ? "RECORDED" : "NO DATA"}
          </span>
          <span className="scada-status-badge" style={{ color: status.color, borderColor: status.border, background: status.bg }}>
            {status.label}
          </span>
          <span className={`scada-maint-badge ${maintenanceLabel === "CHECK" ? "is-warning" : ""}`}>
            {maintenanceLabel}
          </span>
        </div>
      </div>

      <div className="scada-machine-card__body">
        <SemiCircleRpmGauge percent={load} rpm={summary.latestRpm} max={summary.maxRpm} color={loadStatus.color} animate={animate} />
        <div className="scada-metrics-grid">
          <div><span>Avg RPM</span><strong>{summary.avgRpm === null ? "-" : Math.round(summary.avgRpm).toLocaleString("mn-MN")}</strong></div>
          <div><span>Temp</span><strong>{summary.temperature === null ? "-" : `${summary.temperature}°C`}</strong></div>
          <div><span>Press</span><strong>{summary.pressure === null ? "-" : `${summary.pressure.toFixed(1)} bar`}</strong></div>
          <div><span>Vib</span><strong>{summary.vibration === null ? "-" : `${summary.vibration.toFixed(1)} mm/s`}</strong></div>
        </div>
      </div>

      <div className="scada-health-row">
        <span>Health score</span>
        <strong style={{ color: status.color }}>{summary.healthScore === null ? "-" : `${summary.healthScore}%`}</strong>
      </div>
      <div className="scada-health-meter">
        <div style={{ width: `${summary.healthScore ?? 0}%`, background: status.color }} />
      </div>

      <div className="scada-wave-row">
        <span className="scada-wave-label">RPM load trend</span>
        <span className="scada-pulse" style={{ borderColor: loadStatus.color }} />
        <WaveformTrace values={trendValues} color={loadStatus.color} delay={0} />
      </div>
    </div>
  );
}

function RpmMonitoringCard({
  summary,
  equipment,
}: {
  summary?: RpmSummaryResponse;
  equipment: EquipmentOption[];
}) {
  const [animateGauges, setAnimateGauges] = useState(false);
  const savedSummaries = summary?.data.equipmentSummaries ?? [];
  const savedByEquipmentId = new Map(savedSummaries.map((item) => [item.equipmentId, item]));
  const equipmentSource = equipment.length ? equipment : summary?.filters.equipment ?? [];
  const equipmentSourceIds = new Set(equipmentSource.map((item) => item.id));
  const equipmentSummaries = [
    ...equipmentSource.map((item) => savedByEquipmentId.get(item.id) ?? emptyEquipmentSummary(item)),
    ...savedSummaries.filter((item) => !equipmentSourceIds.has(item.equipmentId)),
  ];

  useEffect(() => {
    const timer = window.setTimeout(() => setAnimateGauges(true), 80);
    return () => window.clearTimeout(timer);
  }, [equipmentSummaries.length]);

  return (
    <div className="panel scada-monitor-panel">
      <div className="scada-monitor-panel__header">
        <div>
          <div className="panel-title">Тоног төхөөрөмжийн эргэлт / RPM</div>
        </div>
        <div className="scada-live-badge">
          <span className="scada-status-light is-online" />
          SAVED DATA
        </div>
      </div>

      <div className="scada-machine-list">
        {equipmentSummaries.length === 0 ? (
          <div style={{padding:"18px",border:"1px dashed rgba(34,211,238,0.22)",borderRadius:12,color:"var(--muted)",fontSize:12,textAlign:"center"}}>
            RPM бүртгэл хадгалагдаагүй байна
          </div>
        ) : equipmentSummaries.map((item, index) => (
          <EquipmentMachineCard key={item.equipmentId} summary={item} animate={animateGauges} index={index} />
        ))}
      </div>
    </div>
  );
}

function emptyEquipmentSummary(item: EquipmentOption): EquipmentSummary {
  return {
    equipmentId: item.id,
    equipmentName: item.name,
    equipmentType: item.type,
    maxRpm: item.maxRpm,
    latestRpm: null,
    latestLoadPercent: null,
    avgRpm: null,
    avgLoadPercent: null,
    temperature: null,
    pressure: null,
    vibration: null,
    status: "NO_DATA",
    lastRecordedAt: null,
    healthScore: null,
    trend: [],
  };
}

function calculateHealthScore(loadPercent: number, vibration: number | null) {
  return Math.max(0, Math.round(100 - Math.max(0, loadPercent - 75) * 1.2 - Math.max(0, (vibration ?? 0) - 3) * 4));
}

function mergeSavedTelemetryIntoSummary(
  current: RpmSummaryResponse | undefined,
  savedLog: ProductionLog,
  equipmentOptions: EquipmentOption[],
): RpmSummaryResponse {
  const savedTelemetry = savedLog.telemetryLogs ?? [];
  if (!savedTelemetry.length) {
    return current ?? {
      data: {
        latestRpm: null,
        avgRpm: null,
        maxRpm: null,
        minRpm: null,
        avgLoadPercent: null,
        warningCount: 0,
        criticalCount: 0,
        chartData: [],
        equipmentSummaries: [],
      },
      filters: {
        from: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
        to: new Date().toISOString(),
        products: [],
        equipment: equipmentOptions,
      },
    };
  }

  const savedPoints: RpmChartPoint[] = savedTelemetry.map((telemetry) => ({
    id: telemetry.id,
    time: telemetry.recordedAt,
    label: new Date(telemetry.recordedAt).toLocaleString("mn-MN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
    productType: savedLog.productName,
    producedKg: savedLog.outputQuantity,
    equipmentId: telemetry.equipment.id,
    equipmentName: telemetry.equipment.name,
    rpm: telemetry.rpm,
    maxRpm: telemetry.maxRpm,
    loadPercent: telemetry.loadPercent,
    temperature: telemetry.temperature,
    pressure: telemetry.pressure,
    vibration: telemetry.vibration,
    status: telemetry.status,
  }));

  const existingPoints = current?.data.chartData ?? [];
  const savedIds = new Set(savedPoints.map((point) => point.id));
  const chartData = [...existingPoints.filter((point) => !savedIds.has(point.id)), ...savedPoints]
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    .slice(-1000);

  const equipmentById = new Map<string, EquipmentOption>();
  for (const item of current?.filters.equipment ?? []) equipmentById.set(item.id, item);
  for (const item of equipmentOptions) equipmentById.set(item.id, item);
  for (const telemetry of savedTelemetry) {
    equipmentById.set(telemetry.equipment.id, {
      id: telemetry.equipment.id,
      name: telemetry.equipment.name,
      type: telemetry.equipment.type,
      maxRpm: telemetry.equipment.maxRpm,
      department: "PRODUCTION",
      isActive: true,
    });
  }

  const equipmentSummaries: EquipmentSummary[] = [];
  const savedEquipmentIds = new Set(savedTelemetry.map((telemetry) => telemetry.equipment.id));
  for (const item of equipmentById.values()) {
    if (!savedEquipmentIds.has(item.id)) continue;
    const savedPoint = savedPoints.find((point) => point.equipmentId === item.id);
    const rows = chartData.filter((point) => point.equipmentId === item.id);
    const latest = savedPoint ?? rows.at(-1);
    if (!latest || !rows.length) continue;
    const rpmValues = rows.map((row) => row.rpm);
    const loadValues = rows.map((row) => row.loadPercent);
    equipmentSummaries.push({
      equipmentId: item.id,
      equipmentName: item.name,
      equipmentType: item.type,
      maxRpm: item.maxRpm,
      latestRpm: latest.rpm,
      latestLoadPercent: latest.loadPercent,
      avgRpm: Math.round(getAverage(rpmValues) * 10) / 10,
      avgLoadPercent: Math.round(getAverage(loadValues) * 10) / 10,
      temperature: latest.temperature,
      pressure: latest.pressure,
      vibration: latest.vibration,
      status: latest.status,
      lastRecordedAt: latest.time,
      healthScore: calculateHealthScore(latest.loadPercent, latest.vibration),
      trend: rows.slice(-12).map((row) => ({
        time: row.time,
        rpm: row.rpm,
        loadPercent: row.loadPercent,
      })),
    });
  }

  const rpmValues = chartData.map((point) => point.rpm);
  const loadValues = chartData.map((point) => point.loadPercent);
  const latest = chartData.at(-1) ?? null;

  return {
    data: {
      latestRpm: latest?.rpm ?? null,
      avgRpm: rpmValues.length ? Math.round(getAverage(rpmValues) * 10) / 10 : null,
      maxRpm: rpmValues.length ? Math.max(...rpmValues) : null,
      minRpm: rpmValues.length ? Math.min(...rpmValues) : null,
      avgLoadPercent: loadValues.length ? Math.round(getAverage(loadValues) * 10) / 10 : null,
      warningCount: chartData.filter((point) => point.status === "WARNING").length,
      criticalCount: chartData.filter((point) => point.status === "CRITICAL").length,
      chartData,
      equipmentSummaries,
    },
    filters: {
      from: current?.filters.from ?? new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
      to: new Date().toISOString(),
      products: Array.from(new Set([...(current?.filters.products ?? []), savedLog.productName])).filter(Boolean).sort(),
      equipment: Array.from(equipmentById.values()),
    },
  };
}

function hasRpmSummary(summary: RpmSummaryResponse | undefined) {
  return Boolean(summary?.data.equipmentSummaries?.some((item) => item.latestRpm !== null));
}
function ProductionSkeleton() {
  return (
    <div className="department-production">
      <DeptTopbar icon="⚙️" title="Үйлдвэрлэл" />
      <div className="content">
        <div className="kpi-grid" style={{marginBottom:14}}>
          {Array.from({length:4}).map((_,i) => (
            <div key={i} className="kpi-card">
              <div className="ske" style={{height:14,width:"55%",marginBottom:12}}/>
              <div className="ske" style={{height:30,width:"45%",marginBottom:10}}/>
              <div className="ske" style={{height:11,width:"75%",marginBottom:14}}/>
              <div className="ske" style={{height:44}}/>
            </div>
          ))}
        </div>
        <div className="wh-main-grid" style={{marginBottom:14}}>
          <div className="panel"><div className="ske" style={{height:300,margin:20,borderRadius:8}}/></div>
          <div className="panel"><div className="ske" style={{height:300,margin:20,borderRadius:8}}/></div>
        </div>
        <div className="wh-chart-row" style={{marginBottom:14}}>
          {Array.from({length:3}).map((_,i) => (
            <div key={i} className="panel"><div className="ske" style={{height:180,margin:20,borderRadius:8}}/></div>
          ))}
        </div>
        <div className="panel">
          <div style={{padding:"16px 20px"}}>
            {Array.from({length:6}).map((_,i) => (
              <div key={i} className="ske" style={{height:14,marginBottom:14,width:`${82+i*3}%`}}/>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductionPage() {
  const { user } = useAuth();
  const [modal, setModal] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [reportClock, setReportClock] = useState<Date | null>(null);
  const [shipmentModal, setShipmentModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ProductionLog | null>(null);
  const [shipmentLog, setShipmentLog] = useState<ProductionLog | null>(null);
  const [shipmentProductName, setShipmentProductName] = useState("");
  const [shipmentAmount, setShipmentAmount] = useState("");
  const [shipmentAmountUnit, setShipmentAmountUnit] = useState<"kg" | "ton">("ton");
  const [shipmentDate, setShipmentDate] = useState("");
  const [shipmentDestinationMine, setShipmentDestinationMine] = useState("");
  const [shipmentError, setShipmentError] = useState("");
  const [savingShipmentDate, setSavingShipmentDate] = useState(false);
  const [deletingLog, setDeletingLog] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [tableSearch, setTableSearch] = useState("");
  const [tablePage, setTablePage] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [productName, setProductName] = useState<(typeof PRODUCTS)[number]>("ANDO-V 90MM");
  const [productionDate, setProductionDate] = useState(toDateTimeInputValue());
  const [amount, setAmount] = useState("");
  const [amountUnit, setAmountUnit] = useState<"kg"|"ton">("kg");
  const [manualMaterialUsage, setManualMaterialUsage] = useState<Record<string, string>>(() =>
    Object.fromEntries(MANUAL_EXPLOSIVE_INPUTS.map((materialName) => [materialName, ""]))
  );
  const [destinationMine, setDestinationMine] = useState(MINE_OPTIONS[0]);
  const [workerInfo, setWorkerInfo] = useState("");
  const [density, setDensity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [equipmentRows, setEquipmentRows] = useState<EquipmentRpmFormRow[]>(() => [createBlankEquipmentRow()]);
  const [toastMessage, setToastMessage] = useState("");
  const [recentSavedLog, setRecentSavedLog] = useState<ProductionLog | null>(null);

  const { data: logsData, isLoading: logsLoading, mutate: mutateLogs } = useSWR<ProductionLogsResponse>(
    "/api/production-logs?limit=180",
    fetcher,
    { refreshInterval: REALTIME_REFRESH_MS, revalidateOnFocus: false, onSuccess: () => setLastUpdated(new Date()) }
  );
  const { data: materialsData, isLoading: materialsLoading, mutate: mutateMaterials } = useSWR(
    "/api/materials",
    fetcher,
    { refreshInterval: REALTIME_REFRESH_MS, revalidateOnFocus: false }
  );
  const { data: equipmentData, mutate: mutateEquipment } = useSWR<{ data: EquipmentOption[] }>(
    "/api/equipment",
    fetcher,
    { refreshInterval: REALTIME_REFRESH_MS, revalidateOnFocus: false }
  );
  const { data: rpmSummaryData, mutate: mutateRpmSummary } = useSWR<RpmSummaryResponse>(
    "/api/equipment/rpm-summary",
    fetcher,
    { refreshInterval: REALTIME_REFRESH_MS, revalidateOnFocus: false }
  );

  const logs: ProductionLog[] = useMemo(() => logsData?.data ?? [], [logsData]);
  const productionPlans: ProductionPlan[] = useMemo(() => logsData?.plans ?? [], [logsData]);
  const materials: Material[] = useMemo(() => materialsData?.data ?? [], [materialsData]);
  const recipePreview = useMemo(() => {
    const outputKg = toKg(amount, amountUnit) || 0;
    return getProductRecipe(productName).map((item) => {
      const material = materials.find((entry) => entry.name === item.materialName);
      const required = outputKg > 0 ? Math.round(outputKg * item.quantityPerKg * 1000) / 1000 : 0;
      return {
        ...item,
        required,
        stock: material?.currentStock ?? 0,
        unit: material?.unit ?? "кг",
      };
    });
  }, [amount, amountUnit, materials, productName]);
  const manualUsagePreview = useMemo(() => MANUAL_EXPLOSIVE_INPUTS.map((materialName) => {
    const material = materials.find((entry) => entry.name === materialName);
    const required = Number(manualMaterialUsage[materialName] ?? "");
    return {
      materialName,
      required: Number.isFinite(required) && required > 0 ? required : 0,
      stock: material?.currentStock ?? 0,
      unit: material?.unit ?? "кг",
    };
  }), [manualMaterialUsage, materials]);
  const equipmentOptions: EquipmentOption[] = useMemo(() => equipmentData?.data ?? [], [equipmentData]);
  const latestLogWithTelemetry = useMemo(
    () => [...logs]
      .filter((log) => (log.telemetryLogs ?? []).length > 0)
      .sort((a, b) => new Date(b.productionDate).getTime() - new Date(a.productionDate).getTime())[0],
    [logs]
  );
  const latestLogRpmSummary = useMemo(
    () => latestLogWithTelemetry ? mergeSavedTelemetryIntoSummary(undefined, latestLogWithTelemetry, equipmentOptions) : undefined,
    [equipmentOptions, latestLogWithTelemetry]
  );
  const recentSavedRpmSummary = useMemo(
    () => recentSavedLog ? mergeSavedTelemetryIntoSummary(undefined, recentSavedLog, equipmentOptions) : undefined,
    [equipmentOptions, recentSavedLog]
  );
  const visibleRpmSummary = useMemo(
    () => recentSavedRpmSummary ?? (hasRpmSummary(rpmSummaryData) ? rpmSummaryData : latestLogRpmSummary ?? rpmSummaryData),
    [latestLogRpmSummary, recentSavedRpmSummary, rpmSummaryData]
  );
  const loading = logsLoading || materialsLoading;

  function closeShipmentModal() {
    setShipmentModal(false);
    setShipmentLog(null);
    setShipmentProductName("");
    setShipmentAmount("");
    setShipmentAmountUnit("ton");
    setShipmentDate("");
    setShipmentDestinationMine("");
    setShipmentError("");
  }

  useEffect(() => {
    if (!modal && !shipmentModal && !selectedLog && !reportModal) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (shipmentModal) {
        closeShipmentModal();
        return;
      }
      if (selectedLog) {
        setDeleteError("");
        setSelectedLog(null);
        return;
      }
      if (reportModal) {
        setReportModal(false);
        return;
      }
      setModal(false);
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [modal, reportModal, selectedLog, shipmentModal]);

  useEffect(() => {
    if (!reportModal) return;

    const refreshReport = () => {
      setReportClock(new Date());
      void mutateLogs();
      void mutateMaterials();
    };

    refreshReport();
    const intervalId = window.setInterval(refreshReport, REALTIME_REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [mutateLogs, mutateMaterials, reportModal]);

  useEffect(() => {
    if (!modal || !equipmentOptions.length) return;
    const hasConfiguredRow = equipmentRows.some((row) => row.equipmentId || row.equipmentName.trim());
    if (!hasConfiguredRow) {
      const timeout = window.setTimeout(() => {
        const suggestedRows = getSuggestedEquipmentRows(productName, equipmentOptions);
        if (suggestedRows.some((row) => row.equipmentId || row.equipmentName.trim())) {
          setEquipmentRows(suggestedRows);
        }
      }, 0);
      return () => window.clearTimeout(timeout);
    }
  }, [equipmentOptions, equipmentRows, modal, productName]);

  useEffect(() => {
    if (!toastMessage) return;
    const timeout = window.setTimeout(() => setToastMessage(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  function resetEquipmentRows(product: string, options = equipmentOptions) {
    setEquipmentRows(getSuggestedEquipmentRows(product, options));
  }

  function updateEquipmentRow(rowId: string, patch: Partial<EquipmentRpmFormRow>) {
    setEquipmentRows((rows) => rows.map((row) => row.rowId === rowId ? { ...row, ...patch } : row));
  }

  function selectEquipmentForRow(rowId: string, equipmentId: string) {
    const selectedEquipment = equipmentOptions.find((item) => item.id === equipmentId);
    const defaultRpm = selectedEquipment ? getDefaultEquipmentRpm(selectedEquipment.name) : null;
    updateEquipmentRow(rowId, selectedEquipment ? {
      equipmentId: selectedEquipment.id,
      equipmentName: selectedEquipment.name,
      rpm: defaultRpm === null ? "" : String(defaultRpm),
      maxRpm: String(selectedEquipment.maxRpm),
    } : {
      equipmentId: "",
      equipmentName: "",
      rpm: "",
      maxRpm: "",
    });
  }

  function addEquipmentRow() {
    setEquipmentRows((rows) => [...rows, createBlankEquipmentRow()]);
  }

  function removeEquipmentRow(rowId: string) {
    setEquipmentRows((rows) => rows.length > 1 ? rows.filter((row) => row.rowId !== rowId) : [createBlankEquipmentRow()]);
  }

  function updateManualMaterialUsage(materialName: string, value: string) {
    setManualMaterialUsage((current) => ({ ...current, [materialName]: value }));
  }

  function getEquipmentRowPreview(row: EquipmentRpmFormRow) {
    const rpm = Number(row.rpm);
    const maxRpm = Number(row.maxRpm);
    const loadPercent = rpm > 0 && maxRpm > 0 ? Math.round((rpm / maxRpm) * 1000) / 10 : 0;
    return { loadPercent, status: getTelemetryStatus(loadPercent) };
  }

  function openCreateModal(product: (typeof PRODUCTS)[number] = "ANDO-V 90MM") {
    setProductName(product);
    setProductionDate(toDateTimeInputValue());
    setAmount("");
    setAmountUnit("kg");
    setDestinationMine(MINE_OPTIONS[0]);
    setWorkerInfo("");
    setDensity("");
    setNote("");
    setManualMaterialUsage(Object.fromEntries(MANUAL_EXPLOSIVE_INPUTS.map((materialName) => [materialName, ""])));
    resetEquipmentRows(product);
    setError("");
    setModal(true);
  }

  function openReportModal() {
    setReportClock(new Date());
    setReportModal(true);
  }

  async function submitLog(e: { preventDefault(): void }) {
    e.preventDefault();
    const qty = toKg(amount, amountUnit);
    const densityValue = density.trim() ? Number(density) : null;
    if (!qty) { setError("Үйлдвэрлэсэн хэмжээг зөв оруулна уу"); return; }
    if (densityValue !== null && (!Number.isFinite(densityValue) || densityValue <= 0)) { setError("Нягтын утгыг зөв оруулна уу"); return; }
    const telemetry = equipmentRows.map((row) => ({
      equipmentId: row.equipmentId || undefined,
      equipmentName: row.equipmentName.trim(),
      rpm: Number(row.rpm),
      maxRpm: Number(row.maxRpm),
      temperature: row.temperature.trim() ? Number(row.temperature) : null,
      pressure: row.pressure.trim() ? Number(row.pressure) : null,
      vibration: row.vibration.trim() ? Number(row.vibration) : null,
      note: row.note.trim() || null,
    })).filter((row) => row.equipmentName || row.equipmentId || row.rpm || row.maxRpm);
    if (!telemetry.length) { setError("Тоног төхөөрөмжийн RPM бүртгэл нэмнэ үү"); return; }
    for (const row of telemetry) {
      if (!row.equipmentName && !row.equipmentId) { setError("Тоног төхөөрөмж сонгоно уу"); return; }
      if (!Number.isFinite(row.rpm) || row.rpm <= 0) { setError("RPM утгыг зөв оруулна уу"); return; }
      if (!Number.isFinite(row.maxRpm) || row.maxRpm <= 0) { setError("Max RPM утгыг зөв оруулна уу"); return; }
      if (row.rpm > row.maxRpm * 1.2) { setError("RPM утга max RPM-ээс хэт өндөр байна"); return; }
    }
    const materialUsage = requiresManualMaterialUsage(productName)
      ? manualUsagePreview.map((item) => ({ materialName: item.materialName, quantity: item.required }))
      : [];
    if (requiresManualMaterialUsage(productName)) {
      const invalidUsage = materialUsage.find((item) => !Number.isFinite(item.quantity) || item.quantity <= 0);
      if (invalidUsage) { setError(`${invalidUsage.materialName} зарцуулалтыг оруулна уу`); return; }
      const shortStock = manualUsagePreview.find((item) => item.required > item.stock);
      if (shortStock) {
        setError(`${shortStock.materialName} үлдэгдэл хүрэлцэхгүй. Байгаа: ${shortStock.stock.toLocaleString("mn-MN")} ${shortStock.unit}`);
        return;
      }
    }
    setSubmitting(true); setError("");
    const res = await fetch("/api/production/logs", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        lotNumber: makeLotNumber(),
        productionDateTime: localDateTimeToIso(productionDate),
        productType: productName,
        producedKg: qty,
        destinationMine,
        materialId: null,
        operator: workerInfo.trim() || null,
        density: densityValue,
        note: note || null,
        materialUsage,
        equipmentTelemetry: telemetry,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error??"Алдаа гарлаа"); setSubmitting(false); return; }
    const savedLog = data?.data as ProductionLog | undefined;
    if (savedLog?.telemetryLogs?.length) {
      setRecentSavedLog(savedLog);
      await mutateRpmSummary((current) => mergeSavedTelemetryIntoSummary(current, savedLog, equipmentOptions), { revalidate: false });
      setLastUpdated(new Date());
    }
    const firstTelemetry = savedLog?.telemetryLogs?.[0];
    setToastMessage(`${productName.replace("ANDO-", "")} үйлдвэрлэл бүртгэгдлээ — ${firstTelemetry?.equipment?.name ?? telemetry[0].equipmentName} ${firstTelemetry?.rpm ?? telemetry[0].rpm} rpm`);
    setModal(false); setSubmitting(false); setAmount(""); setWorkerInfo(""); setDensity(""); setNote("");
    setManualMaterialUsage(Object.fromEntries(MANUAL_EXPLOSIVE_INPUTS.map((materialName) => [materialName, ""])));
    resetEquipmentRows(productName);
    if (savedLog) {
      await mutateLogs((current) => ({
        ...(current ?? {}),
        data: [savedLog, ...((current?.data as ProductionLog[] | undefined) ?? []).filter((log) => log.id !== savedLog.id)],
        plans: current?.plans ?? productionPlans,
      }), { revalidate: false });
    }
    await Promise.all([mutateMaterials(), mutateEquipment(), mutateLogs()]);
  }
  async function deleteSelectedLog() {
    if (!selectedLog) return;
    const ok = window.confirm(`${selectedLog.productName} (${selectedLog.productionDate.slice(0,10)}) бүртгэлийг устгах уу?`);
    if (!ok) return;

    setDeletingLog(true);
    setDeleteError("");
    const res = await fetch(`/api/production-logs?id=${encodeURIComponent(selectedLog.id)}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setDeleteError(data?.error ?? "Устгахад алдаа гарлаа");
      setDeletingLog(false);
      return;
    }

    setDeletingLog(false);
    if (recentSavedLog?.id === selectedLog.id) setRecentSavedLog(null);
    setSelectedLog(null);
    await mutateLogs();
  }

  const canEdit = user?.role==="ADMIN" || (user?.role==="MODERATOR" && user.department==="PRODUCTION");
  const todayKey = toDateInputValue();

  function openLogDetails(log: ProductionLog | null) {
    if (!log) return;
    setDeleteError("");
    setSelectedLog(log);
  }

  function applyShipmentForm(log: ProductionLog | null) {
    setShipmentLog(log);
    setShipmentProductName(log?.productName ?? PRODUCTS[0]);
    if (log) {
      const quantity = getShipmentQuantity(log);
      if (quantity >= 1000) {
        const tons = quantity / 1000;
        setShipmentAmount(tons % 1 === 0 ? String(tons) : String(Number(tons.toFixed(1))));
        setShipmentAmountUnit("ton");
      } else {
        setShipmentAmount(String(quantity));
        setShipmentAmountUnit("kg");
      }
    } else {
      setShipmentAmount("");
      setShipmentAmountUnit("ton");
    }
    const scheduledKey = log?.scheduledDate?.slice(0,10);
    setShipmentDate(scheduledKey && scheduledKey >= todayKey ? scheduledKey : todayKey);
    setShipmentDestinationMine(log?.destinationMine ?? "");
    setShipmentError("");
  }

  function openShipmentDateModal(log: ProductionLog | null) {
    applyShipmentForm(log);
    setShipmentModal(true);
  }

  async function saveShipmentDate() {
    if (!canEdit) {
      setShipmentError("Ачилт хадгалах эрхгүй байна");
      return;
    }
    if (!shipmentDate) {
      setShipmentError("Ачилтын огноо сонгоно уу");
      return;
    }
    if (!shipmentProductName.trim()) {
      setShipmentError("Бүтээгдэхүүний нэр оруулна уу");
      return;
    }
    const shipmentQuantity = toKg(shipmentAmount, shipmentAmountUnit);
    if (!shipmentQuantity) {
      setShipmentError("Ачилтын хэмжээг зөв оруулна уу");
      return;
    }
    if (!shipmentDestinationMine.trim()) {
      setShipmentError("Очих газар оруулна уу");
      return;
    }

    setSavingShipmentDate(true);
    setShipmentError("");
    const res = await fetch("/api/production-logs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: shipmentLog?.id,
        productName: shipmentProductName.trim(),
        shipmentQuantity,
        scheduledDate: shipmentDate,
        destinationMine: shipmentDestinationMine.trim(),
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setShipmentError(data?.error ?? "Ачилтын огноо хадгалахад алдаа гарлаа");
      setSavingShipmentDate(false);
      return;
    }

    setSavingShipmentDate(false);
    closeShipmentModal();
    await mutateLogs();
  }

  const todayProduced = useMemo(
    () => logs.filter(l=>l.productionDate.slice(0,10)===todayKey).reduce((s,l)=>s+l.outputQuantity,0),
    [logs, todayKey]
  );
  const totalProduced = useMemo(() => logs.reduce((s,l)=>s+l.outputQuantity,0), [logs]);
  const scheduledShipments = useMemo(
    () => logs
      .filter(l=>l.scheduledDate)
      .sort((a,b)=>{
        const aDate = a.scheduledDate!.slice(0,10);
        const bDate = b.scheduledDate!.slice(0,10);
        const aFuture = aDate >= todayKey;
        const bFuture = bDate >= todayKey;
        if (aFuture && bFuture) return aDate.localeCompare(bDate);
        if (aFuture) return -1;
        if (bFuture) return 1;
        return bDate.localeCompare(aDate);
      }),
    [logs, todayKey]
  );
  const upcomingShipments = useMemo(
    () => scheduledShipments.filter(l=>l.scheduledDate!.slice(0,10) >= todayKey),
    [scheduledShipments, todayKey]
  );
  const pendingCount = upcomingShipments.length;
  const nextShipmentLog = upcomingShipments[0] ?? scheduledShipments[0] ?? null;
  const nextShipmentDate = nextShipmentLog?.scheduledDate?.slice(0,10) ?? "—";
  const nextShipmentDays = nextShipmentLog
    ? Math.round((new Date(nextShipmentDate).getTime() - new Date(todayKey).getTime()) / 86400000)
    : null;
  const nextShipmentTimeText = nextShipmentDays === null
    ? ""
    : nextShipmentDays === 0
      ? "өнөөдөр"
      : nextShipmentDays > 0
        ? `${nextShipmentDays} хоногийн дараа`
        : `${Math.abs(nextShipmentDays)} хоногийн өмнө`;
  const nextShipmentSummary = nextShipmentLog
    ? `${nextShipmentLog.productName} · ${fmtDisplay(getShipmentQuantity(nextShipmentLog))}${nextShipmentLog.destinationMine ? ` · ${nextShipmentLog.destinationMine}` : ""}`
    : "Ачигдах бүртгэл алга";
  const shipmentEditableLog = nextShipmentLog
    ?? logs.find((log) => !log.scheduledDate || log.scheduledDate.slice(0,10) < todayKey)
    ?? logs[0]
    ?? null;
  const shipmentReadyTotal = useMemo(
    () => upcomingShipments.reduce((s,l)=>s+getShipmentQuantity(l),0),
    [upcomingShipments]
  );

  const chartAnchorDate = useMemo(
    () => nextShipmentLog?.scheduledDate ? new Date(nextShipmentLog.scheduledDate) : new Date(),
    [nextShipmentLog]
  );
  const dailySeries = useMemo(()=>buildDailySeries(logs, productionPlans, chartAnchorDate),[chartAnchorDate, logs, productionPlans]);
  const avgDaily = Math.max(Math.round(dailySeries.reduce((s,d)=>s+d.produced,0)/dailySeries.length), 200);

  const productDist = useMemo(()=>PRODUCTS.map(p=>({
    name: p, value: Math.max(logs.filter(l=>l.productName===p).reduce((s,l)=>s+l.outputQuantity,0), 0.01),
    color: PRODUCT_COLORS[p],
  })),[logs]);

  const prodSparkline = useMemo(() => dailySeries.map(d=>d.produced), [dailySeries]);
  const shipSparkline = useMemo(() => dailySeries.map(d=>d.shipment), [dailySeries]);

  const weeklyBars = useMemo(()=>PRODUCTS.map(p=>({
    name: p.replace("ANDO-","").replace(" ",""),
    value: Math.round(logs.filter(l=>l.productName===p && l.productionDate.slice(0,10)>=dailySeries[0].key).reduce((s,l)=>s+l.outputQuantity,0)),
    color: PRODUCT_COLORS[p],
  })),[logs, dailySeries]);

  const filteredLogs = useMemo(()=>logs.filter(l=>{
    const matchFilter = tableFilter==="all" || l.productName===tableFilter;
    const matchSearch = tableSearch==="" || l.productName.toLowerCase().includes(tableSearch.toLowerCase()) || l.lotNumber.toLowerCase().includes(tableSearch.toLowerCase());
    return matchFilter && matchSearch;
  }),[logs, tableFilter, tableSearch]);

  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
  const currentTablePage = Math.min(tablePage, Math.max(totalPages - 1, 0));
  const paginatedLogs = useMemo(
    () => filteredLogs.slice(currentTablePage * PAGE_SIZE, (currentTablePage + 1) * PAGE_SIZE),
    [filteredLogs, currentTablePage]
  );

  // Alert data with richer context
  const alerts = useMemo(()=>{
    const list: {type:string; name:string; days:number|null; msg:string; action:string; detail:string}[] = [];
    for (const p of PRODUCTS) {
      const latest = logs.filter(l=>l.productName===p)
        .sort((a,b)=>new Date(b.productionDate).getTime()-new Date(a.productionDate).getTime())[0];
      if (!latest) {
        list.push({type:"crit",name:p,days:null,msg:"Бүртгэл байхгүй",action:"Үйлдвэрлэл эхлүүлэх",detail:"Одоогоор үйлдвэрлэлийн бүртгэл алга — шуурхай эхлүүлэх шаардлагатай"});
        continue;
      }
      const days = Math.floor((new Date(todayKey).getTime()-new Date(latest.productionDate).getTime())/86400000);
      if (days>5) list.push({
        type: days>10?"crit":"low",
        name:p, days,
        msg:`${days} хоног үйлдвэрлэлгүй`,
        action:"Үйлдвэрлэл эхлүүлэх",
        detail: days>10 ? "Үйлдвэрлэл зогссон — яаралтай анхаарах шаардлагатай" : "Тасралт ажиглагдаж байна — анхааруулга",
      });
    }
    return list.slice(0,4);
  },[logs, todayKey]);

  // Most critical single alert for top bar
  const topAlert = useMemo(()=>{
    const sorted = [...alerts].sort((a,b)=>{
      if (a.type==="crit" && b.type!=="crit") return -1;
      if (a.type!=="crit" && b.type==="crit") return 1;
      return (b.days??9999)-(a.days??9999);
    });
    return sorted[0] ?? null;
  },[alerts]);

  const productionPriorityTone = topAlert?.type === "crit" || todayProduced < avgDaily * 0.5 ? "critical" : topAlert || pendingCount > 0 ? "warning" : "normal";
  const productionPrioritySummary = productionPriorityTone === "critical"
    ? "Үйлдвэрлэлийн төлөвлөгөө эсвэл бүтээгдэхүүний тасралт анхаарал шаардсан байна."
    : productionPriorityTone === "warning"
      ? "Үйлдвэрлэл ажиллаж байна, гэхдээ ачилт эсвэл бүтээгдэхүүний давтамжийг шалгах хэрэгтэй."
      : "Үйлдвэрлэлийн үндсэн урсгал хэвийн байна.";
  const productionAttention = topAlert ? topAlert.name : pendingCount > 0 ? "Хүлээгдэж буй ачилт" : "Анхаарах зүйлгүй";
  const productionAction = productionPriorityTone === "normal" ? "Өдрийн гарцыг үргэлжлүүлэн хянах" : topAlert ? "Бүртгэл нэмэх / төлөв засах" : "Ачилтын огноог баталгаажуулах";
  const productionRecommendations = (() => {
    const items = [];
    if (topAlert) {
      items.push({
        tone: topAlert.type === "crit" ? "critical" as const : "warning" as const,
        title: topAlert.name,
        body: topAlert.detail,
        actionLabel: topAlert.action,
        onAction: () => openCreateModal(topAlert.name as (typeof PRODUCTS)[number]),
      });
    }
    if (todayProduced < avgDaily * 0.5) {
      items.push({
        tone: "critical" as const,
        title: "Өнөөдрийн гарц бага байна",
        body: fmtDisplay(todayProduced) + " бүртгэгдсэн. Дундаж зорилттой харьцуулж үйлдвэрлэлийн бүртгэлээ нэмж шалгана уу.",
        actionLabel: "+ Бүртгэл нэмэх",
        onAction: () => openCreateModal(),
      });
    }
    if (pendingCount > 0) {
      items.push({
        tone: "warning" as const,
        title: "Ачилтын төлөв баталгаажуулах",
        body: pendingCount + " ачилт хүлээгдэж байна. Дараагийн ачилт: " + nextShipmentDate + (nextShipmentTimeText ? " · " + nextShipmentTimeText : "") + ".",
        actionLabel: "Ачилт засах",
        onAction: () => openShipmentDateModal(shipmentEditableLog),
      });
    }
    return items.slice(0, 3);
  })();

  const selectedWorkers = useMemo(() => splitWorkerInfo(selectedLog?.workerInfo ?? null), [selectedLog]);
  const selectedDayPoint = useMemo(
    () => selectedLog ? dailySeries.find(d=>d.key===selectedLog.productionDate.slice(0,10)) : undefined,
    [dailySeries, selectedLog]
  );
  const selectedDayTarget = typeof selectedDayPoint?.target === "number" ? selectedDayPoint.target : 0;
  const selectedDayProgressPct = selectedDayTarget > 0 ? Math.min(100, Math.round(((selectedDayPoint?.produced ?? 0) / selectedDayTarget) * 100)) : 0;

  const reportNow = useMemo(() => reportClock ?? lastUpdated ?? new Date(), [lastUpdated, reportClock]);
  const reportStart = useMemo(() => {
    const start = new Date(reportNow);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (REPORT_DAYS - 1));
    return start;
  }, [reportNow]);
  const reportNowTime = reportNow.getTime();
  const reportStartTime = reportStart.getTime();
  const reportLogs = useMemo(
    () => logs.filter((log) => {
      const time = new Date(log.productionDate).getTime();
      return time >= reportStartTime && time <= reportNowTime;
    }),
    [logs, reportNowTime, reportStartTime]
  );
  const reportShipments = useMemo(
    () => logs.filter((log) => {
      if (!log.scheduledDate) return false;
      const time = new Date(log.scheduledDate).getTime();
      return time >= reportStartTime && time <= reportNowTime;
    }),
    [logs, reportNowTime, reportStartTime]
  );
  const reportPlans = useMemo(
    () => productionPlans.filter((plan) => {
      const time = new Date(plan.planDate).getTime();
      return time >= reportStartTime && time <= reportNowTime;
    }),
    [productionPlans, reportNowTime, reportStartTime]
  );
  const reportDailyRows = useMemo(
    () => buildProductionReportDailyRows(logs, productionPlans, reportNow),
    [logs, productionPlans, reportNow]
  );
  const reportTotalProduced = reportLogs.reduce((sum, log) => sum + log.outputQuantity, 0);
  const reportTotalTarget = reportPlans.reduce((sum, plan) => sum + plan.targetQuantity, 0);
  const reportShipmentTotal = reportShipments.reduce((sum, log) => sum + getShipmentQuantity(log), 0);
  const reportEfficiencyPct = reportTotalTarget > 0 ? Math.round((reportTotalProduced / reportTotalTarget) * 100) : 0;
  const reportAverageDaily = Math.round(reportTotalProduced / REPORT_DAYS);
  const reportProductRows = useMemo(
    () => PRODUCTS.map((product) => {
      const productLogs = reportLogs.filter((log) => log.productName === product);
      const productShipments = reportShipments.filter((log) => log.productName === product);
      const densityValues = productLogs
        .map((log) => log.density)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      const produced = productLogs.reduce((sum, log) => sum + log.outputQuantity, 0);
      const shipped = productShipments.reduce((sum, log) => sum + getShipmentQuantity(log), 0);
      const averageDensity = densityValues.length
        ? densityValues.reduce((sum, value) => sum + value, 0) / densityValues.length
        : null;
      return {
        product,
        produced,
        shipped,
        count: productLogs.length,
        averageDensity,
        color: PRODUCT_COLORS[product],
      };
    }).sort((a, b) => b.produced - a.produced),
    [reportLogs, reportShipments]
  );
  const reportTopProduct = reportProductRows.find((row) => row.produced > 0) ?? null;
  const reportActiveProductCount = reportProductRows.filter((row) => row.produced > 0).length;
  const reportLatestLogs = useMemo(
    () => [...reportLogs]
      .sort((a, b) => new Date(b.productionDate).getTime() - new Date(a.productionDate).getTime())
      .slice(0, 20),
    [reportLogs]
  );
  const reportTelemetryRows = useMemo(
    () => reportLogs
      .flatMap((log) => (log.telemetryLogs ?? []).map((telemetry) => ({ log, telemetry })))
      .sort((a, b) => new Date(b.telemetry.recordedAt).getTime() - new Date(a.telemetry.recordedAt).getTime()),
    [reportLogs]
  );
  const reportTelemetryAvgLoad = reportTelemetryRows.length
    ? Math.round(reportTelemetryRows.reduce((sum, row) => sum + row.telemetry.loadPercent, 0) / reportTelemetryRows.length)
    : null;
  const reportTelemetryWarningCount = reportTelemetryRows.filter((row) => row.telemetry.status === "WARNING").length;
  const reportTelemetryCriticalCount = reportTelemetryRows.filter((row) => row.telemetry.status === "CRITICAL").length;
  const reportHealth = reportTotalTarget === 0
    ? { label: "Төлөвлөгөө бүртгэгдээгүй", color: "#64748B" }
    : reportEfficiencyPct >= 100
      ? { label: "Төлөвлөгөөнөөс давсан", color: "#10B981" }
      : reportEfficiencyPct >= 80
        ? { label: "Хэвийн явцтай", color: "#F59E0B" }
        : { label: "Анхаарах шаардлагатай", color: "#EF4444" };

  if (loading) return <ProductionSkeleton />;

  return (
    <div className="department-production">
      <DeptTopbar icon="⚙️" title="Үйлдвэрлэл" />
      <div className="content">

        {/* Breadcrumb */}
        <div style={{fontSize:12,color:"var(--muted)",marginBottom:18,display:"flex",alignItems:"center",gap:6}}>
          <span>🏠 Нүүр хуудас</span><span style={{opacity:.4}}>›</span>
          <span style={{color:"var(--text)",fontWeight:600}}>Үйлдвэрлэл</span>
          <span style={{flex:1}} />
          <RealtimeBadge lastUpdated={lastUpdated} />
        </div>
        <PriorityStatusBar
          tone={productionPriorityTone}
          title={productionPriorityTone === "normal" ? "Систем хэвийн" : "Үйлдвэрлэл анхаарал шаардсан"}
          summary={productionPrioritySummary}
          attention={productionAttention}
          action={productionAction}
          actionLabel={productionPriorityTone === "normal" ? "Шинэчлэх" : topAlert ? "+ Бүртгэл" : "Ачилт засах"}
          onAction={productionPriorityTone === "normal" ? () => { void mutateLogs(); void mutateMaterials(); } : topAlert ? () => openCreateModal(topAlert.name as (typeof PRODUCTS)[number]) : () => openShipmentDateModal(shipmentEditableLog)}
          metrics={[
            { label: "Өнөөдөр", value: fmtDisplay(todayProduced), tone: todayProduced < avgDaily * 0.5 ? "critical" : "normal" },
            { label: "Warning", value: alerts.filter((item) => item.type !== "crit").length, tone: alerts.some((item) => item.type !== "crit") ? "warning" : "normal" },
            { label: "Ачилт", value: pendingCount, tone: pendingCount > 0 ? "warning" : "normal" },
          ]}
        />

        {/* KPI Cards */}
        <div className="kpi-grid">
          <KpiCard label="Өнөөдөр үйлдвэрлэсэн" value={fmtKg(todayProduced)} valueClass="white"
            change={`${todayKey} өдрийн гарц`} icon={<span style={{fontSize:20}}>🏭</span>}
            sparkline={prodSparkline} sparklineColor="#10B981" />
          <KpiCard label="Нийт үйлдвэрлэсэн" value={fmtDisplay(totalProduced)}
            valueStyle={{color:"#10B981"}} change="Бүх бүртгэлийн нийлбэр"
            icon={<span style={{fontSize:20}}>📦</span>} sparkline={prodSparkline} sparklineColor="#10B981" />
          <KpiCard label="Дараагийн ачилт" value={nextShipmentDate}
            valueClass="white" change={nextShipmentSummary}
            icon={<span style={{fontSize:20}}>🚚</span>} sparkline={shipSparkline} sparklineColor="#3B82F6"
            onClick={()=>openShipmentDateModal(shipmentEditableLog)} />
          <KpiCard label="Хүлээгдэж буй" value={pendingCount}
            valueStyle={{color:"#F59E0B"}} change={`${fmtDisplay(shipmentReadyTotal)} ачигдахаар байна`}
            icon={<span style={{fontSize:20}}>⏳</span>}
            sparkline={Array.from({length:7},(_,i)=>Math.round(pendingCount*(0.5+i*0.1)))}
            sparklineColor="#F59E0B" />
        </div>

        {/* Main Charts Row */}
        <div className="wh-main-grid">
          <div className="panel">
            <div className="panel-hdr" style={{paddingBottom:12}}>
              <div>
                <div className="panel-title">Үйлдвэрлэлт ба ачилт (14 хоног)</div>
                <div className="panel-sub">Бодит гарц болон төлөвлөсөн ачилтын огнооны харьцуулалт</div>
              </div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                {[["#10B981","Үйлдвэрлэл"],["#3B82F6","Ачилт"]].map(([c,l])=>(
                  <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:c}}>
                    <span style={{width:16,height:2,background:c,display:"inline-block",borderRadius:2}}/>
                    {l}
                  </div>
                ))}
              </div>
            </div>
            <div style={{padding:"0 20px 4px",display:"flex",gap:24}}>
              <div>
                <div style={{fontSize:22,fontWeight:700,color:"#10B981"}}>{fmtDisplay(totalProduced)}</div>
                <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>НИЙТ ГАРЦ</div>
              </div>
              <div>
                <div style={{fontSize:22,fontWeight:700,color:"#3B82F6"}}>{fmtDisplay(shipmentReadyTotal)}</div>
                <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>АЧИЛТАД БЭЛЭН</div>
              </div>
            </div>
            <div className="chart-wrap" style={{height:240}}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailySeries} margin={{top:10,right:10,left:0,bottom:0}}>
                  <defs>
                    <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.18}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="shipGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.12}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false}/>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill:"var(--muted)",fontSize:11}}/>
                  <YAxis axisLine={false} tickLine={false} tick={{fill:"var(--muted)",fontSize:11}}/>
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                  <Tooltip content={<ProdTooltip/>}/>
                  <Area type="monotone" dataKey="produced" name="Үйлдвэрлэл" stroke="#10B981" strokeWidth={2.5} fill="url(#prodGrad)" dot={{r:3,fill:"#10B981"}} activeDot={{r:5}} isAnimationActive={false}/>
                  <Area type="monotone" dataKey="shipment" name="Ачилт" stroke="#3B82F6" strokeWidth={2} fill="url(#shipGrad)" dot={{r:3,fill:"#3B82F6"}} activeDot={{r:5}} isAnimationActive={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <ChartHint>Ногоон нь үйлдвэрлэсэн хэмжээ, цэнхэр нь ачилт. Ачилтын popup дээр оруулсан огноо энэ графикийн хугацаанд багтаж харагдана.</ChartHint>
          </div>

          <div className="panel">
            <div className="panel-hdr" style={{paddingBottom:16}}>
              <div className="panel-title">Бүтээгдэхүүний хуваарилалт</div>
              <div className="panel-sub">Нийт гарц бүтээгдэхүүн тус бүрээр</div>
            </div>
            <div style={{padding:"0 20px 20px"}}>
              {PRODUCTS.map(p=>{
                const tot = logs.filter(l=>l.productName===p).reduce((s,l)=>s+l.outputQuantity,0);
                const pct = totalProduced>0 ? Math.round((tot/totalProduced)*100) : 0;
                return (
                  <div key={p} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                      <span style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{width:8,height:8,borderRadius:"50%",background:PRODUCT_COLORS[p],display:"inline-block"}}/>
                        <span style={{color:"var(--text)",fontWeight:600}}>{p}</span>
                      </span>
                      <span style={{color:PRODUCT_COLORS[p],fontWeight:700}}>{pct}% · {fmtDisplay(tot)}</span>
                    </div>
                    <div style={{height:7,borderRadius:999,background:"var(--base3,#f1f5f9)",overflow:"hidden"}}>
                      <div style={{width:`${pct}%`,height:"100%",background:PRODUCT_COLORS[p],borderRadius:999,transition:"width .4s"}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3 Small Charts */}
        <div className="wh-chart-row">
          <div className="panel">
            <div className="panel-hdr" style={{paddingBottom:0}}>
              <div className="panel-title">Бүтээгдэхүүний тархалт</div>
            </div>
            <div className="panel-sub" style={{padding:"2px 20px 0"}}>Гарцын харьцаа</div>
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 20px 16px"}}>
              <div style={{width:110,height:110,flexShrink:0}}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={productDist} cx="50%" cy="50%" innerRadius={28} outerRadius={50} dataKey="value" stroke="none" isAnimationActive={false}>
                      {productDist.map((d,i)=><Cell key={i} fill={d.color}/>)}
                    </Pie>
                    <Tooltip formatter={(v: unknown)=>[fmtDisplay(Number(v))]} contentStyle={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:8,fontSize:11}}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
                {productDist.slice(0,4).map(d=>(
                  <div key={d.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,fontSize:10}}>
                    <span style={{display:"flex",alignItems:"center",gap:5}}>
                      <span style={{width:7,height:7,borderRadius:"50%",background:d.color,display:"inline-block",flexShrink:0}}/>
                      <span style={{color:"var(--text)"}}>{d.name.replace("ANDO-","")}</span>
                    </span>
                    <span style={{color:d.color,fontWeight:700}}>{fmtDisplay(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-hdr" style={{paddingBottom:4}}>
              <div className="panel-title">14 хоногийн гарц</div>
            </div>
            <div className="chart-wrap" style={{height:148,paddingTop:8}}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyBars} margin={{top:0,right:8,left:-20,bottom:0}} barSize={18}>
                  <CartesianGrid stroke="var(--border)" vertical={false}/>
                  <XAxis dataKey="name" tick={{fill:"var(--muted)",fontSize:9}} axisLine={false} tickLine={false}/>
                  <YAxis hide/>
                  <Tooltip contentStyle={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:8,fontSize:11}}/>
                  <Bar dataKey="value" name="Гарц" radius={[4,4,0,0]} isAnimationActive={false}>
                    <LabelList dataKey="value" position="top" fill="var(--text)" fontSize={9} />
                    {weeklyBars.map((d,i)=><Cell key={i} fill={d.color}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel">
            <div className="panel-hdr" style={{paddingBottom:4}}>
              <div className="panel-title">Өдрийн үйлдвэрлэлийн тренд</div>
            </div>
            <div className="chart-wrap" style={{height:148,paddingTop:8}}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailySeries} margin={{top:0,right:8,left:-20,bottom:0}}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false}/>
                  <XAxis dataKey="date" tick={{fill:"var(--muted)",fontSize:9}} axisLine={false} tickLine={false}/>
                  <YAxis hide/>
                  <Tooltip contentStyle={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:8,fontSize:11}}/>
                  <Area type="monotone" dataKey="produced" name="Гарц" stroke="#10B981" strokeWidth={2} fill="url(#trendGrad)" dot={{r:3,fill:"#10B981"}} isAnimationActive={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="production-equipment-row">
          <RpmMonitoringCard
            summary={visibleRpmSummary}
            equipment={equipmentOptions}
          />
        </div>

        {/* Bottom: Table + Right panel */}
        <div className="wh-bottom-grid">
          <div className="panel">
            {/* TOP ALERT BAR — most critical issue */}
            {topAlert && (
              <div style={{
                margin:"0 0 0 0",
                padding:"13px 20px",
                borderRadius:"12px 12px 0 0",
                background: topAlert.type==="crit" ? "rgba(239,68,68,0.07)" : "rgba(245,158,11,0.07)",
                borderBottom: `2px solid ${topAlert.type==="crit" ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"}`,
                display:"flex", alignItems:"center", gap:12,
              }}>
                <span style={{fontSize:18,flexShrink:0}}>{topAlert.type==="crit"?"🔴":"🟡"}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:800,fontSize:13,color:topAlert.type==="crit"?"#EF4444":"#F59E0B",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                    {topAlert.name} — {topAlert.days===null?"бүртгэл байхгүй":`${topAlert.days} хоног үйлдвэрлэлгүй`}
                  </div>
                  <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{topAlert.detail}</div>
                </div>
              </div>
            )}

            <div className="panel-hdr">
              <div>
                <div className="panel-title">Бүртгэл</div>
                <div className="panel-sub" style={{fontFamily:"var(--font-mono),monospace"}}>
                  {lastUpdated ? lastUpdated.toLocaleTimeString("mn-MN",{hour:"2-digit",minute:"2-digit",second:"2-digit"}) : "--:--:--"}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <button type="button" onClick={()=>{setTableFilter("all");setTablePage(0);}} style={{padding:"5px 12px",borderRadius:999,border:`1px solid ${tableFilter==="all"?"#10B981":"var(--border)"}`,background:tableFilter==="all"?"rgba(16,185,129,.1)":"transparent",color:tableFilter==="all"?"#10B981":"var(--muted)",fontSize:11,fontWeight:700,cursor:"pointer",transition:"all .15s"}}>Бүгд</button>
                {PRODUCTS.slice(0,3).map(p=>(
                  <button key={p} type="button" onClick={()=>{setTableFilter(p);setTablePage(0);}} style={{padding:"5px 10px",borderRadius:999,border:`1px solid ${tableFilter===p?PRODUCT_COLORS[p]:"var(--border)"}`,background:tableFilter===p?`${PRODUCT_COLORS[p]}18`:"transparent",color:tableFilter===p?PRODUCT_COLORS[p]:"var(--muted)",fontSize:10,fontWeight:700,cursor:"pointer",transition:"all .15s"}}>
                    {p.replace("ANDO-","")}
                  </button>
                ))}
                <input type="text" placeholder="Хайх..." value={tableSearch} onChange={e=>{setTableSearch(e.target.value);setTablePage(0);}} style={{padding:"5px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--base3)",color:"var(--text)",fontSize:11,outline:"none",width:120}}/>
                {canEdit && (
                  <button className="add-btn" type="button" onClick={()=>openCreateModal()}>
                    + Бүртгэл нэмэх
                  </button>
                )}
              </div>
            </div>
            <div className="production-log-table-wrap" style={{borderTop:"1px solid var(--border)"}}>
              <table className="safety-table wh-table production-log-table">
                <thead>
                  <tr>
                    <th style={{width:8,padding:0}}/>
                    <th style={{width:32}}>№</th>
                    <th>Бүтээгдэхүүн</th>
                    <th>Огноо</th>
                    <th>Хэмжээ (тн)</th>
                    <th>Ачигдах өдөр</th>
                    <th>Уурхай</th>
                    <th>Бүртгэсэн</th>
                    <th/>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.length===0 ? (
                                        <tr className="empty-row">
                      <td colSpan={9} style={{ padding: 18 }}>
                        <DashboardEmptyState
                          icon="🏭"
                          title="Үйлдвэрлэлийн бүртгэл байхгүй"
                          message="Одоогоор үйлдвэрлэлийн бүртгэл алга. Шинэ бүртгэл нэмснээр гарц, ачилтын график ажиллана."
                          actionLabel={canEdit ? "+ Бүртгэл нэмэх" : undefined}
                          onAction={canEdit ? () => openCreateModal() : undefined}
                          tone="normal"
                        />
                      </td>
                    </tr>
                  ) : paginatedLogs.map((l,i)=>{
                    const urgency = rowUrgency(l);
                    const urgencyColor = urgency==="crit" ? "#EF4444" : urgency==="warn" ? "#F59E0B" : "#10B981";
                    const urgencyBg = urgency==="crit" ? "rgba(239,68,68,0.04)" : urgency==="warn" ? "rgba(245,158,11,0.04)" : "transparent";
                    return (
                      <tr key={l.id} className="wh-tr-hover" style={{background:urgencyBg}}>
                        {/* Priority indicator stripe */}
                        <td style={{padding:0,width:4}}>
                          <div style={{width:4,height:"100%",minHeight:40,background:urgencyColor,borderRadius:2,opacity:urgency==="ok"?0.2:0.85}}/>
                        </td>
                        <td style={{color:"var(--muted)",fontSize:11}}>{currentTablePage*PAGE_SIZE+i+1}</td>
                        <td>
                          <span style={{display:"flex",alignItems:"center",gap:7}}>
                            <span style={{width:8,height:8,borderRadius:"50%",background:PRODUCT_COLORS[l.productName]??"#10B981",display:"inline-block",flexShrink:0}}/>
                            <strong style={{color:"var(--text)",fontSize:13}}>{l.productName}</strong>
                          </span>
                        </td>
                        <td style={{color:"var(--muted)",fontSize:12}}>{l.productionDate.slice(0,10)}</td>
                        <td style={{fontFamily:"var(--font-mono),monospace",fontWeight:700,color:PRODUCT_COLORS[l.productName]??undefined}}>{fmtDisplay(l.outputQuantity)}</td>
                        <td>
                          {l.scheduledDate ? (
                            <span style={{
                              color: urgency==="crit"?"#EF4444":urgency==="warn"?"#F59E0B":"var(--text)",
                              fontWeight: urgency!=="ok" ? 700 : 400,
                              fontSize:12,
                            }}>
                              {urgency==="crit"?"⚠️ ":urgency==="warn"?"🕐 ":""}{l.scheduledDate.slice(0,10)}
                            </span>
                          ) : <span style={{color:"var(--muted)"}}>—</span>}
                        </td>
                        <td style={{fontSize:12}}>{l.destinationMine ?? "—"}</td>
                        <td style={{color:"var(--muted)",fontSize:11}}>{l.createdBy.fullName}</td>
                        <td>
                          <button type="button" onClick={()=>openLogDetails(l)} style={{padding:"4px 6px",borderRadius:7,border:"1px solid var(--border)",background:"transparent",color:"var(--muted)",fontSize:10,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",maxWidth:"100%"}}>
                            Дэлгэрэнгүй
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="pg">
                <span className="pgi">{filteredLogs.length} бүртгэл · {currentTablePage*PAGE_SIZE+1}–{Math.min((currentTablePage+1)*PAGE_SIZE, filteredLogs.length)}</span>
                <button className={`pgb${currentTablePage===0?" ":""}`} onClick={()=>setTablePage(p=>Math.max(0,p-1))} disabled={currentTablePage===0}>‹</button>
                <span style={{fontSize:11,color:"var(--muted)",padding:"0 4px"}}>{currentTablePage+1}/{totalPages}</span>
                <button className={`pgb${currentTablePage===totalPages-1?" ":""}`} onClick={()=>setTablePage(p=>Math.min(totalPages-1,p+1))} disabled={currentTablePage===totalPages-1}>›</button>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>

            {/* Action panel — primary button first, secondary grid below */}
            <div className="panel" style={{padding:20}}>
              <div className="panel-title" style={{marginBottom:12}}>Үйлдлүүд</div>
              {canEdit && (
                <button type="button" onClick={()=>openCreateModal()}
                  style={{
                    width:"100%", padding:"11px 16px", borderRadius:10, marginBottom:10,
                    border:"1.5px solid #10B981",
                    background:"rgba(16,185,129,0.12)",
                    color:"#10B981", fontSize:13, fontWeight:800, cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                    transition:"all .15s",
                  }}>
                  <span style={{fontSize:16}}>➕</span> Бүртгэл нэмэх
                </button>
              )}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {[
                  {icon:"📄",label:"Тайлан",color:"#3B82F6",onClick:openReportModal},
                  {icon:"📊",label:"Excel",color:"#10B981"},
                  {icon:"📋",label:"PDF",color:"#EF4444",onClick:openReportModal},
                  {icon:"🔄",label:"Шинэчлэх",color:"#F59E0B",onClick:()=>{ void mutateLogs(); void mutateMaterials(); }},
                ].map(a=>(
                  <button key={a.label} type="button" onClick={a.onClick}
                    style={{display:"flex",alignItems:"center",gap:7,padding:"8px 10px",border:`1px solid var(--border)`,borderRadius:9,background:`${a.color}07`,color:a.color,cursor:"pointer",fontSize:11,fontWeight:600,transition:"all .15s"}}>
                    <span style={{fontSize:15}}>{a.icon}</span>
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <AiDecisionCenter
              recommendations={productionRecommendations}
              emptyTitle="Үйлдвэрлэлийн төлөв тогтвортой"
              emptyBody="Өнөөдрийн гарц, ачилтын хуваарь, бүтээгдэхүүний давтамж хэвийн байна."
            />

          </div>
        </div>
      </div>

      {toastMessage && <div className="production-toast">{toastMessage}</div>}

      {/* Live Report Modal */}
      {reportModal ? (
        <div
          className="mo open"
          role="dialog"
          aria-modal="true"
          aria-labelledby="production-report-title"
          onClick={(e) => e.target === e.currentTarget && setReportModal(false)}
        >
          <div className="mc report-print-root production-report-print" style={{ maxWidth: 1080, width: "100%", padding: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh" style={{ marginBottom: 0, padding: "22px 24px 0", flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 0 4px rgba(16,185,129,0.12)" }} />
                  <span style={{ color: "#10B981", fontSize: 11, fontWeight: 800, letterSpacing: 0 }}>
                    14 хоногийн тайлан шинэчлэгдэж байна
                  </span>
                </div>
                <h3 id="production-report-title" style={{ marginBottom: 6 }}>Үйлдвэрлэлийн 14 хоногийн тайлан</h3>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>
                  Хугацаа: <strong style={{ color: "var(--text)" }}>{formatShortDate(reportStart)} - {formatShortDate(reportNow)}</strong>
                  <span style={{ margin: "0 8px", opacity: 0.45 }}>|</span>
                  Бэлтгэсэн: {formatDateTime(reportNow)}
                  <span style={{ margin: "0 8px", opacity: 0.45 }}>|</span>
                  Сүүлийн sync: {formatDateTime(lastUpdated)}
                </div>
              </div>
              <div className="report-print-actions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button className="btn bp" type="button" onClick={printReport}>
                  PDF татах
                </button>
                <button
                  className="btn bo2"
                  type="button"
                  onClick={() => {
                    setReportClock(new Date());
                    void mutateLogs();
                    void mutateMaterials();
                  }}
                >
                  Шинэчлэх
                </button>
                <button className="mx print-hidden" type="button" aria-label="Тайлан хаах" onClick={() => setReportModal(false)}>×</button>
              </div>
            </div>

            <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 10 }}>
                {[
                  { label: "Тайлангийн хугацаа", value: `${REPORT_DAYS} хоног`, sub: `${formatShortDate(reportStart)} - ${formatShortDate(reportNow)}`, color: "#3B82F6" },
                  { label: "Нийт үйлдвэрлэл", value: fmtDisplay(reportTotalProduced), sub: `${reportLogs.length} бүртгэл`, color: "#10B981" },
                  { label: "Өдрийн дундаж", value: fmtDisplay(reportAverageDaily), sub: "14 хоногийн дундаж", color: "#14B8A6" },
                  { label: "Ачилтын хэмжээ", value: fmtDisplay(reportShipmentTotal), sub: `${reportShipments.length} төлөвлөгөөт ачилт`, color: "#F59E0B" },
                  { label: "Гүйцэтгэл", value: reportTotalTarget > 0 ? `${reportEfficiencyPct}%` : "N/A", sub: reportTotalTarget > 0 ? `Төлөвлөгөө ${fmtDisplay(reportTotalTarget)}` : "Төлөвлөгөө бүртгэгдээгүй", color: reportHealth.color },
                  { label: "Бүтээгдэхүүн", value: `${reportActiveProductCount}/${PRODUCTS.length}`, sub: "Хөдөлгөөнтэй төрөл", color: "#A78BFA" },
                  { label: "RPM бүртгэл", value: `${reportTelemetryRows.length}`, sub: reportTelemetryAvgLoad === null ? "Telemetry байхгүй" : `Дундаж ачаалал ${reportTelemetryAvgLoad}%`, color: "#22D3EE" },
                ].map((card) => (
                  <div key={card.label} style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid var(--border)", background: `${card.color}0d` }}>
                    <div style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>{card.label}</div>
                    <div style={{ color: card.color, fontSize: 20, fontWeight: 850, lineHeight: 1.15 }}>{card.value}</div>
                    <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 6 }}>{card.sub}</div>
                  </div>
                ))}
              </div>

              <div className="panel" style={{ padding: 18, margin: 0 }}>
                <div className="panel-title" style={{ marginBottom: 10 }}>Тайлангийн дүгнэлт</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 10 }}>
                  {[
                    { label: "Нийт бүртгэл", value: `${reportLogs.length}`, sub: "Сүүлийн 14 хоног" },
                    { label: "Топ бүтээгдэхүүн", value: reportTopProduct ? reportTopProduct.product : "Байхгүй", sub: reportTopProduct ? fmtDisplay(reportTopProduct.produced) : "Үйлдвэрлэл бүртгэгдээгүй" },
                    { label: "Тайлангийн төлөв", value: reportHealth.label, sub: reportTotalTarget > 0 ? `${reportEfficiencyPct}% гүйцэтгэл` : "Төлөвлөгөө оруулаагүй" },
                    { label: "Идэвхтэй өдөр", value: `${reportDailyRows.filter((row) => row.count > 0).length}`, sub: `${REPORT_DAYS} өдрөөс үйлдвэрлэлтэй өдөр` },
                    { label: "RPM анхааруулга", value: `${reportTelemetryWarningCount + reportTelemetryCriticalCount}`, sub: `Warning ${reportTelemetryWarningCount} · Critical ${reportTelemetryCriticalCount}` },
                  ].map((item) => (
                    <div key={item.label} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", background: "rgba(255,255,255,0.025)" }}>
                      <div style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{item.label}</div>
                      <div style={{ color: "var(--text)", fontSize: 15, fontWeight: 850, lineHeight: 1.25, overflowWrap: "anywhere" }}>{item.value}</div>
                      <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 5 }}>{item.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel" style={{ padding: 18, margin: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                  <div>
                    <div className="panel-title">Өдрийн үйлдвэрлэл ба төлөвлөгөө</div>
                    <div className="panel-sub" style={{ marginTop: 4 }}>14 хоногийн өдөр тус бүрийн үйлдвэрлэл, ачилт, төлөвлөгөө.</div>
                  </div>
                  <span style={{ color: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono), monospace" }}>
                    {formatShortDate(reportStart)} - {formatShortDate(reportNow)}
                  </span>
                </div>
                <div style={{ maxHeight: 320, overflow: "auto" }}>
                  <table className="safety-table wh-table production-report-table">
                    <thead>
                      <tr>
                        <th>Огноо</th>
                        <th>Үйлдвэрлэл</th>
                        <th>Төлөвлөгөө</th>
                        <th>Гүйцэтгэл</th>
                        <th>Ачилт</th>
                        <th>Бүртгэл</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportDailyRows.map((row) => {
                        const pct = row.target > 0 ? Math.round((row.produced / row.target) * 100) : null;
                        return (
                          <tr key={row.key}>
                            <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 11 }}>{row.label}</td>
                            <td style={{ color: row.produced > 0 ? "#10B981" : "var(--muted)", fontWeight: 800 }}>{fmtDisplay(row.produced)}</td>
                            <td>{row.target > 0 ? fmtDisplay(row.target) : "-"}</td>
                            <td style={{ color: pct === null ? "var(--muted)" : pct >= 100 ? "#10B981" : pct >= 80 ? "#F59E0B" : "#EF4444", fontWeight: 800 }}>
                              {pct === null ? "N/A" : `${pct}%`}
                            </td>
                            <td style={{ color: row.shipment > 0 ? "#3B82F6" : "var(--muted)", fontWeight: 800 }}>{fmtDisplay(row.shipment)}</td>
                            <td>{row.count}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel" style={{ padding: 18, margin: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                  <div>
                    <div className="panel-title">Бүтээгдэхүүн тус бүрийн 14 хоногийн үйлдвэрлэл</div>
                    <div className="panel-sub" style={{ marginTop: 4 }}>Үйлдвэрлэсэн хэмжээ, бүртгэлийн тоо, нягтын дундаж.</div>
                  </div>
                  <span style={{ color: "var(--muted)", fontSize: 11 }}>{reportActiveProductCount} идэвхтэй бүтээгдэхүүн</span>
                </div>
                <div style={{ maxHeight: 320, overflow: "auto" }}>
                  <table className="safety-table wh-table production-report-table">
                    <thead>
                      <tr>
                        <th>Бүтээгдэхүүн</th>
                        <th>Үйлдвэрлэл</th>
                        <th>Бүртгэл</th>
                        <th>Дундаж нягт</th>
                        <th>Ачилтын хэмжээ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportProductRows.map((row) => (
                        <tr key={row.product}>
                          <td><strong style={{ color: row.color }}>{row.product}</strong></td>
                          <td style={{ color: row.produced > 0 ? "#10B981" : "var(--muted)", fontWeight: 800 }}>{fmtDisplay(row.produced)}</td>
                          <td>{row.count}</td>
                          <td>{row.averageDensity === null ? "-" : fmtDensity(row.averageDensity)}</td>
                          <td style={{ color: row.shipped > 0 ? "#3B82F6" : "var(--muted)", fontWeight: 800 }}>{fmtDisplay(row.shipped)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel" style={{ padding: 18, margin: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                  <div>
                    <div className="panel-title">Тоног төхөөрөмжийн RPM бүртгэл</div>
                    <div className="panel-sub" style={{ marginTop: 4 }}>Үйлдвэрлэл бүртгэх үед DB-д хадгалсан тоног төхөөрөмжийн RPM telemetry.</div>
                  </div>
                  <span style={{ color: "var(--muted)", fontSize: 11 }}>
                    {reportTelemetryRows.length} мөр · Warning {reportTelemetryWarningCount} · Critical {reportTelemetryCriticalCount}
                  </span>
                </div>
                <div style={{ maxHeight: 360, overflow: "auto" }}>
                  <table className="safety-table wh-table production-report-table production-rpm-report-table">
                    <thead>
                      <tr>
                        <th>Огноо</th>
                        <th>Бүтээгдэхүүн</th>
                        <th>Тоног төхөөрөмж</th>
                        <th>RPM</th>
                        <th>Load</th>
                        <th>Төлөв</th>
                        <th>Temp</th>
                        <th>Pressure</th>
                        <th>Vibration</th>
                        <th>Тэмдэглэл</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportTelemetryRows.length === 0 ? (
                        <tr><td colSpan={10} style={{ padding: 18, color: "var(--muted)", textAlign: "center" }}>Энэ хугацаанд RPM telemetry бүртгэл байхгүй байна</td></tr>
                      ) : reportTelemetryRows.map(({ log, telemetry }) => {
                        const statusTone = rpmStatusFromLabel(telemetry.status);
                        return (
                          <tr key={telemetry.id}>
                            <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 11 }}>{formatDateTime(new Date(telemetry.recordedAt))}</td>
                            <td><strong>{log.productName}</strong><div style={{ color: "var(--muted)", fontSize: 10 }}>{fmtDisplay(log.outputQuantity)}</div></td>
                            <td><strong>{telemetry.equipment.name}</strong><div style={{ color: "var(--muted)", fontSize: 10 }}>{telemetry.equipment.type}</div></td>
                            <td style={{ fontFamily: "var(--font-mono), monospace", fontWeight: 800 }}>{telemetry.rpm.toLocaleString("mn-MN")} / {telemetry.maxRpm.toLocaleString("mn-MN")}</td>
                            <td style={{ color: statusTone.color, fontWeight: 800 }}>{Math.round(telemetry.loadPercent)}%</td>
                            <td><span style={{ color: statusTone.color, fontWeight: 800 }}>{statusTone.label}</span></td>
                            <td>{telemetry.temperature === null ? "-" : `${telemetry.temperature}°C`}</td>
                            <td>{telemetry.pressure === null ? "-" : `${telemetry.pressure} bar`}</td>
                            <td>{telemetry.vibration === null ? "-" : `${telemetry.vibration} mm/s`}</td>
                            <td style={{ maxWidth: 180, whiteSpace: "normal" }}>{telemetry.note || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel" style={{ padding: 18, margin: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                  <div>
                    <div className="panel-title">14 хоногийн үйлдвэрлэлийн бүртгэл</div>
                    <div className="panel-sub" style={{ marginTop: 4 }}>Сүүлийн 20 бүртгэлийг огноогоор бууруулж харуулна.</div>
                  </div>
                  <span style={{ color: "var(--muted)", fontSize: 11 }}>{reportLogs.length} нийт бүртгэл</span>
                </div>
                <div style={{ maxHeight: 320, overflow: "auto" }}>
                  <table className="safety-table wh-table production-report-table">
                    <thead>
                      <tr>
                        <th>Огноо</th>
                        <th>Lot</th>
                        <th>Бүтээгдэхүүн</th>
                        <th>Хэмжээ</th>
                        <th>Нягт</th>
                        <th>Бүртгэсэн</th>
                        <th>Ачилт</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportLatestLogs.length === 0 ? (
                        <tr><td colSpan={7} style={{ padding: 18, color: "var(--muted)", textAlign: "center" }}>Энэ хугацаанд үйлдвэрлэлийн бүртгэл байхгүй байна</td></tr>
                      ) : reportLatestLogs.map((log) => (
                        <tr key={log.id}>
                          <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 11 }}>{formatDateTime(new Date(log.productionDate))}</td>
                          <td style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11 }}>{log.lotNumber}</td>
                          <td><strong>{log.productName}</strong></td>
                          <td style={{ color: "#10B981", fontWeight: 800 }}>{fmtDisplay(log.outputQuantity)}</td>
                          <td>{fmtDensity(log.density)}</td>
                          <td style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{log.createdBy.fullName}</td>
                          <td style={{ color: log.scheduledDate ? "#3B82F6" : "var(--muted)", whiteSpace: "nowrap" }}>
                            {log.scheduledDate ? log.scheduledDate.slice(0, 10) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal */}
      {modal && (
        <div className="mo open" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="mc production-log-modal">
            <div className="mh">
              <h3>Бүртгэл нэмэх</h3>
              <button className="mx" type="button" onClick={()=>setModal(false)}>×</button>
            </div>
            <form onSubmit={submitLog}>
              <div className="production-log-form-grid">
                <div className="fg"><label>Бүтээгдэхүүн</label>
                  <select value={productName} onChange={e=>{ const next = e.target.value as (typeof PRODUCTS)[number]; setProductName(next); setManualMaterialUsage(Object.fromEntries(MANUAL_EXPLOSIVE_INPUTS.map((materialName) => [materialName, ""]))); resetEquipmentRows(next); }}>
                    {PRODUCTS.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="fg"><label>Материал</label>
                  {requiresManualMaterialUsage(productName) ? (
                    <div style={{ display: "grid", gap: 8, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(34,211,238,0.22)", background: "rgba(8,16,31,0.52)" }}>
                      {manualUsagePreview.map((item) => {
                        const enough = item.required <= 0 || item.stock >= item.required;
                        return (
                          <label key={item.materialName} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 112px", alignItems: "center", gap: 8 }}>
                            <span style={{ display: "grid", gap: 2 }}>
                              <strong style={{ color: "var(--text)", fontSize: 11 }}>{item.materialName}</strong>
                              <small style={{ color: enough ? "var(--muted)" : "#F87171", fontSize: 10 }}>
                                Үлдэгдэл: {item.stock.toLocaleString("mn-MN")} {item.unit}
                              </small>
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={manualMaterialUsage[item.materialName] ?? ""}
                              onChange={(event) => updateManualMaterialUsage(item.materialName, event.target.value)}
                              placeholder="кг"
                              style={{ minWidth: 0 }}
                            />
                          </label>
                        );
                      })}
                    </div>
                  ) : recipePreview.length > 0 ? (
                    <div style={{ display: "grid", gap: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(34,211,238,0.22)", background: "rgba(8,16,31,0.52)" }}>
                      {recipePreview.map((item) => {
                        const enough = item.required <= 0 || item.stock >= item.required;
                        return (
                          <div key={item.materialName} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, color: enough ? "var(--text)" : "#F87171", fontSize: 11, fontWeight: 800 }}>
                            <span>{item.materialName}</span>
                            <span style={{ color: enough ? "var(--muted)" : "#F87171", whiteSpace: "nowrap" }}>
                              {item.required > 0 ? `${item.required.toLocaleString("mn-MN")} / ` : ""}
                              {item.stock.toLocaleString("mn-MN")} {item.unit}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <input type="text" value="Автоматаар үүсгэнэ" readOnly/>
                  )}
                </div>
                <div className="fg"><label>Үйлдвэрлэсэн өдөр</label>
                  <input type="datetime-local" value={productionDate} onChange={e=>setProductionDate(e.target.value)}/>
                </div>
                <div className="fg"><label>Үйлдвэрлэсэн хэмжээ</label>
                  <input type="number" min="0" step="0.1" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Жишээ: 1500"/>
                </div>
                <div className="fg"><label>Нэгж</label>
                  <select value={amountUnit} onChange={e=>setAmountUnit(e.target.value as "kg" | "ton")}>
                    <option value="kg">Кг</option><option value="ton">Тонн</option>
                  </select>
                </div>
                <div className="fg"><label>Нягт</label>
                  <input type="number" min="0" step="0.01" value={density} onChange={e=>setDensity(e.target.value)} placeholder="Жишээ: 1.15"/>
                </div>
                <div className="fg"><label>Нягтын нэгж</label>
                  <input type="text" value="г/см³" readOnly/>
                </div>
                <div className="fg"><label>Очих уурхай</label>
                  <select value={destinationMine} onChange={e=>setDestinationMine(e.target.value)}>
                    {MINE_OPTIONS.map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="production-log-text-grid">
                <div className="fg"><label>Ажилтнууд / MR код</label>
                  <textarea className="production-log-textarea" value={workerInfo} onChange={e=>setWorkerInfo(e.target.value)} placeholder={"Жишээ:\nБат MR-0123\nСараа MR-0456"}/>
                </div>
                <div className="fg"><label>Тэмдэглэл</label>
                  <textarea className="production-log-textarea" value={note} onChange={e=>setNote(e.target.value)} placeholder="Нэмэлт тайлбар"/>
                </div>
              </div>
              <div className="equipment-rpm-editor">
                <div className="equipment-rpm-editor__head">
                  <div>
                    <strong>Equipment RPM records</strong>
                    <span>Бүтээгдэхүүн бүртгэхэд ашигласан тоног төхөөрөмжийн бодит RPM-ийг хадгална.</span>
                  </div>
                  <button type="button" onClick={addEquipmentRow}>+ RPM мөр</button>
                </div>
                <div className="equipment-rpm-list">
                  {equipmentRows.map((row) => {
                    const preview = getEquipmentRowPreview(row);
                    const previewStatus = rpmStatusFromLabel(preview.status);
                    return (
                      <div className="equipment-rpm-row" key={row.rowId}>
                        <label>
                          <span>Equipment</span>
                          <select value={row.equipmentId} onChange={(event) => selectEquipmentForRow(row.rowId, event.target.value)}>
                            <option value="">Сонгох</option>
                            {equipmentOptions.map((item) => <option key={item.id} value={item.id}>{item.name} · max {item.maxRpm.toLocaleString("mn-MN")} rpm</option>)}
                          </select>
                        </label>
                        <label>
                          <span>RPM</span>
                          <input type="number" min="0" step="1" value={row.rpm} onChange={(event) => updateEquipmentRow(row.rowId, { rpm: event.target.value })} placeholder={row.equipmentName ? String(getDefaultEquipmentRpm(row.equipmentName) ?? "RPM") : "RPM"} />
                        </label>
                        <label>
                          <span>Max RPM</span>
                          <input type="number" min="1" step="1" value={row.maxRpm} onChange={(event) => updateEquipmentRow(row.rowId, { maxRpm: event.target.value })} placeholder="2950" />
                        </label>
                        <label>
                          <span>Temp</span>
                          <input type="number" step="0.1" value={row.temperature} onChange={(event) => updateEquipmentRow(row.rowId, { temperature: event.target.value })} placeholder="optional" />
                        </label>
                        <label>
                          <span>Pressure</span>
                          <input type="number" step="0.1" value={row.pressure} onChange={(event) => updateEquipmentRow(row.rowId, { pressure: event.target.value })} placeholder="optional" />
                        </label>
                        <label>
                          <span>Vibration</span>
                          <input type="number" step="0.1" value={row.vibration} onChange={(event) => updateEquipmentRow(row.rowId, { vibration: event.target.value })} placeholder="optional" />
                        </label>
                        <label className="equipment-rpm-row__note">
                          <span>Note</span>
                          <input type="text" value={row.note} onChange={(event) => updateEquipmentRow(row.rowId, { note: event.target.value })} placeholder="optional" />
                        </label>
                        <div className="equipment-rpm-preview">
                          <span style={{ color: previewStatus.color, borderColor: previewStatus.border, background: previewStatus.bg }}>{preview.loadPercent ? `${preview.loadPercent}%` : "0%"}</span>
                          <strong style={{ color: previewStatus.color }}>{previewStatus.label}</strong>
                        </div>
                        <button className="equipment-rpm-remove" type="button" onClick={() => removeEquipmentRow(row.rowId)} aria-label="Remove RPM row">×</button>
                      </div>
                    );
                  })}
                </div>
              </div>
              {error && <div style={{color:"#f87171",fontSize:12,marginBottom:8}}>{error}</div>}
              <div className="mf">
                <button className="btn bo2" type="button" onClick={()=>setModal(false)}>Цуцлах</button>
                <button className="btn bp" type="submit" disabled={submitting}>{submitting?"Хадгалж байна...":"Хадгалах"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {shipmentModal && (
        <div className="mo open" onClick={e=>{if(e.target===e.currentTarget) closeShipmentModal();}}>
          <div className="mc" style={{width:"min(540px, 100%)"}}>
            <div className="mh">
              <div>
                <h3>Дараагийн ачилт төлөвлөх</h3>
                <div style={{fontSize:12,color:"var(--muted)",marginTop:4}}>
                  Ямар бүтээгдэхүүн, хэзээ, хаашаа ачигдахыг бүртгэнэ
                </div>
              </div>
              <button className="mx" type="button" onClick={closeShipmentModal}>×</button>
            </div>
            <div className="fg"><label>Ямар бүтээгдэхүүн ачигдах вэ?</label>
              <select value={shipmentProductName} onChange={e=>setShipmentProductName(e.target.value)}>
                {PRODUCTS.map((product)=><option key={product} value={product}>{product}</option>)}
              </select>
            </div>
            <div className="fr2">
              <div className="fg"><label>Хэдэн хэмжээ ачих вэ?</label>
                <input type="number" min="0" step="0.1" value={shipmentAmount} onChange={e=>setShipmentAmount(e.target.value)} placeholder="Жишээ: 7"/>
              </div>
              <div className="fg"><label>Нэгж</label>
                <select value={shipmentAmountUnit} onChange={e=>setShipmentAmountUnit(e.target.value as "kg" | "ton")}>
                  <option value="kg">Кг</option><option value="ton">Тонн</option>
                </select>
              </div>
            </div>
            <div className="fr2">
              <div className="fg"><label>Хэзээ ачих вэ?</label>
                <input type="date" value={shipmentDate} onChange={e=>setShipmentDate(e.target.value)}/>
              </div>
              <div className="fg"><label>Хаашаа ачих вэ?</label>
                <input
                  type="text"
                  value={shipmentDestinationMine}
                  onChange={e=>setShipmentDestinationMine(e.target.value)}
                  placeholder="Жишээ: Оюутолгой, Эрдэнэт, Бор-Өндөр"
                />
              </div>
            </div>
            {shipmentError && <div style={{color:"#f87171",fontSize:12,marginTop:10,marginBottom:8}}>{shipmentError}</div>}
            <div className="mf">
              <button className="btn bo2" type="button" onClick={closeShipmentModal}>Цуцлах</button>
              <button className="btn bp" type="button" onClick={saveShipmentDate} disabled={savingShipmentDate}>
                {savingShipmentDate ? "Хадгалж байна..." : "Хадгалах"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedLog && (
        <div className="mo open" onClick={e=>{if(e.target===e.currentTarget){setDeleteError("");setSelectedLog(null);}}}>
          <div className="mc" style={{width:"min(760px, 100%)"}}>
            <div className="mh">
              <div>
                <h3>Үйлдвэрлэлийн дэлгэрэнгүй</h3>
                <div style={{fontSize:12,color:"var(--muted)",marginTop:4}}>{selectedLog.lotNumber}</div>
              </div>
              <button className="mx" type="button" onClick={()=>{setDeleteError("");setSelectedLog(null);}}>×</button>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12,marginBottom:16}}>
              {[
                ["Бүтээгдэхүүн", selectedLog.productName],
                ["Үйлдвэрлэсэн өдөр", selectedLog.productionDate.slice(0,10)],
                ["Хэмжээ", fmtDisplay(selectedLog.outputQuantity)],
                ["Өдрийн төлөвлөгөө", selectedDayTarget > 0 ? fmtDisplay(selectedDayTarget) : "Бүртгээгүй"],
                ["Өдрийн гүйцэтгэл", selectedDayTarget > 0 ? `${fmtDisplay(selectedDayPoint?.produced ?? 0)} (${selectedDayProgressPct}%)` : fmtDisplay(selectedDayPoint?.produced ?? selectedLog.outputQuantity)],
                ["Нягт", fmtDensity(selectedLog.density)],
                ["Материал", `${selectedLog.material.name} (${selectedLog.material.unit})`],
                ["Ачигдах өдөр", selectedLog.scheduledDate ? selectedLog.scheduledDate.slice(0,10) : "—"],
                ["Ачилтын хэмжээ", selectedLog.scheduledDate ? fmtDisplay(getShipmentQuantity(selectedLog)) : "—"],
                ["Очих уурхай", selectedLog.destinationMine ?? "—"],
                ["Бүртгэсэн", selectedLog.createdBy.fullName],
              ].map(([label,value])=>(
                <div key={label} style={{padding:"11px 12px",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)"}}>
                  <div style={{fontSize:10,color:"#90a2c3",fontWeight:800,textTransform:"uppercase",marginBottom:5}}>{label}</div>
                  <div style={{fontSize:13,color:"#fff",fontWeight:700,wordBreak:"break-word"}}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{padding:"14px",borderRadius:12,border:"1px solid rgba(16,185,129,0.18)",background:"rgba(16,185,129,0.06)",marginBottom:12}}>
              <div style={{fontSize:12,color:"#10B981",fontWeight:800,marginBottom:10}}>Ажилтнууд / MR код</div>
              {selectedWorkers.length > 0 ? (
                <div style={{display:"grid",gap:8}}>
                  {selectedWorkers.map((worker, index)=>(
                    <div key={`${worker}-${index}`} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:9,background:"rgba(8,14,26,0.35)",color:"#fff",fontSize:12}}>
                      <span style={{width:22,height:22,borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",background:"rgba(16,185,129,0.16)",color:"#34D399",fontWeight:800,fontSize:10}}>{index+1}</span>
                      <span style={{wordBreak:"break-word"}}>{worker}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{fontSize:12,color:"var(--muted)"}}>Ажилтан болон MR код бүртгээгүй байна.</div>
              )}
            </div>

            <div style={{padding:"14px",borderRadius:12,border:"1px solid rgba(34,211,238,0.18)",background:"rgba(34,211,238,0.06)",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10}}>
                <div style={{fontSize:12,color:"#22D3EE",fontWeight:800}}>Тоног төхөөрөмжийн RPM</div>
                <div style={{fontSize:11,color:"var(--muted)"}}>{(selectedLog.telemetryLogs ?? []).length} мөр</div>
              </div>
              {(selectedLog.telemetryLogs ?? []).length === 0 ? (
                <div style={{fontSize:12,color:"var(--muted)"}}>Энэ бүртгэл дээр RPM telemetry хадгалагдаагүй байна.</div>
              ) : (
                <div style={{display:"grid",gap:8}}>
                  {(selectedLog.telemetryLogs ?? []).map((telemetry) => {
                    const tone = rpmStatusFromLabel(telemetry.status);
                    return (
                      <div key={telemetry.id} style={{display:"grid",gridTemplateColumns:"1.25fr .8fr .65fr .65fr .65fr",gap:10,alignItems:"center",padding:"10px 12px",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(8,14,26,0.42)"}}>
                        <div>
                          <div style={{fontSize:12,color:"#fff",fontWeight:800}}>{telemetry.equipment.name}</div>
                          <div style={{fontSize:10,color:"var(--muted)",marginTop:2}}>{formatDateTime(new Date(telemetry.recordedAt))}</div>
                        </div>
                        <div style={{fontFamily:"var(--font-mono), monospace",fontSize:12,color:"#fff",fontWeight:800}}>
                          {telemetry.rpm.toLocaleString("mn-MN")} / {telemetry.maxRpm.toLocaleString("mn-MN")} rpm
                        </div>
                        <div style={{fontSize:12,color:tone.color,fontWeight:850}}>{Math.round(telemetry.loadPercent)}%</div>
                        <div style={{fontSize:11,color:"var(--muted)"}}>
                          T {telemetry.temperature ?? "-"} · P {telemetry.pressure ?? "-"} · V {telemetry.vibration ?? "-"}
                        </div>
                        <div style={{justifySelf:"end",fontSize:10,fontWeight:850,color:tone.color,border:`1px solid ${tone.border}`,background:tone.bg,borderRadius:999,padding:"5px 8px"}}>
                          {tone.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{padding:"14px",borderRadius:12,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)"}}>
              <div style={{fontSize:12,color:"#90a2c3",fontWeight:800,marginBottom:8}}>Тэмдэглэл</div>
              <div style={{fontSize:12,color:"#fff",lineHeight:1.5,whiteSpace:"pre-wrap"}}>{selectedLog.note || "Тэмдэглэл байхгүй"}</div>
            </div>
            {deleteError && <div style={{color:"#f87171",fontSize:12,marginTop:12}}>{deleteError}</div>}
            {canEdit && (
              <div className="mf">
                <button className="btn bd2" type="button" onClick={deleteSelectedLog} disabled={deletingLog}>
                  {deletingLog ? "Устгаж байна..." : "Устгах"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
