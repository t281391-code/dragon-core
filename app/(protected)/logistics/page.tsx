"use client";

import { useMemo, useState, type FormEvent } from "react";
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
import TransportMap from "@/components/TransportMap";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { printReport } from "@/lib/reportPrint";

type Transport = {
  id: string;
  quantity: number;
  destinationSite: string;
  driverInfo: string | null;
  vehicleInfo: string | null;
  transportDate: string;
  deliveryDate: string | null;
  status: string;
  note: string | null;
  material: { name: string; unit: string };
  assignedUser: { fullName: string };
};

type TransportDraft = {
  driverInfo: string;
  vehicleInfo: string;
};

const ACCENT = "#3B82F6";
const DEST_COLORS = ["#3B82F6", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6"];
const PAGE_SIZE = 20;
const REPORT_DAYS = 14;

const fetcher = (url: string) => fetch(url).then(r => r.json());

const WEEK_DAYS = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function transportDateKey(transport: Transport) {
  return transport.transportDate.slice(0, 10);
}

function transportDriverName(transport: Transport) {
  return transport.driverInfo?.trim() || transport.assignedUser.fullName;
}

function monthStart(dateKey: string) {
  const [year, month] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function formatMnDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("mn-MN", { month: "short", day: "numeric" });
}

function formatDateTime(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildCalendarCells(monthDate: Date, transports: Transport[]) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const leadingDays = (firstDay.getDay() + 6) % 7;
  const counts = new Map<string, number>();

  for (const transport of transports) {
    const key = transportDateKey(transport);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, index - leadingDays + 1);
    const key = toDateKey(date);
    return {
      key,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      count: counts.get(key) ?? 0,
    };
  });
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Хүлээгдэж байна",
  in_transit: "Хүргэж байна",
  delivered: "Бүгд дууссан",
  cancelled: "Тээвэрлээгүй",
};

const STATUS_BADGES: Record<string, string> = {
  pending: "bg-a",
  in_transit: "bg-b",
  delivered: "bg-g",
  cancelled: "bg-r",
};

function buildTransportMonthlySeries(transports: Transport[]) {
  const now = new Date();
  const buckets = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: `${date.getMonth() + 1}-р`,
      total: 0,
      delivered: 0,
    };
  });
  const map = new Map(buckets.map((b) => [b.key, b]));
  for (const transport of transports) {
    const date = new Date(transport.transportDate);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const bucket = map.get(key);
    if (!bucket) continue;
    bucket.total += 1;
    if (transport.status === "delivered") bucket.delivered += 1;
  }
  return buckets;
}

function LogisticsTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; name: string; value: number; color?: string; stroke?: string }[]; label?: string }) {
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

function LogisticsSkeleton() {
  return (
    <div className="department-logistics">
      <DeptTopbar icon="🚛" title="Тээвэрлэлт" />
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

export default function LogisticsPage() {
  const { user } = useAuth();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tableFilter, setTableFilter] = useState("all");
  const [tableSearch, setTableSearch] = useState("");
  const [tablePage, setTablePage] = useState(0);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toDateKey(new Date()));
  const [calendarPopupDate, setCalendarPopupDate] = useState<string | null>(null);
  const [transportDrafts, setTransportDrafts] = useState<Record<string, TransportDraft>>({});
  const [savingTransportId, setSavingTransportId] = useState<string | null>(null);
  const [deletingTransportId, setDeletingTransportId] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState("");
  const [tableError, setTableError] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => monthStart(toDateKey(new Date())));
  const [reportModal, setReportModal] = useState(false);
  const [reportClock, setReportClock] = useState<Date | null>(null);
  const [modal, setModal] = useState(false);
  const [materialName, setMaterialName] = useState("");
  const [materialUnit, setMaterialUnit] = useState("кг");
  const [quantity, setQuantity] = useState("");
  const [destinationSite, setDestinationSite] = useState("");
  const [driverInfo, setDriverInfo] = useState("");
  const [vehicleInfo, setVehicleInfo] = useState("");
  const [transportDate, setTransportDate] = useState(new Date().toISOString().split("T")[0]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [status, setStatus] = useState("pending");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: transportsData, isLoading: transportsLoading, mutate: mutateTransports } = useSWR(
    "/api/transports?limit=200",
    fetcher,
    { refreshInterval: REALTIME_REFRESH_MS, revalidateOnFocus: false, onSuccess: () => setLastUpdated(new Date()) }
  );

  const transports: Transport[] = useMemo(() => transportsData?.data ?? [], [transportsData]);
  const loading = transportsLoading;

  useEscapeClose(Boolean(calendarPopupDate || reportModal || modal), () => {
    if (calendarPopupDate) {
      setCalendarPopupDate(null);
      return;
    }

    if (reportModal) {
      setReportModal(false);
      return;
    }

    if (modal) setModal(false);
  });

  async function submitTransport(event: FormEvent) {
    event.preventDefault();
    const numericQuantity = Number(quantity);
    if (!materialName.trim() || !numericQuantity || numericQuantity <= 0 || !destinationSite || !driverInfo || !vehicleInfo || !transportDate) {
      setError("Материал, хэмжээ, очих газар, жолооч, машин, огноог зөв оруулна уу");
      return;
    }
    setSubmitting(true);
    setError("");
    const response = await fetch("/api/transports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materialName: materialName.trim(), materialUnit, quantity: numericQuantity, destinationSite, driverInfo, vehicleInfo, transportDate, deliveryDate: deliveryDate || null, status, note: note || null }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Алдаа гарлаа");
      setSubmitting(false);
      return;
    }
    setModal(false);
    setSubmitting(false);
    setMaterialName(""); setMaterialUnit("кг"); setQuantity(""); setDestinationSite(""); setDriverInfo(""); setVehicleInfo(""); setDeliveryDate("");
    setStatus("pending"); setNote("");
    await mutateTransports();
  }

  const canEdit = user?.role === "ADMIN" || (user?.role === "MODERATOR" && user.department === "LOGISTICS");

  function updateTableFilter(nextFilter: string) {
    setTableFilter(nextFilter);
    setTablePage(0);
  }

  function updateTableSearch(nextSearch: string) {
    setTableSearch(nextSearch);
    setTablePage(0);
  }

  function openReportModal() {
    setReportClock(new Date());
    setReportModal(true);
  }

  function getTransportDraft(transport: Transport) {
    return transportDrafts[transport.id] ?? {
      driverInfo: transportDriverName(transport),
      vehicleInfo: transport.vehicleInfo ?? "",
    };
  }

  function updateTransportDraft(transport: Transport, field: keyof TransportDraft, value: string) {
    setTransportDrafts((currentDrafts) => {
      const current = currentDrafts[transport.id] ?? {
        driverInfo: transportDriverName(transport),
        vehicleInfo: transport.vehicleInfo ?? "",
      };
      return {
        ...currentDrafts,
        [transport.id]: {
          ...current,
          [field]: value,
        },
      };
    });
  }

  async function saveTransportCrew(transport: Transport) {
    const draft = getTransportDraft(transport);
    const driverInfo = draft.driverInfo.trim();
    const nextVehicleInfo = draft.vehicleInfo.trim();
    if (!driverInfo || !nextVehicleInfo) {
      setCalendarError("Жолооч болон тээврийн хэрэгслийг хоёуланг нь оруулна уу");
      return;
    }

    setSavingTransportId(transport.id);
    setCalendarError("");
    const response = await fetch("/api/transports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: transport.id, driverInfo, vehicleInfo: nextVehicleInfo }),
    });
    const data = await response.json();
    if (!response.ok) {
      setCalendarError(data.error ?? "Хадгалах үед алдаа гарлаа");
      setSavingTransportId(null);
      return;
    }

    setTransportDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[transport.id];
      return nextDrafts;
    });
    setSavingTransportId(null);
    await mutateTransports();
  }

  async function deleteTransport(transport: Transport) {
    if (!canEdit || deletingTransportId) return;
    const confirmed = window.confirm(`${transport.material.name} transport бүртгэл устгах уу?`);
    if (!confirmed) return;

    setDeletingTransportId(transport.id);
    setTableError("");
    const response = await fetch(`/api/transports?id=${encodeURIComponent(transport.id)}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => null) as { error?: string } | null;

    if (!response.ok) {
      setTableError(data?.error ?? "Transport устгахад алдаа гарлаа");
      setDeletingTransportId(null);
      return;
    }

    setTransportDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[transport.id];
      return nextDrafts;
    });
    setDeletingTransportId(null);
    await mutateTransports();
  }

  const activeTrips = useMemo(() => transports.filter((t) => t.status === "in_transit").length, [transports]);
  const pendingTrips = useMemo(() => transports.filter((t) => t.status === "pending").length, [transports]);
  const cancelledTrips = useMemo(() => transports.filter((t) => t.status === "cancelled").length, [transports]);
  const deliveredTrips = useMemo(() => transports.filter((t) => t.status === "delivered").length, [transports]);

  const monthlySeries = useMemo(() => buildTransportMonthlySeries(transports), [transports]);

  const activeSparkline = useMemo(() => monthlySeries.map((m) => m.total), [monthlySeries]);
  const deliveredSparkline = useMemo(() => monthlySeries.map((m) => m.delivered), [monthlySeries]);

  const statusDist = useMemo(() => [
    { name: "Идэвхтэй", value: activeTrips, color: "#3B82F6" },
    { name: "Хүлээгдэж байна", value: pendingTrips, color: "#F59E0B" },
    { name: "Саатал", value: cancelledTrips, color: "#EF4444" },
    { name: "Дууссан", value: deliveredTrips, color: "#10B981" },
  ], [activeTrips, pendingTrips, cancelledTrips, deliveredTrips]);

  const destDist = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transports) map.set(t.destinationSite, (map.get(t.destinationSite) ?? 0) + 1);
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value], i) => ({ name, value, color: DEST_COLORS[i] ?? ACCENT }));
  }, [transports]);

  const materialDist = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transports) map.set(t.material.name, (map.get(t.material.name) ?? 0) + t.quantity);
    const entries = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const total = entries.reduce((acc, [, v]) => acc + v, 0);
    return entries.map(([name, value], i) => ({
      name, value, color: DEST_COLORS[i] ?? ACCENT,
      pct: total > 0 ? Math.round((value / total) * 100) : 0,
    }));
  }, [transports]);

  const monthlyTrend = useMemo(
    () => monthlySeries.map((m) => ({ label: m.label, value: m.total })),
    [monthlySeries]
  );

  const filteredTransports = useMemo(() => {
    let result = transports;
    if (tableFilter === "in_transit") result = result.filter((t) => t.status === "in_transit");
    else if (tableFilter === "pending") result = result.filter((t) => t.status === "pending");
    else if (tableFilter === "cancelled") result = result.filter((t) => t.status === "cancelled");
    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      result = result.filter(
        (t) => t.material.name.toLowerCase().includes(q) || t.destinationSite.toLowerCase().includes(q)
      );
    }
    return result;
  }, [transports, tableFilter, tableSearch]);

  const totalPages = Math.ceil(filteredTransports.length / PAGE_SIZE);
  const paginatedTransports = useMemo(
    () => filteredTransports.slice(tablePage * PAGE_SIZE, (tablePage + 1) * PAGE_SIZE),
    [filteredTransports, tablePage]
  );

  const alerts = useMemo(() => {
    const today = new Date();
    return transports
      .filter((t) => (t.status === "pending" || t.status === "in_transit") && t.deliveryDate && new Date(t.deliveryDate) < today)
      .slice(0, 4)
      .map((t) => ({ msg: `Саатал: ${t.material.name} → ${t.destinationSite}` }));
  }, [transports]);

  const reportNow = useMemo(() => reportClock ?? lastUpdated ?? new Date(), [lastUpdated, reportClock]);
  const reportStart = useMemo(() => {
    const start = new Date(reportNow);
    start.setDate(start.getDate() - (REPORT_DAYS - 1));
    start.setHours(0, 0, 0, 0);
    return start;
  }, [reportNow]);
  const reportNowTime = reportNow.getTime();
  const reportStartTime = reportStart.getTime();
  const reportTransports = useMemo(
    () => transports.filter((transport) => {
      const time = new Date(transport.transportDate).getTime();
      return time >= reportStartTime && time <= reportNowTime;
    }),
    [reportNowTime, reportStartTime, transports]
  );
  const reportDelivered = reportTransports.filter((transport) => transport.status === "delivered").length;
  const reportInTransit = reportTransports.filter((transport) => transport.status === "in_transit").length;
  const reportPending = reportTransports.filter((transport) => transport.status === "pending").length;
  const reportCancelled = reportTransports.filter((transport) => transport.status === "cancelled").length;
  const reportDeliveredPct = reportTransports.length > 0 ? Math.round((reportDelivered / reportTransports.length) * 100) : 0;
  const reportDelayed = reportTransports.filter((transport) => (
    (transport.status === "pending" || transport.status === "in_transit") &&
    transport.deliveryDate &&
    new Date(transport.deliveryDate) < reportNow
  )).length;
  const reportQuantitySummary = useMemo(() => {
    const byUnit = new Map<string, number>();
    for (const transport of reportTransports) {
      byUnit.set(transport.material.unit, (byUnit.get(transport.material.unit) ?? 0) + transport.quantity);
    }
    return [...byUnit.entries()]
      .map(([unit, total]) => `${total.toLocaleString("mn-MN")} ${unit}`)
      .join(" · ") || "0";
  }, [reportTransports]);
  const reportDestinationRows = useMemo(() => {
    const map = new Map<string, number>();
    for (const transport of reportTransports) map.set(transport.destinationSite, (map.get(transport.destinationSite) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [reportTransports]);
  const reportMaterialRows = useMemo(() => {
    const map = new Map<string, { quantity: number; count: number; unit: string }>();
    for (const transport of reportTransports) {
      const current = map.get(transport.material.name) ?? { quantity: 0, count: 0, unit: transport.material.unit };
      current.quantity += transport.quantity;
      current.count += 1;
      map.set(transport.material.name, current);
    }
    return [...map.entries()].sort((a, b) => b[1].quantity - a[1].quantity).slice(0, 10);
  }, [reportTransports]);
  const reportLatestTransports = useMemo(
    () => [...reportTransports].sort((a, b) => new Date(b.transportDate).getTime() - new Date(a.transportDate).getTime()).slice(0, 20),
    [reportTransports]
  );
  const reportTopDestination = reportDestinationRows[0] ?? null;
  const reportHealth = reportDelayed > 0
    ? { label: "Анхаарах", color: "#EF4444" }
    : reportInTransit > 0 || reportPending > 0
      ? { label: "Идэвхтэй", color: "#F59E0B" }
      : { label: "Тогтвортой", color: "#10B981" };

  const todayKey = toDateKey(new Date());
  const calendarCells = useMemo(() => buildCalendarCells(calendarMonth, transports), [calendarMonth, transports]);
  const calendarMonthLabel = useMemo(
    () => calendarMonth.toLocaleDateString("mn-MN", { year: "numeric", month: "long" }),
    [calendarMonth]
  );
  const selectedDayTransports = useMemo(
    () => transports
      .filter((transport) => transportDateKey(transport) === selectedCalendarDate)
      .sort((a, b) => {
        const statusOrder: Record<string, number> = { in_transit: 0, pending: 1, delivered: 2, cancelled: 3 };
        return (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
      }),
    [transports, selectedCalendarDate]
  );
  const selectedDayQuantitySummary = useMemo(
    () => {
      const byUnit = new Map<string, number>();
      for (const transport of selectedDayTransports) {
        byUnit.set(transport.material.unit, (byUnit.get(transport.material.unit) ?? 0) + transport.quantity);
      }
      return [...byUnit.entries()]
        .map(([unit, total]) => `${total.toLocaleString("mn-MN")} ${unit}`)
        .join(" · ");
    },
    [selectedDayTransports]
  );

  function selectCalendarDate(dateKey: string) {
    setSelectedCalendarDate(dateKey);
    setCalendarMonth(monthStart(dateKey));
    setCalendarError("");
    setCalendarPopupDate(dateKey);
  }

  function changeCalendarMonth(offset: number) {
    const nextMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1);
    setCalendarMonth(nextMonth);
    setSelectedCalendarDate(toDateKey(nextMonth));
    setCalendarPopupDate(null);
  }

  function jumpToToday() {
    setSelectedCalendarDate(todayKey);
    setCalendarMonth(monthStart(todayKey));
    setCalendarPopupDate(null);
  }

  if (loading) return <LogisticsSkeleton />;

  return (
    <div className="department-logistics">
      <DeptTopbar icon="🚛" title="Тээвэрлэлт" />

      <div className="content">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Тээвэрлэлт · Логистик
            </div>
            <h2 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 800 }}>Transport Dashboard</h2>
          </div>
          <RealtimeBadge lastUpdated={lastUpdated} />
        </div>

        {/* Logistics Status Banner */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          {alerts.length > 0 && (
            <div style={{ flex: "1 1 220px", padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(239,68,68,0.28)", background: "rgba(239,68,68,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 16 }}>🔴</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#EF4444" }}>СААТСАН ТЭЭВЭР: {alerts.length} ачилт</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Хүргэлт хугацаа хэтэрсэн байна</div>
                </div>
              </div>
              <button type="button" onClick={() => updateTableFilter("cancelled")} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(239,68,68,0.5)", background: "rgba(239,68,68,0.12)", color: "#EF4444", fontSize: 10, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>Шалгах</button>
            </div>
          )}
          {activeTrips > 0 && (
            <div style={{ flex: "1 1 200px", padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(59,130,246,0.25)", background: "rgba(59,130,246,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 16 }}>🔵</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#3B82F6" }}>ИДЭВХТЭЙ: {activeTrips} тээвэр явж байна</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Бодит цагийн хяналт</div>
              </div>
            </div>
          )}
          <div style={{ flex: "0 0 auto", padding: "12px 16px", borderRadius: 12, border: `1px solid ${alerts.length === 0 ? "rgba(16,185,129,0.22)" : "rgba(100,116,139,0.2)"}`, background: alerts.length === 0 ? "rgba(16,185,129,0.05)" : "rgba(100,116,139,0.04)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>{alerts.length === 0 ? "🟢" : "⚪"}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: alerts.length === 0 ? "#10B981" : "var(--muted)" }}>СИСТЕМИЙН ТӨЛӨВ: {alerts.length === 0 ? "ТОГТВОРТОЙ" : "АНХААРУУЛГА"}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{alerts.length === 0 ? "Бүх тээвэр хэвийн явж байна" : `${alerts.length} ачилт саатсан байна`}</div>
            </div>
          </div>
        </div>

        <div className="kpi-grid" style={{ marginBottom: 14 }}>
          <KpiCard label="Идэвхтэй тээвэр" value={activeTrips} valueStyle={{ color: ACCENT }}
            change="Уурхай руу явж байна" icon="🚚" sparkline={activeSparkline} sparklineColor={ACCENT} />
          <KpiCard label="Хүлээгдэж байна" value={pendingTrips} valueStyle={{ color: "#F59E0B" }}
            change="Тээвэрт бэлдэж байна" icon="🕒" sparkline={activeSparkline} sparklineColor="#F59E0B" />
          <KpiCard label="Саатал" value={cancelledTrips} valueStyle={{ color: "#EF4444" }}
            change="Тээвэрлэж чадаагүй" icon="⚠️" sparkline={activeSparkline} sparklineColor="#EF4444" />
          <KpiCard label="Бүгд дууссан" value={deliveredTrips} valueStyle={{ color: "#10B981" }}
            change="Хүргэлт дууссан" icon="✅" sparkline={deliveredSparkline} sparklineColor="#10B981" />
        </div>

        <div className="wh-main-grid">
          <div className="panel" style={{ overflow: "hidden" }}>
            <div className="panel-hdr">
              <div>
                <div className="panel-title">Тээврийн бодит цагийн зураглал</div>
                <div className="panel-sub">Идэвхтэй маршрут, байршил</div>
              </div>
            </div>
            <div style={{ height: 260 }}>
              <TransportMap />
            </div>
          </div>

          <div className="panel">
            <div className="panel-hdr">
              <div>
                <div className="panel-title">Сарын тээврийн чиг хандлага</div>
                <div className="panel-sub">Нийт болон хүргэгдсэн тээвэр</div>
              </div>
            </div>
            <div style={{ padding: "0 20px 20px" }}>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={monthlySeries}>
                  <defs>
                    <linearGradient id="lgBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 10 }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                  <Tooltip content={<LogisticsTooltip />} />
                  <Bar dataKey="total" name="Нийт" fill="url(#lgBarGrad)" radius={[5, 5, 0, 0]} barSize={14} isAnimationActive={false} />
                  <Line type="monotone" dataKey="delivered" name="Хүргэгдсэн" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3, fill: "#10B981" }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <ChartHint>Нийт тээвэр баганаар, хүргэгдсэн тээвэр ногоон шугамаар харагдана. Мэдээлэл 5 секунд тутам шинэчлэгдэнэ.</ChartHint>
          </div>
        </div>

        <div className="wh-chart-row">
          <div className="panel">
            <div className="panel-hdr"><div className="panel-title">Төлөвийн тархалт</div></div>
            <div style={{ padding: "0 16px 16px" }}>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={statusDist} dataKey="value" innerRadius={34} outerRadius={54} paddingAngle={3} isAnimationActive={false}>
                    {statusDist.map((item) => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                  <Tooltip content={<LogisticsTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "grid", gap: 5, marginTop: 4 }}>
                {statusDist.map((item) => (
                  <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{item.name}</span>
                    <strong style={{ color: "var(--text)" }}>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-hdr"><div className="panel-title">Очих газрын тархалт</div></div>
            <div style={{ padding: "0 12px 16px" }}>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={destDist} layout="vertical" barSize={12} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 9 }} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 9 }} width={80} />
                  <Tooltip content={<LogisticsTooltip />} />
                  <Bar dataKey="value" name="Тоо" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    <LabelList dataKey="value" position="right" fill="var(--text)" fontSize={10} />
                    {destDist.map((item) => <Cell key={item.name} fill={item.color} />)}
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
                    <linearGradient id="lgTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 9 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 9 }} />
                  <Tooltip content={<LogisticsTooltip />} />
                  <Area type="monotone" dataKey="value" name="Нийт" stroke="#3B82F6" strokeWidth={2} fill="url(#lgTrend)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="wh-bottom-grid">
          <div className="panel">
            <div className="panel-hdr">
              <div>
                <div className="panel-title">Transport бүртгэл</div>
                <div className="panel-sub">Материал, хэмжээ, очих газар, статус, шалтгааныг DB-с уншина</div>
              </div>
              {canEdit ? (
                <button className="add-btn" type="button" onClick={() => setModal(true)}>+ Transport нэмэх</button>
              ) : null}
            </div>

            <div style={{ padding: "10px 20px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {[
                { key: "all", label: "Бүгд", color: "#6b7280" },
                { key: "in_transit", label: "Идэвхтэй", color: "#3B82F6" },
                { key: "pending", label: "Хүлээгдэж байна", color: "#F59E0B" },
                { key: "cancelled", label: "Саатал", color: "#EF4444" },
              ].map((chip) => (
                <button key={chip.key} type="button" onClick={() => updateTableFilter(chip.key)}
                  style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600, border: `1.5px solid ${tableFilter === chip.key ? chip.color : "var(--border)"}`, background: tableFilter === chip.key ? `${chip.color}22` : "transparent", color: tableFilter === chip.key ? chip.color : "var(--muted)", cursor: "pointer" }}>
                  {chip.label}
                </button>
              ))}
              <input value={tableSearch} onChange={(e) => updateTableSearch(e.target.value)} placeholder="Хайх..."
                style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 999, fontSize: 11, border: "1.5px solid var(--border)", background: "transparent", color: "var(--text)", outline: "none", width: 140 }} />
            </div>

            {tableError ? (
              <div style={{ margin: "0 20px 10px", color: "#f87171", fontSize: 12, fontWeight: 700 }}>
                {tableError}
              </div>
            ) : null}

            <div style={{ borderTop: "1px solid var(--border)" }}>
              <table className="safety-table">
                <thead>
                  <tr>
                    <th>Огноо</th>
                    <th>Материал</th>
                    <th>Хэмжээ</th>
                    <th>Очих газар</th>
                    <th>Статус</th>
                    <th>Хүргэх огноо</th>
                    <th>Бүртгэсэн</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransports.length === 0 ? (
                    <tr className="empty-row">
                      <td colSpan={8} style={{ padding: "32px 16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 32 }}>🚛</span>
                          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14 }}>Тээвэрлэлтийн бүртгэл байхгүй</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>Одоогоор тээвэрлэлтийн бүртгэл алга</div>
                          {canEdit && <button type="button" onClick={() => setModal(true)} style={{ marginTop: 4, padding: "6px 18px", borderRadius: 8, border: "1px solid #3B82F6", background: "rgba(59,130,246,0.1)", color: "#3B82F6", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Transport нэмэх</button>}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedTransports.map((transport) => {
                      const isDelayed = (transport.status === "pending" || transport.status === "in_transit") && transport.deliveryDate && new Date(transport.deliveryDate) < new Date();
                      const isActive = transport.status === "in_transit";
                      return (
                        <tr key={transport.id} className="wh-tr-hover">
                          <td>{transport.transportDate.slice(0, 10)}</td>
                          <td>
                            <strong style={{ color: "var(--text)" }}>{transport.material.name}</strong>
                            <div style={{ color: "var(--muted)", fontSize: 11 }}>{transport.note ?? ""}</div>
                          </td>
                          <td>{transport.quantity.toLocaleString("mn-MN")} {transport.material.unit}</td>
                          <td>{transport.destinationSite}</td>
                          <td>
                            <span className={`bg ${STATUS_BADGES[transport.status] ?? "bg-gr"}`}>
                              {STATUS_LABELS[transport.status] ?? transport.status}
                            </span>
                          </td>
                          <td style={{ color: isDelayed ? "#EF4444" : undefined }}>{transport.deliveryDate ? transport.deliveryDate.slice(0, 10) : "—"}{isDelayed ? " ⚠" : ""}</td>
                          <td>{transportDriverName(transport)}</td>
                          <td>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <button type="button" style={{
                                padding: "4px 10px", borderRadius: 7, whiteSpace: "nowrap", fontSize: 10, fontWeight: 700, cursor: "pointer",
                                border: `1px solid ${isDelayed ? "rgba(239,68,68,0.4)" : isActive ? "rgba(59,130,246,0.3)" : "var(--border)"}`,
                                background: isDelayed ? "rgba(239,68,68,0.08)" : isActive ? "rgba(59,130,246,0.08)" : "transparent",
                                color: isDelayed ? "#EF4444" : isActive ? "#3B82F6" : "var(--muted)",
                              }}>
                                {isDelayed ? "Яаралтай" : isActive ? "Хянах" : "Дэлгэрэнгүй"}
                              </button>
                              {canEdit ? (
                                <button
                                  type="button"
                                  onClick={() => void deleteTransport(transport)}
                                  disabled={deletingTransportId === transport.id}
                                  style={{
                                    padding: "4px 10px",
                                    borderRadius: 7,
                                    border: "1px solid rgba(239,68,68,0.42)",
                                    background: "rgba(239,68,68,0.1)",
                                    color: "#f87171",
                                    fontSize: 10,
                                    fontWeight: 800,
                                    cursor: deletingTransportId === transport.id ? "wait" : "pointer",
                                    whiteSpace: "nowrap",
                                    opacity: deletingTransportId === transport.id ? 0.65 : 1,
                                  }}
                                >
                                  {deletingTransportId === transport.id ? "Устгаж..." : "Устгах"}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="pg">
                <span className="pgi">{filteredTransports.length} бүртгэл · {tablePage * PAGE_SIZE + 1}–{Math.min((tablePage + 1) * PAGE_SIZE, filteredTransports.length)}</span>
                <button className="pgb" onClick={() => setTablePage(p => Math.max(0, p - 1))} disabled={tablePage === 0}>‹</button>
                <span style={{ fontSize: 11, color: "var(--muted)", padding: "0 4px" }}>{tablePage + 1}/{totalPages}</span>
                <button className="pgb" onClick={() => setTablePage(p => Math.min(totalPages - 1, p + 1))} disabled={tablePage === totalPages - 1}>›</button>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
            <div className="panel">
              <div className="panel-hdr">
                <div>
                  <div className="panel-title">Тээврийн календарь</div>
                  <div className="panel-sub">{formatMnDate(selectedCalendarDate)}</div>
                </div>
                <button type="button" onClick={jumpToToday} style={{ padding: "6px 10px", borderRadius: 9, border: "1px solid rgba(59,130,246,0.35)", background: selectedCalendarDate === todayKey ? "rgba(59,130,246,0.18)" : "transparent", color: selectedCalendarDate === todayKey ? "#60A5FA" : "var(--muted)", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>
                  Өнөөдөр
                </button>
              </div>
              <div style={{ padding: "14px 20px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                  <button type="button" aria-label="Өмнөх сар" onClick={() => changeCalendarMonth(-1)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>
                    ‹
                  </button>
                  <strong style={{ color: "var(--text)", fontSize: 13, textTransform: "capitalize" }}>{calendarMonthLabel}</strong>
                  <button type="button" aria-label="Дараагийн сар" onClick={() => changeCalendarMonth(1)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>
                    ›
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 5, marginBottom: 6 }}>
                  {WEEK_DAYS.map((day) => (
                    <div key={day} style={{ color: "var(--muted)", fontSize: 10, fontWeight: 800, textAlign: "center" }}>{day}</div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 5 }}>
                  {calendarCells.map((cell) => {
                    const isSelected = cell.key === selectedCalendarDate;
                    const isToday = cell.key === todayKey;
                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => selectCalendarDate(cell.key)}
                        aria-pressed={isSelected}
                        style={{
                          minHeight: 42,
                          borderRadius: 8,
                          border: `1px solid ${isSelected ? "#3B82F6" : isToday ? "rgba(16,185,129,0.55)" : "var(--border)"}`,
                          background: isSelected ? "rgba(59,130,246,0.2)" : cell.count > 0 ? "rgba(59,130,246,0.08)" : "transparent",
                          color: cell.isCurrentMonth ? "var(--text)" : "var(--muted)",
                          opacity: cell.isCurrentMonth ? 1 : 0.45,
                          cursor: "pointer",
                          display: "grid",
                          alignContent: "center",
                          justifyItems: "center",
                          gap: 3,
                          fontWeight: isSelected || isToday ? 900 : 700,
                        }}
                      >
                        <span style={{ fontSize: 12, lineHeight: 1 }}>{cell.day}</span>
                        {cell.count > 0 ? (
                          <span style={{ minWidth: 16, height: 14, padding: "0 4px", borderRadius: 999, background: isSelected ? "#3B82F6" : "rgba(59,130,246,0.28)", color: "#fff", fontSize: 9, lineHeight: "14px" }}>
                            {cell.count}
                          </span>
                        ) : (
                          <span style={{ width: 4, height: 4 }} />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 11, lineHeight: 1.5 }}>
                  {formatMnDate(selectedCalendarDate)} · {selectedDayTransports.length} рейс · {selectedDayQuantitySummary || "ачаагүй"}
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-hdr"><div className="panel-title">Материалын хуваарилалт</div></div>
              <div style={{ padding: "4px 20px 16px", display: "grid", gap: 10 }}>
                {materialDist.length === 0 ? (
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>Өгөгдөл байхгүй</div>
                ) : (
                  materialDist.map((item) => (
                    <div key={item.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: item.color, display: "inline-block" }} />
                          <span style={{ color: "var(--muted)" }}>{item.name}</span>
                        </div>
                        <strong style={{ color: "var(--text)" }}>{item.pct}%</strong>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: "var(--border)" }}>
                        <div style={{ height: "100%", borderRadius: 2, background: item.color, width: `${item.pct}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-hdr"><div className="panel-title">Үйлдэл</div></div>
              <div style={{ padding: "4px 20px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { icon: "🚛", label: "Transport нэмэх" },
                  { icon: "📋", label: "Тайлан гаргах", onClick: openReportModal },
                  { icon: "🗺️", label: "Маршрут харах" },
                  { icon: "🔄", label: "Шинэчлэх", onClick: () => { void mutateTransports(); } },
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
                    <div key={idx} style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", fontSize: 12, color: "var(--text)", lineHeight: 1.4 }}>
                      <span style={{ color: "#3B82F6", marginRight: 5 }}>⚠</span>
                      {alert.msg}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {reportModal ? (
        <div
          className="mo open"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logistics-report-title"
          onClick={(event) => event.target === event.currentTarget && setReportModal(false)}
        >
          <div className="mc report-print-root" style={{ maxWidth: 1080, width: "100%", padding: 0 }} onClick={(event) => event.stopPropagation()}>
            <div className="mh" style={{ marginBottom: 0, padding: "22px 24px 0", flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: ACCENT, boxShadow: "0 0 0 4px rgba(59,130,246,0.12)" }} />
                  <span style={{ color: ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: 0 }}>
                    14 хоногийн тайлан шинэчлэгдэж байна
                  </span>
                </div>
                <h3 id="logistics-report-title" style={{ marginBottom: 6 }}>Тээвэрлэлтийн 14 хоногийн тайлан</h3>
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
                    void mutateTransports();
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
                  { label: "Нийт тээвэр", value: `${reportTransports.length}`, sub: "Энэ хугацаанд", color: ACCENT },
                  { label: "Нийт ачаа", value: reportQuantitySummary, sub: `${reportMaterialRows.length} материал`, color: "#10B981" },
                  { label: "Хүргэлт дууссан", value: `${reportDelivered}`, sub: `${reportDeliveredPct}% дууссан`, color: "#10B981" },
                  { label: "Идэвхтэй/хүлээгдэж", value: `${reportInTransit + reportPending}`, sub: `Явж буй ${reportInTransit} | Хүлээгдэж ${reportPending}`, color: "#F59E0B" },
                  { label: "Төлөв", value: reportHealth.label, sub: `Саатал ${reportDelayed} | Цуцлагдсан ${reportCancelled}`, color: reportHealth.color },
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
                    { label: "Хүргэлтийн хувь", value: `${reportDeliveredPct}%`, sub: `${reportDelivered}/${reportTransports.length} тээвэр дууссан` },
                    { label: "Топ чиглэл", value: reportTopDestination ? reportTopDestination[0] : "Байхгүй", sub: reportTopDestination ? `${reportTopDestination[1]} рейс` : "Тээвэр бүртгэгдээгүй" },
                    { label: "Материалын төрөл", value: `${reportMaterialRows.length}`, sub: "Тээвэрлэгдсэн материал" },
                    { label: "Анхаарах тээвэр", value: `${reportDelayed}`, sub: reportDelayed > 0 ? "Хугацаа хэтэрсэн" : "Идэвхтэй саатал байхгүй" },
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
                  <div className="panel-title" style={{ marginBottom: 12 }}>Чиглэлийн задаргаа</div>
                  <div style={{ maxHeight: 280, overflow: "auto" }}>
                    <table className="safety-table wh-table">
                      <thead>
                        <tr>
                          <th>Очих газар</th>
                          <th>Рейс</th>
                          <th>Хувь</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportDestinationRows.length === 0 ? (
                          <tr><td colSpan={3} style={{ padding: 18, color: "var(--muted)", textAlign: "center" }}>Чиглэлийн мэдээлэл байхгүй</td></tr>
                        ) : reportDestinationRows.map(([destination, count]) => {
                          const share = reportTransports.length > 0 ? Math.round((count / reportTransports.length) * 100) : 0;
                          return (
                            <tr key={destination}>
                              <td><strong>{destination}</strong></td>
                              <td style={{ color: ACCENT, fontWeight: 800 }}>{count}</td>
                              <td>{share}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="panel" style={{ padding: 18, margin: 0 }}>
                  <div className="panel-title" style={{ marginBottom: 12 }}>Материалын задаргаа</div>
                  <div style={{ maxHeight: 280, overflow: "auto" }}>
                    <table className="safety-table wh-table">
                      <thead>
                        <tr>
                          <th>Материал</th>
                          <th>Хэмжээ</th>
                          <th>Рейс</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportMaterialRows.length === 0 ? (
                          <tr><td colSpan={3} style={{ padding: 18, color: "var(--muted)", textAlign: "center" }}>Материалын мэдээлэл байхгүй</td></tr>
                        ) : reportMaterialRows.map(([material, row]) => (
                          <tr key={material}>
                            <td><strong>{material}</strong></td>
                            <td style={{ color: "#10B981", fontWeight: 800 }}>{row.quantity.toLocaleString("mn-MN")} {row.unit}</td>
                            <td>{row.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="panel" style={{ padding: 18, margin: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                  <div>
                    <div className="panel-title">14 хоногийн тээврийн бүртгэл</div>
                    <div className="panel-sub" style={{ marginTop: 4 }}>Сүүлийн 20 тээврийг огноогоор бууруулж харуулна.</div>
                  </div>
                  <span style={{ color: "var(--muted)", fontSize: 11 }}>{reportTransports.length} нийт тээвэр</span>
                </div>
                <div style={{ maxHeight: 340, overflow: "auto" }}>
                  <table className="safety-table wh-table">
                    <thead>
                      <tr>
                        <th>Огноо</th>
                        <th>Материал</th>
                        <th>Хэмжээ</th>
                        <th>Очих газар</th>
                        <th>Статус</th>
                        <th>Жолооч</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportLatestTransports.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: 18, color: "var(--muted)", textAlign: "center" }}>Энэ хугацаанд тээвэр бүртгэгдээгүй байна</td></tr>
                      ) : reportLatestTransports.map((transport) => (
                        <tr key={transport.id}>
                          <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 11 }}>{transport.transportDate.slice(0, 10)}</td>
                          <td><strong>{transport.material.name}</strong></td>
                          <td style={{ color: ACCENT, fontWeight: 800 }}>{transport.quantity.toLocaleString("mn-MN")} {transport.material.unit}</td>
                          <td>{transport.destinationSite}</td>
                          <td><span className={`bg ${STATUS_BADGES[transport.status] ?? "bg-gr"}`}>{STATUS_LABELS[transport.status] ?? transport.status}</span></td>
                          <td style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{transportDriverName(transport)}</td>
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

      {calendarPopupDate ? (
        <div className="mo open" onClick={(event) => event.target === event.currentTarget && setCalendarPopupDate(null)}>
          <div className="mc" style={{ width: "min(720px, calc(100vw - 32px))", maxHeight: "calc(100vh - 40px)", overflowY: "auto" }}>
            <div className="mh">
              <div>
                <h3 style={{ marginBottom: 4 }}>{formatMnDate(calendarPopupDate)}</h3>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>
                  {selectedDayTransports.length} рейс · {selectedDayQuantitySummary || "ачаагүй"}
                </div>
              </div>
              <button className="mx" type="button" onClick={() => setCalendarPopupDate(null)}>×</button>
            </div>

            {calendarError ? (
              <div style={{ color: "#f87171", fontSize: 12, marginBottom: 10 }}>{calendarError}</div>
            ) : null}

            <div style={{ display: "grid", gap: 10 }}>
              {selectedDayTransports.length === 0 ? (
                <div style={{ padding: "24px 16px", borderRadius: 12, border: "1px dashed var(--border)", color: "var(--muted)", textAlign: "center", fontSize: 13 }}>
                  Энэ өдөр тээвэр бүртгэгдээгүй
                </div>
              ) : (
                selectedDayTransports.map((transport) => {
                  const draft = getTransportDraft(transport);
                  const driverName = draft.driverInfo.trim() || transportDriverName(transport);
                  const nextVehicleInfo = draft.vehicleInfo.trim() || transport.vehicleInfo || "Машин бүртгээгүй";
                  const canSave = canEdit && savingTransportId !== transport.id;
                  return (
                    <div key={transport.id} style={{ borderRadius: 12, border: "1px solid rgba(59,130,246,0.24)", background: "rgba(59,130,246,0.07)", padding: "14px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: "var(--text)", fontSize: 15, fontWeight: 900, lineHeight: 1.35 }}>
                            {driverName} {nextVehicleInfo}-тай {transport.destinationSite} руу явсан
                          </div>
                          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                            {transport.material.name} · {transport.quantity.toLocaleString("mn-MN")} {transport.material.unit}
                          </div>
                        </div>
                        <span className={`bg ${STATUS_BADGES[transport.status] ?? "bg-gr"}`} style={{ flexShrink: 0 }}>
                          {STATUS_LABELS[transport.status] ?? transport.status}
                        </span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                        <div className="fg" style={{ margin: 0 }}>
                          <label>Жолооч</label>
                          <input
                            value={draft.driverInfo}
                            disabled={!canEdit}
                            onChange={(event) => updateTransportDraft(transport, "driverInfo", event.target.value)}
                            placeholder="Жолоочийн нэр"
                          />
                        </div>
                        <div className="fg" style={{ margin: 0 }}>
                          <label>Тээврийн хэрэгсэл</label>
                          <input
                            value={draft.vehicleInfo}
                            disabled={!canEdit}
                            onChange={(event) => updateTransportDraft(transport, "vehicleInfo", event.target.value)}
                            placeholder="Жишээ: 1234 УНХ · Howo"
                          />
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 8 }}>
                        {[
                          ["Очих газар", transport.destinationSite],
                          ["Ачаа", `${transport.material.name} · ${transport.quantity.toLocaleString("mn-MN")} ${transport.material.unit}`],
                          ["Гарах өдөр", transport.transportDate.slice(0, 10)],
                          ["Хүргэх өдөр", transport.deliveryDate ? transport.deliveryDate.slice(0, 10) : "—"],
                        ].map(([label, value]) => (
                          <div key={label} style={{ borderRadius: 10, border: "1px solid var(--border)", background: "rgba(255,255,255,0.03)", padding: "10px 12px", minWidth: 0 }}>
                            <div style={{ color: "var(--muted)", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                            <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 800, overflowWrap: "anywhere" }}>{value}</div>
                          </div>
                        ))}
                      </div>

                      {transport.note ? (
                        <div style={{ marginTop: 10, borderRadius: 10, border: "1px solid var(--border)", background: "rgba(255,255,255,0.03)", padding: "10px 12px" }}>
                          <div style={{ color: "var(--muted)", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Тайлбар</div>
                          <div style={{ color: "var(--text)", fontSize: 12, lineHeight: 1.5 }}>{transport.note}</div>
                        </div>
                      ) : null}

                      {canEdit ? (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                          <button
                            type="button"
                            className="btn bp"
                            disabled={!canSave}
                            onClick={() => void saveTransportCrew(transport)}
                            style={{ minWidth: 120 }}
                          >
                            {savingTransportId === transport.id ? "Хадгалж байна..." : "Хадгалах"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}

      {modal ? (
        <div className="mo open" onClick={(event) => event.target === event.currentTarget && setModal(false)}>
          <div className="mc" style={{ width: "min(1040px, calc(100vw - 40px))", maxHeight: "calc(100vh - 40px)", overflowY: "visible" }}>
            <div className="mh">
              <h3>Transport нэмэх</h3>
              <button className="mx" type="button" onClick={() => setModal(false)}>×</button>
            </div>
            <form onSubmit={submitTransport}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                <div className="fg">
                  <label>Материалын нэр</label>
                  <input value={materialName} onChange={(event) => setMaterialName(event.target.value)} placeholder="Жишээ: ANFO / Эмульс" />
                </div>
                <div className="fg">
                  <label>Хэмжээ</label>
                  <input type="number" min="0" step="0.1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                </div>
                <div className="fg">
                  <label>Нэгж</label>
                  <select value={materialUnit} onChange={(event) => setMaterialUnit(event.target.value)}>
                    <option value="кг">кг</option>
                    <option value="тн">тн</option>
                    <option value="л">л</option>
                    <option value="ш">ш</option>
                  </select>
                </div>
                <div className="fg">
                  <label>Очих газар</label>
                  <input value={destinationSite} onChange={(event) => setDestinationSite(event.target.value)} placeholder="Уурхай / талбай" />
                </div>
                <div className="fg">
                  <label>Жолоочийн нэр</label>
                  <input value={driverInfo} onChange={(event) => setDriverInfo(event.target.value)} placeholder="Жишээ: Бат-Эрдэнэ" />
                </div>
                <div className="fg">
                  <label>Машин / улсын дугаар</label>
                  <input value={vehicleInfo} onChange={(event) => setVehicleInfo(event.target.value)} placeholder="Жишээ: 1234 УНХ · Howo" />
                </div>
                <div className="fg">
                  <label>Гарах өдөр</label>
                  <input type="date" value={transportDate} onChange={(event) => setTransportDate(event.target.value)} />
                </div>
                <div className="fg">
                  <label>Хүргэх өдөр</label>
                  <input type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} />
                </div>
                <div className="fg">
                  <label>Статус</label>
                  <select value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="pending">Хүлээгдэж байна</option>
                    <option value="in_transit">Хүргэж байна</option>
                    <option value="delivered">Бүгд дууссан</option>
                    <option value="cancelled">Тээвэрлээгүй</option>
                  </select>
                </div>
              </div>
              <div className="fg" style={{ marginTop: 2 }}>
                <label>Тайлбар / шалтгаан</label>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Саатал, техникийн гэмтэл, үйлдвэрлэж амжаагүй гэх мэт"
                  style={{ minHeight: 62, height: 62, resize: "none", overflow: "hidden" }}
                />
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
