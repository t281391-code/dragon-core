"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import useSWR from "swr";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/components/AuthProvider";
import { DeptTopbar } from "@/components/DeptTopbar";
import { KpiCard } from "@/components/KpiCard";
import { ChartHint, RealtimeBadge, REALTIME_REFRESH_MS } from "@/components/RealtimeBadge";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { printReport } from "@/lib/reportPrint";

type SafetyIncident = {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  incidentDate: string;
  location: string;
  reportedBy: {
    fullName: string;
    mrCode: string | null;
    department: { name: string };
  };
};

type ReporterUser = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  role: { name: string };
  department: { name: string };
};

const ACCENT = "#EF4444";
const MONTH_SEEDS = [3, 5, 2, 7, 4, 6];
const PAGE_SIZE = 20;
const REPORT_DAYS = 14;

const fetcher = (url: string) => fetch(url).then(r => r.json());

const STATUS_LABELS: Record<string, string> = {
  open: "Нээлттэй",
  investigating: "Шалгаж байна",
  resolved: "Шийдвэрлэгдсэн",
  closed: "Хаагдсан",
};

const STATUS_BADGES: Record<string, string> = {
  open: "bg-r",
  investigating: "bg-a",
  resolved: "bg-g",
  closed: "bg-gr",
};

const SEVERITY_LABELS: Record<string, string> = {
  high: "Өндөр",
  medium: "Дунд",
  low: "Бага",
};

const DEPT_MN: Record<string, string> = {
  WAREHOUSE: "Агуулах",
  PRODUCTION: "Үйлдвэрлэл",
  SAFETY: "ХЭАБО",
  LOGISTICS: "Тээвэр",
};

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

function categorizeIncident(incident: SafetyIncident) {
  const source = `${incident.title} ${incident.description}`.toLowerCase();
  if (source.includes("хамгаалах") || source.includes("каск") || source.includes("ppe") || source.includes("хэрэгсэл")) return "ppe";
  if (source.includes("өндөр") || source.includes("бүс") || source.includes("шат")) return "height";
  if (source.includes("гал") || source.includes("унтраагуур") || source.includes("fire")) return "fire";
  return "risk";
}

function buildMonthlySeries(incidents: SafetyIncident[]) {
  const now = new Date();
  const buckets = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: `${date.getMonth() + 1}-р`,
      total: 0,
      resolved: 0,
    };
  });
  const map = new Map(buckets.map((b) => [b.key, b]));
  for (const incident of incidents) {
    const date = new Date(incident.incidentDate);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const bucket = map.get(key);
    if (!bucket) continue;
    bucket.total += 1;
    if (incident.status === "resolved" || incident.status === "closed") bucket.resolved += 1;
  }
  return buckets;
}

function SafetyTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; name: string; value: number; color?: string; stroke?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--text)" }}>{label}</div>
      {payload.map((item) => (
        <div key={item.dataKey} style={{ color: item.color ?? item.stroke ?? ACCENT, marginBottom: 2 }}>
          {item.name}: <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function SafetySkeleton() {
  return (
    <div className="department-safety">
      <DeptTopbar icon="🛡️" title="ХЭАБО" />
      <div className="content">
        <div className="kpi-grid" style={{ marginBottom: 14 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="kpi-card">
              <div className="ske" style={{ height: 14, width: "55%", marginBottom: 12 }} />
              <div className="ske" style={{ height: 30, width: "40%", marginBottom: 10 }} />
              <div className="ske" style={{ height: 11, width: "75%", marginBottom: 14 }} />
              <div className="ske" style={{ height: 44 }} />
            </div>
          ))}
        </div>
        <div className="wh-main-grid" style={{ marginBottom: 14 }}>
          <div className="panel"><div className="ske" style={{ height: 280, margin: 20, borderRadius: 8 }} /></div>
          <div className="panel"><div className="ske" style={{ height: 280, margin: 20, borderRadius: 8 }} /></div>
        </div>
        <div className="wh-chart-row" style={{ marginBottom: 14 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="panel"><div className="ske" style={{ height: 200, margin: 20, borderRadius: 8 }} /></div>
          ))}
        </div>
        <div className="panel">
          <div style={{ padding: "16px 20px" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ske" style={{ height: 14, marginBottom: 14, width: `${80 + i * 4}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SafetyPage() {
  const { user } = useAuth();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tableFilter, setTableFilter] = useState("all");
  const [tableSearch, setTableSearch] = useState("");
  const [tablePage, setTablePage] = useState(0);
  const [modal, setModal] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<SafetyIncident | null>(null);
  const [reportClock, setReportClock] = useState<Date | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [status, setStatus] = useState("open");
  const [location, setLocation] = useState("");
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split("T")[0]);
  const [reporterSearch, setReporterSearch] = useState("");
  const [reporterResults, setReporterResults] = useState<ReporterUser[]>([]);
  const [selectedReporter, setSelectedReporter] = useState<ReporterUser | null>(null);
  const [reporterSearchLoading, setReporterSearchLoading] = useState(false);
  const [reporterSearchError, setReporterSearchError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingIncidentId, setDeletingIncidentId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState("");

  const { data: incidentsData, isLoading, mutate } = useSWR(
    "/api/safety-incidents?limit=100",
    fetcher,
    { refreshInterval: REALTIME_REFRESH_MS, revalidateOnFocus: false, onSuccess: () => setLastUpdated(new Date()) }
  );

  const incidents: SafetyIncident[] = useMemo(() => incidentsData?.data ?? [], [incidentsData]);

  useEscapeClose(Boolean(modal || reportModal || selectedIncident), () => {
    if (selectedIncident) {
      setSelectedIncident(null);
      return;
    }
    if (reportModal) {
      setReportModal(false);
      return;
    }
    if (modal) setModal(false);
  });

  useEffect(() => {
    if (!reportModal) return;

    const refreshReport = () => {
      setReportClock(new Date());
      void mutate();
    };

    refreshReport();
    const intervalId = window.setInterval(refreshReport, REALTIME_REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [mutate, reportModal]);

  function openReportModal() {
    setReportClock(new Date());
    setReportModal(true);
  }

  function updateTableFilter(nextFilter: string) {
    setTableFilter(nextFilter);
    setTablePage(0);
  }

  function updateTableSearch(nextSearch: string) {
    setTableSearch(nextSearch);
    setTablePage(0);
  }

  const searchReporterUsers = useCallback(async (searchValue = reporterSearch) => {
    const query = searchValue.trim();
    if (query.length < 1) {
      setReporterSearchError("");
      setReporterResults([]);
      return;
    }

    setReporterSearchLoading(true);
    setReporterSearchError("");
    let data: { data?: ReporterUser[]; error?: string };
    let response: Response;
    try {
      response = await fetch(`/api/users?q=${encodeURIComponent(query)}&limit=25`);
      data = await response.json();
    } catch {
      setReporterSearchLoading(false);
      setReporterSearchError("Хэрэглэгч хайхад алдаа гарлаа");
      setReporterResults([]);
      return;
    }
    setReporterSearchLoading(false);

    if (!response.ok) {
      setReporterSearchError(data.error ?? "Хэрэглэгч хайхад алдаа гарлаа");
      setReporterResults([]);
      return;
    }

    setReporterResults(data.data ?? []);
    if (!data.data?.length) {
      setReporterSearchError("Ийм хэрэглэгч олдсонгүй");
    }
  }, [reporterSearch]);

  useEffect(() => {
    if (!modal) return;

    const query = reporterSearch.trim();
    const timeoutId = window.setTimeout(() => {
      if (query.length < 1) {
        setReporterResults([]);
        setReporterSearchError("");
        setReporterSearchLoading(false);
        return;
      }

      void searchReporterUsers(query);
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [modal, reporterSearch, searchReporterUsers]);

  async function submitIncident(event: FormEvent) {
    event.preventDefault();
    if (!title || !description || !location || !incidentDate) {
      setError("Бүх шаардлагатай талбарыг бөглөнө үү");
      return;
    }
    setSubmitting(true);
    setError("");
    const response = await fetch("/api/safety-incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        severity,
        status,
        incidentDate,
        location,
        reportedById: selectedReporter?.id ?? user?.id,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Алдаа гарлаа");
      setSubmitting(false);
      return;
    }
    setModal(false);
    setSubmitting(false);
    setTitle(""); setDescription(""); setLocation("");
    setSeverity("medium"); setStatus("open");
    setReporterSearch(""); setReporterResults([]); setSelectedReporter(null); setReporterSearchError("");
    await mutate();
  }

  const canEdit = user?.role === "ADMIN" || (user?.role === "MODERATOR" && user.department === "SAFETY");

  function openIncidentDetails(incident: SafetyIncident) {
    setSelectedIncident(incident);
    setDetailError("");
  }

  async function deleteIncident(incident: SafetyIncident) {
    if (!canEdit || deletingIncidentId) return;
    const confirmed = window.confirm(`${incident.title} incident устгах уу?`);
    if (!confirmed) return;

    setDeletingIncidentId(incident.id);
    setDetailError("");
    const response = await fetch(`/api/safety-incidents?id=${encodeURIComponent(incident.id)}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => null) as { error?: string } | null;

    if (!response.ok) {
      setDetailError(data?.error ?? "Incident устгахад алдаа гарлаа");
      setDeletingIncidentId(null);
      return;
    }

    setSelectedIncident(null);
    setDeletingIncidentId(null);
    await mutate();
  }

  const totalIncidents = incidents.length;
  const openIncidents = useMemo(
    () => incidents.filter((i) => i.status === "open" || i.status === "investigating").length,
    [incidents]
  );
  const highSeverity = useMemo(
    () => incidents.filter((i) => i.severity === "high").length,
    [incidents]
  );
  const closedIncidents = useMemo(
    () => incidents.filter((i) => i.status === "closed" || i.status === "resolved").length,
    [incidents]
  );

  const monthlySeries = useMemo(() => buildMonthlySeries(incidents), [incidents]);
  const incidentSparkline = useMemo(() => monthlySeries.map((m) => m.total), [monthlySeries]);
  const resolvedSparkline = useMemo(() => monthlySeries.map((m) => m.resolved), [monthlySeries]);

  const ppeCount = useMemo(() => incidents.filter((i) => categorizeIncident(i) === "ppe").length, [incidents]);
  const heightCount = useMemo(() => incidents.filter((i) => categorizeIncident(i) === "height").length, [incidents]);
  const fireCount = useMemo(() => incidents.filter((i) => categorizeIncident(i) === "fire").length, [incidents]);
  const riskCount = useMemo(() => incidents.filter((i) => categorizeIncident(i) === "risk").length, [incidents]);

  const categorySeries = useMemo(() => [
    { label: "Хамгаалах хэрэгсэл", value: ppeCount, color: "#EF4444" },
    { label: "Өндрийн дүрэм", value: heightCount, color: "#F59E0B" },
    { label: "Галын аюулгүй байдал", value: fireCount, color: "#3B82F6" },
    { label: "Бусад эрсдэл", value: riskCount, color: "#10B981" },
  ], [ppeCount, heightCount, fireCount, riskCount]);

  const severityDist = useMemo(() => [
    { name: "Өндөр", value: highSeverity, color: "#EF4444" },
    { name: "Дунд", value: incidents.filter((i) => i.severity === "medium").length, color: "#F59E0B" },
    { name: "Бага", value: incidents.filter((i) => i.severity === "low").length, color: "#3B82F6" },
  ], [incidents, highSeverity]);

  const monthlyTrend = useMemo(
    () => monthlySeries.map((m, idx) => ({ label: m.label, value: m.total + (MONTH_SEEDS[idx] ?? 0) })),
    [monthlySeries]
  );

  const filteredIncidents = useMemo(() => {
    let result = incidents;
    if (tableFilter === "open") result = result.filter((i) => i.status === "open" || i.status === "investigating");
    else if (tableFilter === "high") result = result.filter((i) => i.severity === "high");
    else if (tableFilter === "closed") result = result.filter((i) => i.status === "closed" || i.status === "resolved");
    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      result = result.filter((i) => i.title.toLowerCase().includes(q) || i.location.toLowerCase().includes(q));
    }
    return result;
  }, [incidents, tableFilter, tableSearch]);

  const totalPages = Math.ceil(filteredIncidents.length / PAGE_SIZE);
  const paginatedIncidents = useMemo(
    () => filteredIncidents.slice(tablePage * PAGE_SIZE, (tablePage + 1) * PAGE_SIZE),
    [filteredIncidents, tablePage]
  );

  const alerts = useMemo(
    () => incidents
      .filter((i) => i.severity === "high" && (i.status === "open" || i.status === "investigating"))
      .slice(0, 4)
      .map((i) => ({ msg: `Өндөр эрсдэл: ${i.title} · ${i.location}` })),
    [incidents]
  );

  const reportNow = useMemo(() => reportClock ?? lastUpdated ?? new Date(), [lastUpdated, reportClock]);
  const reportStart = useMemo(() => {
    const start = new Date(reportNow);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (REPORT_DAYS - 1));
    return start;
  }, [reportNow]);
  const reportNowTime = reportNow.getTime();
  const reportStartTime = reportStart.getTime();
  const reportIncidents = useMemo(
    () => incidents.filter((incident) => {
      const time = new Date(incident.incidentDate).getTime();
      return time >= reportStartTime && time <= reportNowTime;
    }),
    [incidents, reportNowTime, reportStartTime]
  );
  const reportOpenIncidents = reportIncidents.filter((incident) => incident.status === "open" || incident.status === "investigating").length;
  const reportHighSeverity = reportIncidents.filter((incident) => incident.severity === "high").length;
  const reportClosedIncidents = reportIncidents.filter((incident) => incident.status === "closed" || incident.status === "resolved").length;
  const reportClosurePct = reportIncidents.length > 0 ? Math.round((reportClosedIncidents / reportIncidents.length) * 100) : 0;
  const reportCategoryRows = useMemo(
    () => [
      { label: "Хамгаалах хэрэгсэл", key: "ppe", count: reportIncidents.filter((incident) => categorizeIncident(incident) === "ppe").length, color: "#EF4444" },
      { label: "Өндрийн дүрэм", key: "height", count: reportIncidents.filter((incident) => categorizeIncident(incident) === "height").length, color: "#F59E0B" },
      { label: "Галын аюулгүй байдал", key: "fire", count: reportIncidents.filter((incident) => categorizeIncident(incident) === "fire").length, color: "#3B82F6" },
      { label: "Бусад эрсдэл", key: "risk", count: reportIncidents.filter((incident) => categorizeIncident(incident) === "risk").length, color: "#10B981" },
    ].sort((a, b) => b.count - a.count),
    [reportIncidents]
  );
  const reportSeverityRows = useMemo(
    () => [
      { label: "Өндөр", count: reportHighSeverity, color: "#EF4444" },
      { label: "Дунд", count: reportIncidents.filter((incident) => incident.severity === "medium").length, color: "#F59E0B" },
      { label: "Бага", count: reportIncidents.filter((incident) => incident.severity === "low").length, color: "#3B82F6" },
    ],
    [reportHighSeverity, reportIncidents]
  );
  const reportStatusRows = useMemo(
    () => [
      { label: "Нээлттэй", count: reportIncidents.filter((incident) => incident.status === "open").length, color: "#EF4444" },
      { label: "Шалгаж байна", count: reportIncidents.filter((incident) => incident.status === "investigating").length, color: "#F59E0B" },
      { label: "Шийдвэрлэгдсэн", count: reportIncidents.filter((incident) => incident.status === "resolved").length, color: "#10B981" },
      { label: "Хаагдсан", count: reportIncidents.filter((incident) => incident.status === "closed").length, color: "#64748B" },
    ],
    [reportIncidents]
  );
  const reportLatestIncidents = useMemo(
    () => [...reportIncidents]
      .sort((a, b) => new Date(b.incidentDate).getTime() - new Date(a.incidentDate).getTime())
      .slice(0, 20),
    [reportIncidents]
  );
  const reportTopCategory = reportCategoryRows.find((row) => row.count > 0) ?? null;
  const reportTopLocation = useMemo(() => {
    const counts = new Map<string, number>();
    for (const incident of reportIncidents) counts.set(incident.location, (counts.get(incident.location) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  }, [reportIncidents]);
  const reportHealth = reportHighSeverity > 0
    ? { label: "Өндөр эрсдэлтэй", color: "#EF4444" }
    : reportOpenIncidents > 0
      ? { label: "Хяналт шаардлагатай", color: "#F59E0B" }
      : { label: "Тогтвортой", color: "#10B981" };

  if (isLoading) return <SafetySkeleton />;

  return (
    <div className="department-safety">
      <DeptTopbar icon="🛡️" title="ХЭАБО" />

      <div className="content">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              ХЭАБО · Аюулгүй байдал
            </div>
            <h2 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 800 }}>Safety Dashboard</h2>
          </div>
          <RealtimeBadge lastUpdated={lastUpdated} />
        </div>

        {/* Safety Status Banner */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          {highSeverity > 0 && (
            <div style={{ flex: "1 1 220px", padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(239,68,68,0.28)", background: "rgba(239,68,68,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 16 }}>🔴</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#EF4444" }}>ӨНДӨР ЭРСДЭЛ: {highSeverity} INCIDENT</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Яаралтай арга хэмжээ авах шаардлагатай</div>
                </div>
              </div>
              <button type="button" onClick={() => updateTableFilter("high")} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(239,68,68,0.5)", background: "rgba(239,68,68,0.12)", color: "#EF4444", fontSize: 10, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>Шалгах</button>
            </div>
          )}
          {openIncidents > 0 && (
            <div style={{ flex: "1 1 200px", padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 16 }}>🟠</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#F59E0B" }}>НЭЭЛТТЭЙ: {openIncidents} INCIDENT</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Шалгаж, шийдвэрлэх шаардлагатай</div>
                </div>
              </div>
              <button type="button" onClick={() => updateTableFilter("open")} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(245,158,11,0.5)", background: "rgba(245,158,11,0.1)", color: "#F59E0B", fontSize: 10, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>Харах</button>
            </div>
          )}
          <div style={{ flex: "0 0 auto", padding: "12px 16px", borderRadius: 12, border: `1px solid ${openIncidents === 0 ? "rgba(16,185,129,0.22)" : "rgba(100,116,139,0.2)"}`, background: openIncidents === 0 ? "rgba(16,185,129,0.05)" : "rgba(100,116,139,0.05)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>{openIncidents === 0 ? "🟢" : "⚪"}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: openIncidents === 0 ? "#10B981" : "var(--muted)" }}>СИСТЕМИЙН ТӨЛӨВ: {openIncidents === 0 ? "ТОГТВОРТОЙ" : "АНХААРУУЛГА"}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{openIncidents === 0 ? "Нээлттэй incident байхгүй" : `${openIncidents} incident хянагдаж байна`}</div>
            </div>
          </div>
        </div>

        <div className="kpi-grid" style={{ marginBottom: 14 }}>
          <KpiCard label="Нийт incident" value={totalIncidents} change="Нийт бүртгэгдсэн" icon="🛡️"
            sparkline={incidentSparkline} sparklineColor={ACCENT} />
          <KpiCard label="Нээлттэй" value={openIncidents} valueStyle={{ color: ACCENT }}
            change="Шалгаж байна" icon="🔴" sparkline={incidentSparkline} sparklineColor={ACCENT} />
          <KpiCard label="Өндөр эрсдэл" value={highSeverity} valueStyle={{ color: "#F59E0B" }}
            change="Яаралтай арга хэмжээ" icon="⚠️" sparkline={incidentSparkline} sparklineColor="#F59E0B" />
          <KpiCard label="Хаагдсан" value={closedIncidents} valueStyle={{ color: "#10B981" }}
            change="Шийдвэрлэгдсэн" icon="✅" sparkline={resolvedSparkline} sparklineColor="#10B981" />
        </div>

        <div className="wh-main-grid">
          <div className="panel">
            <div className="panel-hdr">
              <div>
                <div className="panel-title">Сарын incident чиг хандлага</div>
                <div className="panel-sub">Нийт болон шийдвэрлэсэн бүртгэл</div>
              </div>
            </div>
            <div style={{ padding: "0 20px 20px" }}>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={monthlySeries}>
                  <defs>
                    <linearGradient id="sfBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0.35} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 10 }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                  <Tooltip content={<SafetyTooltip />} />
                  <Bar dataKey="total" name="Нийт" fill="url(#sfBarGrad)" radius={[5, 5, 0, 0]} barSize={14} isAnimationActive={false} />
                  <Line type="monotone" dataKey="resolved" name="Шийдвэрлэсэн" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3, fill: "#10B981" }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <ChartHint>Улаан багана нь нийт incident, ногоон шугам нь шийдвэрлэсэн incident-ийг харуулна. Мэдээлэл 5 секунд тутам шинэчлэгдэнэ.</ChartHint>
          </div>

          <div className="panel">
            <div className="panel-hdr">
              <div>
                <div className="panel-title">Severity хуваарилалт</div>
                <div className="panel-sub">Өндөр / Дунд / Бага</div>
              </div>
            </div>
            <div style={{ padding: "16px 20px 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 16, alignItems: "center" }}>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={severityDist} dataKey="value" innerRadius={44} outerRadius={68} paddingAngle={3} isAnimationActive={false}>
                      {severityDist.map((item) => <Cell key={item.name} fill={item.color} />)}
                    </Pie>
                    <Tooltip content={<SafetyTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "grid", gap: 12 }}>
                  {severityDist.map((item) => (
                    <div key={item.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, display: "inline-block" }} />
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>{item.name}</span>
                        </div>
                        <strong style={{ fontSize: 13 }}>{item.value}</strong>
                      </div>
                      <div style={{ height: 3, borderRadius: 2, background: "var(--border)" }}>
                        <div style={{ height: "100%", borderRadius: 2, background: item.color, width: `${totalIncidents > 0 ? Math.round((item.value / totalIncidents) * 100) : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="wh-chart-row">
          <div className="panel">
            <div className="panel-hdr"><div className="panel-title">Incident ангилал</div></div>
            <div style={{ padding: "0 16px 16px" }}>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={categorySeries} dataKey="value" innerRadius={34} outerRadius={54} paddingAngle={3} isAnimationActive={false}>
                    {categorySeries.map((item) => <Cell key={item.label} fill={item.color} />)}
                  </Pie>
                  <Tooltip content={<SafetyTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "grid", gap: 5, marginTop: 4 }}>
                {categorySeries.map((item) => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <strong style={{ color: "var(--text)" }}>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-hdr"><div className="panel-title">Ангиллын тархалт</div></div>
            <div style={{ padding: "0 12px 16px" }}>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={categorySeries} layout="vertical" barSize={12} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 9 }} />
                  <YAxis type="category" dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 9 }} width={90} />
                  <Tooltip content={<SafetyTooltip />} />
                  <Bar dataKey="value" name="Тоо" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    <LabelList dataKey="value" position="right" fill="var(--text)" fontSize={10} />
                    {categorySeries.map((item) => <Cell key={item.label} fill={item.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel">
            <div className="panel-hdr"><div className="panel-title">Сарын хандлага</div></div>
            <div style={{ padding: "0 12px 16px" }}>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={monthlyTrend}>
                  <defs>
                    <linearGradient id="sfTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 9 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 9 }} />
                  <Tooltip content={<SafetyTooltip />} />
                  <Area type="monotone" dataKey="value" name="Нийт" stroke="#EF4444" strokeWidth={2} fill="url(#sfTrend)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="wh-bottom-grid">
          <div className="panel">
            <div className="panel-hdr">
              <div>
                <div className="panel-title">Safety incident бүртгэл</div>
                <div className="panel-sub">DB дээрх бүх incident-ийг огноо, severity, status-аар</div>
              </div>
              {canEdit ? (
                <button className="add-btn" type="button" onClick={() => setModal(true)}>+ Incident нэмэх</button>
              ) : null}
            </div>

            <div style={{ padding: "10px 20px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {[
                { key: "all", label: "Бүгд", color: "#6b7280" },
                { key: "open", label: "Нээлттэй", color: "#EF4444" },
                { key: "high", label: "Өндөр эрсдэл", color: "#F59E0B" },
                { key: "closed", label: "Хаагдсан", color: "#10B981" },
              ].map((chip) => (
                <button key={chip.key} type="button" onClick={() => updateTableFilter(chip.key)}
                  style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600, border: `1.5px solid ${tableFilter === chip.key ? chip.color : "var(--border)"}`, background: tableFilter === chip.key ? `${chip.color}22` : "transparent", color: tableFilter === chip.key ? chip.color : "var(--muted)", cursor: "pointer" }}>
                  {chip.label}
                </button>
              ))}
              <input value={tableSearch} onChange={(e) => updateTableSearch(e.target.value)} placeholder="Хайх..."
                style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 999, fontSize: 11, border: "1.5px solid var(--border)", background: "transparent", color: "var(--text)", outline: "none", width: 140 }} />
            </div>

            <div style={{ borderTop: "1px solid var(--border)" }}>
              <table className="safety-table">
                <thead>
                  <tr>
                    <th>Огноо</th>
                    <th>Гарчиг</th>
                    <th>Байршил</th>
                    <th>Эрсдэл</th>
                    <th>Төлөв</th>
                    <th>Мэдэгдсэн</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedIncidents.length === 0 ? (
                    <tr className="empty-row">
                      <td colSpan={7} style={{ padding: "32px 16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 32 }}>🛡️</span>
                          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14 }}>Incident бүртгэл байхгүй</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>Одоогоор аюулгүй байдлын бүртгэл алга</div>
                          {canEdit && <button type="button" onClick={() => setModal(true)} style={{ marginTop: 4, padding: "6px 18px", borderRadius: 8, border: "1px solid #EF4444", background: "rgba(239,68,68,0.1)", color: "#EF4444", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Incident нэмэх</button>}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedIncidents.map((incident) => (
                      <tr key={incident.id} className="wh-tr-hover">
                        <td>{incident.incidentDate.slice(0, 10)}</td>
                        <td>
                          <strong style={{ color: "var(--text)" }}>{incident.title}</strong>
                          <div style={{ color: "var(--muted)", fontSize: 11 }}>{incident.description}</div>
                        </td>
                        <td>{incident.location}</td>
                        <td>
                          <span className={`bg ${incident.severity === "high" ? "bg-r" : incident.severity === "medium" ? "bg-a" : "bg-b"}`}>
                            {SEVERITY_LABELS[incident.severity] ?? incident.severity}
                          </span>
                        </td>
                        <td>
                          <span className={`bg ${STATUS_BADGES[incident.status] ?? "bg-gr"}`}>
                            {STATUS_LABELS[incident.status] ?? incident.status}
                          </span>
                        </td>
                        <td>{incident.reportedBy.fullName}</td>
                        <td>
                          <button type="button" onClick={() => openIncidentDetails(incident)} style={{
                            padding: "4px 10px", borderRadius: 7, whiteSpace: "nowrap", fontSize: 10, fontWeight: 700, cursor: "pointer",
                            border: `1px solid ${incident.status === "open" || incident.severity === "high" ? "rgba(239,68,68,0.4)" : "var(--border)"}`,
                            background: incident.status === "open" || incident.severity === "high" ? "rgba(239,68,68,0.08)" : "transparent",
                            color: incident.status === "open" || incident.severity === "high" ? "#EF4444" : "var(--muted)",
                          }}>
                            {incident.status === "open" || incident.status === "investigating" ? "Шалгах" : "Дэлгэрэнгүй"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="pg">
                <span className="pgi">{filteredIncidents.length} бүртгэл · {tablePage * PAGE_SIZE + 1}–{Math.min((tablePage + 1) * PAGE_SIZE, filteredIncidents.length)}</span>
                <button className="pgb" onClick={() => setTablePage(p => Math.max(0, p - 1))} disabled={tablePage === 0}>‹</button>
                <span style={{ fontSize: 11, color: "var(--muted)", padding: "0 4px" }}>{tablePage + 1}/{totalPages}</span>
                <button className="pgb" onClick={() => setTablePage(p => Math.min(totalPages - 1, p + 1))} disabled={tablePage === totalPages - 1}>›</button>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
            <div className="panel">
              <div className="panel-hdr"><div className="panel-title">Үйлдэл</div></div>
              <div style={{ padding: "4px 20px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { icon: "🛡️", label: "Incident нэмэх", onClick: () => setModal(true) },
                  { icon: "📋", label: "Тайлан гаргах", onClick: openReportModal },
                  { icon: "⚠️", label: "Эрсдэл үнэлэх" },
                  { icon: "🔄", label: "Шинэчлэх", onClick: () => void mutate() },
                ].map((a) => (
                  <button key={a.label} type="button" onClick={a.onClick}
                    style={{ padding: "10px 8px", borderRadius: 12, border: "1.5px solid var(--border)", background: "transparent", color: "var(--text)", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 18 }}>{a.icon}</span>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-hdr"><div className="panel-title">Анхааруулга</div></div>
              <div style={{ padding: "4px 20px 16px", display: "grid", gap: 8 }}>
                {alerts.length === 0 ? (
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>✅ Идэвхтэй анхааруулга байхгүй</div>
                ) : (
                  alerts.map((alert, idx) => (
                    <div key={idx} style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 12, color: "var(--text)", lineHeight: 1.4 }}>
                      <span style={{ color: "#EF4444", marginRight: 5 }}>⚠</span>
                      {alert.msg}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Report Modal */}
      {reportModal ? (
        <div
          className="mo open"
          role="dialog"
          aria-modal="true"
          aria-labelledby="safety-report-title"
          onClick={(event) => event.target === event.currentTarget && setReportModal(false)}
        >
          <div className="mc report-print-root" style={{ maxWidth: 1080, width: "100%", padding: 0 }} onClick={(event) => event.stopPropagation()}>
            <div className="mh" style={{ marginBottom: 0, padding: "22px 24px 0", flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: ACCENT, boxShadow: "0 0 0 4px rgba(239,68,68,0.12)" }} />
                  <span style={{ color: ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: 0 }}>
                    14 хоногийн тайлан шинэчлэгдэж байна
                  </span>
                </div>
                <h3 id="safety-report-title" style={{ marginBottom: 6 }}>ХЭАБО 14 хоногийн тайлан</h3>
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
                    void mutate();
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
                  { label: "Нийт incident", value: `${reportIncidents.length}`, sub: "Энэ хугацаанд", color: ACCENT },
                  { label: "Нээлттэй", value: `${reportOpenIncidents}`, sub: "Шалгах шаардлагатай", color: "#F59E0B" },
                  { label: "Өндөр эрсдэл", value: `${reportHighSeverity}`, sub: "Priority incident", color: "#EF4444" },
                  { label: "Шийдвэрлэгдсэн", value: `${reportClosedIncidents}`, sub: `${reportClosurePct}% хаалтын хувь`, color: "#10B981" },
                  { label: "Төлөв", value: reportHealth.label, sub: "Тайлангийн үнэлгээ", color: reportHealth.color },
                ].map((card) => (
                  <div key={card.label} style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid var(--border)", background: `${card.color}0d` }}>
                    <div style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>{card.label}</div>
                    <div style={{ color: card.color, fontSize: 20, fontWeight: 850, lineHeight: 1.15, overflowWrap: "anywhere" }}>{card.value}</div>
                    <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 6 }}>{card.sub}</div>
                  </div>
                ))}
              </div>

              <div className="panel" style={{ padding: 18, margin: 0 }}>
                <div className="panel-title" style={{ marginBottom: 10 }}>Тайлангийн дүгнэлт</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 10 }}>
                  {[
                    { label: "Хаалтын хувь", value: `${reportClosurePct}%`, sub: `${reportClosedIncidents}/${reportIncidents.length} incident хаагдсан` },
                    { label: "Топ ангилал", value: reportTopCategory ? reportTopCategory.label : "Байхгүй", sub: reportTopCategory ? `${reportTopCategory.count} incident` : "Incident бүртгэгдээгүй" },
                    { label: "Анхаарах байршил", value: reportTopLocation ? reportTopLocation[0] : "Байхгүй", sub: reportTopLocation ? `${reportTopLocation[1]} incident` : "Давтамж илрээгүй" },
                    { label: "Нээлттэй эрсдэл", value: `${reportOpenIncidents}`, sub: reportOpenIncidents > 0 ? "Шийдвэрлэх шаардлагатай" : "Идэвхтэй эрсдэл байхгүй" },
                  ].map((item) => (
                    <div key={item.label} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", background: "rgba(255,255,255,0.025)" }}>
                      <div style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{item.label}</div>
                      <div style={{ color: "var(--text)", fontSize: 15, fontWeight: 850, lineHeight: 1.25, overflowWrap: "anywhere" }}>{item.value}</div>
                      <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 5 }}>{item.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 16 }}>
                <div className="panel" style={{ padding: 18, margin: 0 }}>
                  <div className="panel-title" style={{ marginBottom: 12 }}>Ангиллын задаргаа</div>
                  <div style={{ maxHeight: 280, overflow: "auto" }}>
                    <table className="safety-table wh-table">
                      <thead>
                        <tr>
                          <th>Ангилал</th>
                          <th>Incident</th>
                          <th>Хувь</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportCategoryRows.map((row) => {
                          const share = reportIncidents.length > 0 ? Math.round((row.count / reportIncidents.length) * 100) : 0;
                          return (
                            <tr key={row.key}>
                              <td><strong style={{ color: row.color }}>{row.label}</strong></td>
                              <td style={{ color: row.count > 0 ? row.color : "var(--muted)", fontWeight: 800 }}>{row.count}</td>
                              <td>{share}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="panel" style={{ padding: 18, margin: 0 }}>
                  <div className="panel-title" style={{ marginBottom: 12 }}>Severity ба status</div>
                  <div style={{ display: "grid", gap: 14 }}>
                    <div style={{ maxHeight: 160, overflow: "auto" }}>
                      <table className="safety-table wh-table">
                        <thead>
                          <tr>
                            <th>Severity</th>
                            <th>Incident</th>
                            <th>Хувь</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportSeverityRows.map((row) => {
                            const share = reportIncidents.length > 0 ? Math.round((row.count / reportIncidents.length) * 100) : 0;
                            return (
                              <tr key={row.label}>
                                <td><strong style={{ color: row.color }}>{row.label}</strong></td>
                                <td style={{ color: row.color, fontWeight: 800 }}>{row.count}</td>
                                <td>{share}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ maxHeight: 180, overflow: "auto" }}>
                      <table className="safety-table wh-table">
                        <thead>
                          <tr>
                            <th>Status</th>
                            <th>Incident</th>
                            <th>Хувь</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportStatusRows.map((row) => {
                            const share = reportIncidents.length > 0 ? Math.round((row.count / reportIncidents.length) * 100) : 0;
                            return (
                              <tr key={row.label}>
                                <td><strong style={{ color: row.color }}>{row.label}</strong></td>
                                <td style={{ color: row.color, fontWeight: 800 }}>{row.count}</td>
                                <td>{share}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel" style={{ padding: 18, margin: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                  <div>
                    <div className="panel-title">14 хоногийн incident бүртгэл</div>
                    <div className="panel-sub" style={{ marginTop: 4 }}>Сүүлийн 20 incident-ийг огноогоор бууруулж харуулна.</div>
                  </div>
                  <span style={{ color: "var(--muted)", fontSize: 11 }}>{reportIncidents.length} нийт incident</span>
                </div>
                <div style={{ maxHeight: 340, overflow: "auto" }}>
                  <table className="safety-table wh-table">
                    <thead>
                      <tr>
                        <th>Огноо</th>
                        <th>Гарчиг</th>
                        <th>Байршил</th>
                        <th>Severity</th>
                        <th>Status</th>
                        <th>Мэдэгдсэн</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportLatestIncidents.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: 18, color: "var(--muted)", textAlign: "center" }}>Энэ хугацаанд incident бүртгэгдээгүй байна</td></tr>
                      ) : reportLatestIncidents.map((incident) => (
                        <tr key={incident.id}>
                          <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 11 }}>{formatDateTime(new Date(incident.incidentDate))}</td>
                          <td><strong>{incident.title}</strong></td>
                          <td>{incident.location}</td>
                          <td><span className={`bg ${incident.severity === "high" ? "bg-r" : incident.severity === "medium" ? "bg-a" : "bg-g"}`}>{SEVERITY_LABELS[incident.severity] ?? incident.severity}</span></td>
                          <td><span className={`bg ${STATUS_BADGES[incident.status] ?? "bg-gr"}`}>{STATUS_LABELS[incident.status] ?? incident.status}</span></td>
                          <td style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{incident.reportedBy.fullName}</td>
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

      {selectedIncident ? (
        <div
          className="mo open"
          role="dialog"
          aria-modal="true"
          aria-labelledby="safety-incident-detail-title"
          onClick={(event) => event.target === event.currentTarget && setSelectedIncident(null)}
        >
          <div className="mc" style={{ width: "min(620px, 100%)" }}>
            <div className="mh">
              <div>
                <h3 id="safety-incident-detail-title">Incident дэлгэрэнгүй</h3>
                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                  {selectedIncident.incidentDate.slice(0, 10)} · {selectedIncident.location}
                </div>
              </div>
              <button className="mx" type="button" onClick={() => setSelectedIncident(null)}>×</button>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ padding: 14, borderRadius: 12, border: "1px solid var(--border)", background: "rgba(255,255,255,0.03)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                  <span className={`bg ${selectedIncident.severity === "high" ? "bg-r" : selectedIncident.severity === "medium" ? "bg-a" : "bg-b"}`}>
                    {SEVERITY_LABELS[selectedIncident.severity] ?? selectedIncident.severity}
                  </span>
                  <span className={`bg ${STATUS_BADGES[selectedIncident.status] ?? "bg-gr"}`}>
                    {STATUS_LABELS[selectedIncident.status] ?? selectedIncident.status}
                  </span>
                </div>
                <div style={{ color: "var(--text)", fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{selectedIncident.title}</div>
                <div style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{selectedIncident.description}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                {[
                  { label: "Ажилтан", value: selectedIncident.reportedBy.fullName },
                  { label: "Хэлтэс", value: DEPT_MN[selectedIncident.reportedBy.department.name] ?? selectedIncident.reportedBy.department.name },
                  { label: "MR код", value: selectedIncident.reportedBy.mrCode ?? "Бүртгээгүй" },
                ].map((item) => (
                  <div key={item.label} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "rgba(255,255,255,0.025)", minWidth: 0 }}>
                    <div style={{ color: "var(--muted)", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>{item.label}</div>
                    <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 800, overflowWrap: "anywhere" }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {detailError ? <div style={{ color: "#f87171", fontSize: 12 }}>{detailError}</div> : null}
            </div>

            <div className="mf" style={{ marginTop: 18 }}>
              <button className="btn bo2" type="button" onClick={() => setSelectedIncident(null)}>Хаах</button>
              {canEdit ? (
                <button
                  className="btn bd2"
                  type="button"
                  onClick={() => void deleteIncident(selectedIncident)}
                  disabled={deletingIncidentId === selectedIncident.id}
                >
                  {deletingIncidentId === selectedIncident.id ? "Устгаж байна..." : "Устгах"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {modal ? (
        <div className="mo open" onClick={(event) => event.target === event.currentTarget && setModal(false)}>
          <div className="mc">
            <div className="mh">
              <h3>Safety incident нэмэх</h3>
              <button className="mx" type="button" onClick={() => setModal(false)}>×</button>
            </div>
            <form onSubmit={submitIncident}>
              <div className="fg">
                <label>Гарчиг</label>
                <input value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="fr2">
                <div className="fg">
                  <label>Severity</label>
                  <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
                    <option value="low">Бага</option>
                    <option value="medium">Дунд</option>
                    <option value="high">Өндөр</option>
                  </select>
                </div>
                <div className="fg">
                  <label>Status</label>
                  <select value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="open">Нээлттэй</option>
                    <option value="investigating">Шалгаж байна</option>
                    <option value="resolved">Шийдвэрлэгдсэн</option>
                    <option value="closed">Хаагдсан</option>
                  </select>
                </div>
              </div>
              <div className="fr2">
                <div className="fg">
                  <label>Огноо</label>
                  <input type="date" value={incidentDate} onChange={(event) => setIncidentDate(event.target.value)} />
                </div>
                <div className="fg">
                  <label>Байршил</label>
                  <input value={location} onChange={(event) => setLocation(event.target.value)} />
                </div>
              </div>
              <div className="fg">
                <label>Мэдэгдсэн хэрэглэгч</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    value={reporterSearch}
                    onChange={(event) => setReporterSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void searchReporterUsers();
                      }
                    }}
                    placeholder="Нэр эсвэл email-ээр хайх"
                  />
                  <button
                    className="btn bo2"
                    type="button"
                    onClick={() => void searchReporterUsers()}
                    disabled={reporterSearchLoading}
                    style={{ flexShrink: 0 }}
                  >
                    {reporterSearchLoading ? "Хайж байна..." : "Хайх"}
                  </button>
                </div>

                {reporterSearchError ? (
                  <div style={{ color: reporterResults.length ? "var(--muted)" : "#f87171", fontSize: 11, marginTop: 6 }}>
                    {reporterSearchError}
                  </div>
                ) : null}

                {reporterResults.length > 0 ? (
                  <div style={{ marginTop: 8, display: "grid", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                    {reporterResults.map((reporter) => {
                      const isSelected = selectedReporter?.id === reporter.id;
                      return (
                        <button
                          key={reporter.id}
                          type="button"
                          onClick={() => {
                            setSelectedReporter(reporter);
                            setReporterSearchError("");
                          }}
                          style={{
                            textAlign: "left",
                            padding: "9px 10px",
                            borderRadius: 10,
                            border: `1px solid ${isSelected ? "#EF4444" : "var(--border)"}`,
                            background: isSelected ? "rgba(239,68,68,0.1)" : "transparent",
                            color: "var(--text)",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                            <strong style={{ fontSize: 12 }}>{reporter.fullName}</strong>
                            <span className="bg bg-g">Идэвхтэй</span>
                          </div>
                          <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 3 }}>
                            {reporter.email} · {reporter.department.name} · {reporter.role.name}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <div className="fg">
                <label>Тайлбар</label>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
              </div>
              {error ? <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div> : null}
              <div className="mf">
                <button className="btn bo2" type="button" onClick={() => setModal(false)}>Цуцлах</button>
                <button className="btn bp" type="submit" disabled={submitting}>{submitting ? "Хадгалж байна..." : "Хадгалах"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
