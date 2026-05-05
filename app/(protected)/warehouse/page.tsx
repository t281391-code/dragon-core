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
  Legend,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
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

type Material = {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  location: string;
};

type MaterialTransaction = {
  id: string;
  type: "IN" | "OUT";
  quantity: number;
  note: string | null;
  transactionDate: string;
  material: { id: string; name: string; unit: string };
  createdBy: { fullName: string };
};

type MonthlyStat = { key: string; label: string; inbound: number; outbound: number };

const WAREHOUSE_PRIORITY = [
  "АМИАКИЙН ШҮҮ",
  "ЦУУНЫ ХҮЧИЛ",
  "ХҮХРИЙН ХҮЧИЛ",
  "ШИЛЭН БӨМБӨЛӨГ",
  "ТҮЛШ",
  "НИТРИТ НАТРИ",
  "ЭМУЛЬГАТОР",
  "ХАТУУРУУЛАГЧ",
  "ГИДРОКСИД",
  "ЦАГААН ТОС",
];

const FLOW_LEGEND = [["#10B981", "Орлого (КГ)"], ["#EF4444", "Зарлага (КГ)"]] as const;
const REPORT_DAYS = 14;

const fetcher = (url: string) => fetch(url).then(r => r.json());

function formatValue(value: number, unit?: string) {
  return `${value.toLocaleString("mn-MN")} ${unit ?? ""}`.trim();
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

function formatSignedValue(value: number, unit?: string) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatValue(value, unit)}`;
}

function stockTone(material: Material) {
  if (material.currentStock < material.minimumStock * 0.5)
    return { label: "Критик", className: "crit", color: "#EF4444" };
  if (material.currentStock < material.minimumStock)
    return { label: "Бага", className: "low", color: "#F59E0B" };
  return { label: "Хэвийн", className: "ok", color: "#10B981" };
}

function buildFlowSeries(transactions: MaterialTransaction[]) {
  const now = new Date();
  const buckets = Array.from({ length: 10 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (9 - index));
    return {
      key: date.toISOString().slice(0, 10),
      day: `${date.getMonth() + 1}/${date.getDate()}`,
      inbound: 0,
      outbound: 0,
    };
  });
  const map = new Map(buckets.map((b) => [b.key, b]));
  for (const t of transactions) {
    const b = map.get(t.transactionDate.slice(0, 10));
    if (!b) continue;
    if (t.type === "IN") b.inbound += t.quantity;
    else b.outbound += t.quantity;
  }
  return buckets;
}

function monthKeyFromTransactionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addTransactionToStats(current: { data: MonthlyStat[] } | undefined, txn: MaterialTransaction) {
  if (!current) return current;
  const key = monthKeyFromTransactionDate(txn.transactionDate);
  if (!key) return current;

  let changed = false;
  const data = current.data.map((row) => {
    if (row.key !== key) return row;
    changed = true;
    return txn.type === "IN"
      ? { ...row, inbound: row.inbound + txn.quantity }
      : { ...row, outbound: row.outbound + txn.quantity };
  });

  return changed ? { ...current, data } : current;
}

// Accepts pre-filtered transactions for the specific material (O(1) lookup via Map)
function computeDaysRemaining(material: Material, matTxns: MaterialTransaction[]): number | null {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const outbound7 = matTxns
    .filter(t => t.type === "OUT" && new Date(t.transactionDate) >= cutoff)
    .reduce((sum, t) => sum + t.quantity, 0);
  const dailyRate = outbound7 / 7;
  if (dailyRate <= 0) return null;
  return Math.floor(material.currentStock / dailyRate);
}

type FlowTooltipPayload = {
  dataKey: string;
  color?: string;
  name: string;
  value: number;
};

function FlowTooltip({ active, payload, label }: { active?: boolean; payload?: FlowTooltipPayload[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--panel, #fff)",
      border: "1px solid var(--border, #e2e8f0)",
      borderRadius: 10,
      padding: "10px 14px",
      fontSize: 12,
      boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--text)" }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{p.value.toLocaleString("mn-MN")} КГ</strong>
        </div>
      ))}
    </div>
  );
}

function FunnelBar({ pct, value, color }: { name: string; pct: number; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{ width: 44, textAlign: "right", fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>
        {pct}%
      </div>
      <div style={{ flex: 1, position: "relative" }}>
        <div style={{ height: 28, borderRadius: 4, background: "var(--base3, #f1f5f9)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, opacity: 0.88 }} />
        </div>
        <div style={{
          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
          fontSize: 11, fontWeight: 700, color: "var(--text)",
        }}>
          {value.toLocaleString("mn-MN")}
        </div>
      </div>
    </div>
  );
}

function SystemStatusBanner({ materials, txnsByMaterial, onOrder }: {
  materials: Material[];
  txnsByMaterial: Map<string, MaterialTransaction[]>;
  onOrder: () => void;
}) {
  const bannerItems = useMemo(() => {
    return materials
      .map(m => {
        const tone = stockTone(m);
        const maxFillPct = m.maximumStock > 0 ? Math.min(100, Math.round((m.currentStock / m.maximumStock) * 100)) : 0;
        const days = computeDaysRemaining(m, txnsByMaterial.get(m.name) ?? []);
        return { material: m, tone, maxFillPct, days };
      })
      .filter(x => x.tone.className !== "ok")
      .sort((a, b) => {
        if (a.tone.className === "crit" && b.tone.className !== "crit") return -1;
        if (a.tone.className !== "crit" && b.tone.className === "crit") return 1;
        return (a.days ?? 999) - (b.days ?? 999);
      })
      .slice(0, 3);
  }, [materials, txnsByMaterial]);

  const systemOK = bannerItems.length === 0;

  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
      {bannerItems.map(({ material, tone, maxFillPct, days }) => (
        <div key={material.id} style={{
          flex: "1 1 240px",
          padding: "12px 16px",
          borderRadius: 12,
          border: `1px solid ${tone.className === "crit" ? "rgba(239,68,68,0.28)" : "rgba(245,158,11,0.28)"}`,
          background: tone.className === "crit" ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{tone.className === "crit" ? "🔴" : "🟠"}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: tone.color }}>{material.name} — {maxFillPct}% үлдсэн</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                {days !== null
                  ? `${days} хоногийн дотор дуусах эрсдэлтэй`
                  : tone.className === "crit" ? "Шуурхай нөхөх шаардлагатай" : "Анхааруулга шаардлагатай"}
              </div>
            </div>
          </div>
          <button type="button" onClick={onOrder} style={{
            padding: "5px 12px", borderRadius: 7,
            border: `1px solid ${tone.color}55`,
            background: `${tone.color}12`,
            color: tone.color, fontSize: 10, fontWeight: 800, cursor: "pointer", flexShrink: 0,
          }}>
            {tone.className === "crit" ? "Захиалах" : "Анхаарах"}
          </button>
        </div>
      ))}
      <div style={{
        flex: systemOK ? "1 1 auto" : "0 0 auto",
        padding: "12px 16px",
        borderRadius: 12,
        border: "1px solid rgba(16,185,129,0.22)",
        background: "rgba(16,185,129,0.05)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 16 }}>🟢</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#10B981" }}>
              СИСТЕМИЙН ТӨЛӨВ: {systemOK ? "ТОГТВОРТОЙ" : "АНХААРУУЛГА"}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
              {systemOK ? "Бүх үндсэн систем хэвийн ажиллаж байна" : `${bannerItems.length} материал анхаарал шаардлагатай`}
            </div>
          </div>
        </div>
        <button type="button" style={{
          padding: "5px 12px", borderRadius: 7,
          border: "1px solid rgba(16,185,129,0.28)",
          background: "rgba(16,185,129,0.09)",
          color: "#10B981", fontSize: 10, fontWeight: 800, cursor: "pointer", flexShrink: 0,
        }}>Дэлгэрэнгүй</button>
      </div>
    </div>
  );
}

function WarehouseSkeleton() {
  return (
    <div className="department-warehouse">
      <DeptTopbar icon="📦" title="Агуулах" />
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
          <div className="panel"><div className="ske" style={{ height: 300, margin: 20, borderRadius: 8 }} /></div>
          <div className="panel"><div className="ske" style={{ height: 300, margin: 20, borderRadius: 8 }} /></div>
        </div>
        <div className="wh-chart-row" style={{ marginBottom: 14 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="panel"><div className="ske" style={{ height: 180, margin: 20, borderRadius: 8 }} /></div>
          ))}
        </div>
        <div className="panel">
          <div style={{ padding: "16px 20px" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ske" style={{ height: 14, marginBottom: 14, width: `${82 + i * 3}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WarehousePage() {
  const { user } = useAuth();
  const [modal, setModal] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [reportClock, setReportClock] = useState<Date | null>(null);
  const [materialName, setMaterialName] = useState(WAREHOUSE_PRIORITY[0]);
  const [transactionType, setTransactionType] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tableFilter, setTableFilter] = useState<"all" | "crit" | "low" | "ok">("all");
  const [tableSearch, setTableSearch] = useState("");
  const [detailMaterial, setDetailMaterial] = useState<Material | null>(null);
  const markUpdated = () => setLastUpdated(new Date());

  const { data: materialsData, isLoading: materialsLoading, mutate: mutateMaterials } = useSWR(
    "/api/materials",
    fetcher,
    { refreshInterval: REALTIME_REFRESH_MS, revalidateOnFocus: false, onSuccess: markUpdated }
  );
  const { data: txnsData, isLoading: txnsLoading, mutate: mutateTxns } = useSWR(
    "/api/materials/transactions?limit=200",
    fetcher,
    { refreshInterval: REALTIME_REFRESH_MS, revalidateOnFocus: false, onSuccess: markUpdated }
  );
  const { data: reportTxnsData, isLoading: reportTxnsLoading, mutate: mutateReportTxns } = useSWR(
    reportModal ? `/api/materials/transactions?days=${REPORT_DAYS}&limit=1000` : null,
    fetcher,
    { refreshInterval: REALTIME_REFRESH_MS, revalidateOnFocus: false, onSuccess: markUpdated }
  );
  const { data: statsData, mutate: mutateStats } = useSWR(
    "/api/materials/stats",
    fetcher,
    { refreshInterval: REALTIME_REFRESH_MS, revalidateOnFocus: false, onSuccess: markUpdated }
  );

  const materials: Material[] = useMemo(() => materialsData?.data ?? [], [materialsData]);
  const transactions: MaterialTransaction[] = useMemo(() => txnsData?.data ?? [], [txnsData]);
  const loading = materialsLoading || txnsLoading;

  useEscapeClose(Boolean(detailMaterial || reportModal || modal), () => {
    if (detailMaterial) {
      setDetailMaterial(null);
      return;
    }

    if (reportModal) {
      setReportModal(false);
      return;
    }

    if (modal) setModal(false);
  });

  // O(1) lookup: group transactions by material name once
  const txnsByMaterial = useMemo(() => {
    const map = new Map<string, MaterialTransaction[]>();
    for (const t of transactions) {
      const arr = map.get(t.material.name);
      if (arr) arr.push(t);
      else map.set(t.material.name, [t]);
    }
    return map;
  }, [transactions]);

  useEffect(() => {
    if (!reportModal) return;

    const refreshReport = () => {
      setReportClock(new Date());
      void mutateMaterials();
      void mutateTxns();
      void mutateReportTxns();
      void mutateStats();
    };

    refreshReport();
    const intervalId = window.setInterval(refreshReport, REALTIME_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, [mutateMaterials, mutateReportTxns, mutateStats, mutateTxns, reportModal]);

  useEffect(() => {
    if (modal && !WAREHOUSE_PRIORITY.includes(materialName)) {
      setMaterialName(WAREHOUSE_PRIORITY[0]);
    }
  }, [materialName, modal]);

  async function submitTransaction(event: { preventDefault(): void }) {
    event.preventDefault();
    const selectedMaterialName = materialName || WAREHOUSE_PRIORITY[0];
    const selectedMaterial = materials.find((material) => material.name === selectedMaterialName);
    const numericQuantity = Number(quantity);
    if (!selectedMaterialName || !numericQuantity || numericQuantity <= 0) {
      setError("Материал болон хэмжээг зөв оруулна уу");
      return;
    }
    setSubmitting(true);
    setError("");
    const response = await fetch("/api/materials/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        materialId: selectedMaterial?.id,
        materialName: selectedMaterialName,
        type: transactionType,
        quantity: numericQuantity,
        note: note || null,
        transactionDate,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Алдаа гарлаа");
      setSubmitting(false);
      return;
    }
    const createdTxn = data.data as MaterialTransaction | undefined;

    // Close modal and reset form first so the user sees the table immediately
    setModal(false);
    setSubmitting(false);
    const capturedMaterialName = selectedMaterialName;
    const capturedQty = numericQuantity;
    const capturedType = transactionType;
    setQuantity("");
    setNote("");
    setTransactionType("IN");

    // Optimistic update: immediately apply the stock delta to the local cache
    const delta = capturedType === "IN" ? capturedQty : -capturedQty;
    void mutateMaterials(
      (current: { data: Material[] } | undefined) =>
        current
          ? {
              ...current,
              data: current.data.map(m =>
                m.name === capturedMaterialName
                  ? { ...m, currentStock: Math.max(0, m.currentStock + delta) }
                  : m
              ),
            }
          : current,
      { revalidate: true }
    );
    if (createdTxn) {
      void mutateTxns(
        (current: { data: MaterialTransaction[] } | undefined) =>
          current
            ? {
                ...current,
                data: [createdTxn, ...current.data.filter((txn) => txn.id !== createdTxn.id)].slice(0, 200),
              }
            : { data: [createdTxn] },
        { revalidate: true }
      );
      void mutateStats(
        (current: { data: MonthlyStat[] } | undefined) => addTransactionToStats(current, createdTxn),
        { revalidate: true }
      );
    } else {
      void mutateTxns();
      void mutateStats();
    }
  }

  const flowSeries = useMemo(() => buildFlowSeries(transactions), [transactions]);

  const displayMaterials = useMemo(() => {
    const indexMap = new Map(WAREHOUSE_PRIORITY.map((name, i) => [name, i]));
    return [...materials].sort((a, b) => {
      const ia = indexMap.get(a.name) ?? 999;
      const ib = indexMap.get(b.name) ?? 999;
      if (ia !== ib) return ia - ib;
      return a.name.localeCompare(b.name);
    });
  }, [materials]);

  // Single pass: compute tone per material + all counts + all stock totals
  const {
    toneMap,
    criticalCount,
    lowCount,
    normalCount,
    criticalStockTotal,
    lowStockTotal,
    normalStockTotal,
    totalStock,
  } = useMemo(() => {
    const toneMap = new Map<string, ReturnType<typeof stockTone>>();
    let criticalCount = 0, lowCount = 0, normalCount = 0;
    let criticalStockTotal = 0, lowStockTotal = 0, normalStockTotal = 0;
    let totalStock = 0;
    for (const m of displayMaterials) {
      const tone = stockTone(m);
      toneMap.set(m.id, tone);
      totalStock += m.currentStock;
      if (tone.className === "crit") { criticalCount++; criticalStockTotal += m.currentStock; }
      else if (tone.className === "low") { lowCount++; lowStockTotal += m.currentStock; }
      else { normalCount++; normalStockTotal += m.currentStock; }
    }
    return { toneMap, criticalCount, lowCount, normalCount, criticalStockTotal, lowStockTotal, normalStockTotal, totalStock };
  }, [displayMaterials]);

  const totalInbound = useMemo(() => flowSeries.reduce((s, d) => s + d.inbound, 0), [flowSeries]);
  const totalOutbound = useMemo(() => flowSeries.reduce((s, d) => s + d.outbound, 0), [flowSeries]);

  const funnelData = useMemo(() => {
    const total = totalStock || 1;
    return [
      { name: "Нийт материал", pct: 100, value: totalStock, color: "#10B981" },
      { name: "Хэвийн нөөц", pct: Math.round((normalStockTotal / total) * 100), value: normalStockTotal, color: "#3DD598" },
      { name: "Бага нөөц", pct: Math.round(((normalStockTotal + lowStockTotal) / total) * 100) || 64, value: normalStockTotal + lowStockTotal, color: "#F59E0B" },
      { name: "Анхаарал шаардлагатай", pct: Math.max(Math.round((lowStockTotal / total) * 100), 6), value: lowStockTotal, color: "#FB923C" },
      { name: "Критик нөөц", pct: Math.max(Math.round((criticalStockTotal / total) * 100), 4), value: criticalStockTotal, color: "#EF4444" },
      { name: "Шуурхай нөхөх", pct: Math.max(criticalCount * 2, 2), value: criticalCount, color: "#A855F7" },
    ];
  }, [totalStock, normalStockTotal, lowStockTotal, criticalStockTotal, criticalCount]);

  const stockDistribution = useMemo(() => [
    { name: "Хэвийн", value: normalCount || 0.1, color: "#10B981" },
    { name: "Бага", value: lowCount || 0.1, color: "#F59E0B" },
    { name: "Критик", value: criticalCount || 0.1, color: "#EF4444" },
  ], [normalCount, lowCount, criticalCount]);

  const monthlyStats = useMemo(() => (statsData?.data ?? []) as MonthlyStat[], [statsData]);

  const monthlyData = useMemo(() =>
    monthlyStats.map(d => ({ month: d.label, inbound: Math.round(d.inbound), outbound: Math.round(d.outbound) })),
    [monthlyStats]
  );

  const monthlyTrend = useMemo(() =>
    monthlyStats.map(d => ({ month: d.label, value: Math.round(d.inbound + d.outbound) })),
    [monthlyStats]
  );

  const last4Stats = useMemo(() => {
    if (monthlyStats.length === 0) return [];
    const last4 = monthlyStats.slice(-4);
    const colors = ["#10B981", "#F59E0B", "#A855F7", "#3B82F6"];
    return last4.map((d, i) => {
      const prevIdx = monthlyStats.length - 4 + i - 1;
      const prev = prevIdx >= 0 ? monthlyStats[prevIdx] : null;
      const pct = prev && prev.inbound > 0 ? Math.round(((d.inbound - prev.inbound) / prev.inbound) * 100) : null;
      return {
        label: `${Math.round(d.inbound).toLocaleString("mn-MN")} КГ`,
        month: d.label,
        pct: pct !== null ? `${pct >= 0 ? "+" : ""}${pct}%` : "—",
        color: colors[i],
      };
    });
  }, [monthlyStats]);

  const filteredMaterials = useMemo(() => {
    return displayMaterials.filter((m) => {
      const tone = toneMap.get(m.id)!;
      const matchesFilter = tableFilter === "all" || tone.className === tableFilter;
      const matchesSearch = tableSearch === "" || m.name.toLowerCase().includes(tableSearch.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [displayMaterials, toneMap, tableFilter, tableSearch]);

  const alerts = useMemo(() => {
    const list: { type: string; name: string; msg: string; action: string }[] = [];
    for (const m of displayMaterials) {
      const tone = toneMap.get(m.id)!;
      if (tone.className === "crit") {
        list.push({ type: "crit", name: m.name, msg: `Одоогийн үлдэгдэл: ${formatValue(m.currentStock, m.unit)}`, action: "Шуурхай" });
      } else if (tone.className === "low") {
        list.push({ type: "low", name: m.name, msg: `Нөөц багасаж байна: ${formatValue(m.currentStock, m.unit)}`, action: "Анхааруулга" });
      }
    }
    return list.slice(0, 4);
  }, [displayMaterials, toneMap]);

  const reportNow = useMemo(() => reportClock ?? lastUpdated ?? new Date(), [lastUpdated, reportClock]);
  const reportStart = useMemo(() => {
    const start = new Date(reportNow);
    start.setDate(start.getDate() - (REPORT_DAYS - 1));
    start.setHours(0, 0, 0, 0);
    return start;
  }, [reportNow]);
  const reportNowTime = reportNow.getTime();
  const reportStartTime = reportStart.getTime();
  const reportSourceTransactions: MaterialTransaction[] = useMemo(() => reportTxnsData?.data ?? [], [reportTxnsData]);
  const reportTransactions = useMemo(
    () =>
      reportSourceTransactions.filter((txn) => {
        const txnTime = new Date(txn.transactionDate).getTime();
        return txnTime >= reportStartTime && txnTime <= reportNowTime;
      }),
    [reportNowTime, reportSourceTransactions, reportStartTime]
  );
  const reportTotals = useMemo(() => {
    return reportTransactions.reduce(
      (totals, txn) => {
        if (txn.type === "IN") totals.inbound += txn.quantity;
        else totals.outbound += txn.quantity;
        totals.count += 1;
        return totals;
      },
      { inbound: 0, outbound: 0, count: 0 }
    );
  }, [reportTransactions]);
  const reportLatestTransactions = useMemo(
    () =>
      reportTransactions
        .slice()
        .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
        .slice(0, 20),
    [reportTransactions]
  );
  const reportMaterialRows = useMemo(() => {
    return displayMaterials.map((material) => {
      const tone = toneMap.get(material.id) ?? stockTone(material);
      const materialTxns = reportTransactions.filter((txn) => txn.material.id === material.id || txn.material.name === material.name);
      const inbound = materialTxns.reduce((sum, txn) => sum + (txn.type === "IN" ? txn.quantity : 0), 0);
      const outbound = materialTxns.reduce((sum, txn) => sum + (txn.type === "OUT" ? txn.quantity : 0), 0);
      const net = inbound - outbound;
      const openingStock = material.currentStock - net;
      const fillPct = material.maximumStock > 0
        ? Math.min(100, Math.round((material.currentStock / material.maximumStock) * 100))
        : 0;
      const shortage = Math.max(0, material.minimumStock - material.currentStock);
      return { material, tone, openingStock, inbound, outbound, net, fillPct, shortage, transactionCount: materialTxns.length };
    });
  }, [displayMaterials, reportTransactions, toneMap]);
  const reportMovementRows = useMemo(
    () =>
      reportMaterialRows
        .slice()
        .sort((a, b) => {
          const movementDiff = (b.inbound + b.outbound) - (a.inbound + a.outbound);
          if (movementDiff !== 0) return movementDiff;
          return a.material.name.localeCompare(b.material.name);
        }),
    [reportMaterialRows]
  );
  const reportMovedMaterialCount = reportMaterialRows.filter((row) => row.transactionCount > 0).length;
  const reportTopOutbound = reportMaterialRows
    .slice()
    .sort((a, b) => b.outbound - a.outbound)
    .find((row) => row.outbound > 0);
  const reportNetChange = reportTotals.inbound - reportTotals.outbound;
  const reportHealth = criticalCount > 0
    ? { label: "Критик", color: "#EF4444" }
    : lowCount > 0
      ? { label: "Анхаарал", color: "#F59E0B" }
      : { label: "Тогтвортой", color: "#10B981" };

  const inboundSparkline = useMemo(() => flowSeries.map((d) => d.inbound), [flowSeries]);
  const outboundSparkline = useMemo(() => flowSeries.map((d) => d.outbound), [flowSeries]);

  const canEdit = user?.role === "ADMIN" || (user?.role === "MODERATOR" && user.department === "WAREHOUSE");
  const TARGET_LINE = 3000;

  const aiAdvice = useMemo(() => {
    const items = displayMaterials
      .map(m => ({ m, tone: toneMap.get(m.id)!, days: computeDaysRemaining(m, txnsByMaterial.get(m.name) ?? []) }))
      .filter(x => x.tone.className !== "ok");
    if (items.length === 0) return null;
    const withDays = items.filter(x => x.days !== null).sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
    const best = withDays[0] ?? items[0];
    const text = best.days !== null
      ? `${best.m.name} ${best.days} хоногийн дотор дуусах төлөвтэй. Захиалга хийхийг зөвлөж байна.`
      : `${best.m.name} нь ${best.tone.label.toLowerCase()} түвшинд байна. Яаралтай захиалга хийхийг зөвлөж байна.`;
    return { text, tone: best.tone };
  }, [displayMaterials, toneMap, txnsByMaterial]);

  if (loading) return <WarehouseSkeleton />;

  return (
    <div className="department-warehouse">
      <DeptTopbar icon="📦" title="Агуулах" />

      <div className="content">
        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 18, display: "flex", alignItems: "center", gap: 6 }}>
          <span>🏠 Нүүр хуудас</span>
          <span style={{ opacity: 0.4 }}>›</span>
          <span style={{ color: "var(--text)", fontWeight: 600 }}>Агуулах</span>
          <span style={{ flex: 1 }} />
          <RealtimeBadge lastUpdated={lastUpdated} />
        </div>

        {/* System Status / Alert Banner */}
        <SystemStatusBanner materials={displayMaterials} txnsByMaterial={txnsByMaterial} onOrder={() => setModal(true)} />

        {/* KPI Cards */}
        <div className="kpi-grid">
          <KpiCard label="Нийт материал" value={displayMaterials.length} valueClass="white"
            change="Материалын бүртгэл" icon={<span style={{ fontSize: 20 }}>📦</span>}
            sparkline={inboundSparkline} sparklineColor="#F59E0B" />
          <KpiCard label="Критик нөөц" value={criticalCount} valueStyle={{ color: "#EF4444" }}
            change={<span>Шуурхай анхаарах шаардлагатай{criticalCount > 0 ? <span style={{ color: "#EF4444", marginLeft: 6, fontWeight: 800 }}>↑ {Math.round(criticalStockTotal / (totalStock || 1) * 100)}% нийт</span> : null}</span>}
            icon={<span style={{ fontSize: 20 }}>🚨</span>}
            sparkline={outboundSparkline.map((v, i) => (i % 3 === 0 ? v + 50 : v))} sparklineColor="#EF4444" />
          <KpiCard label="Бага нөөц" value={lowCount} valueStyle={{ color: "#F59E0B" }}
            change={<span>Анхаарал шаардлагатай{lowCount > 0 ? <span style={{ color: "#F59E0B", marginLeft: 6, fontWeight: 800 }}>↑ {Math.round(lowStockTotal / (totalStock || 1) * 100)}% нийт</span> : null}</span>}
            icon={<span style={{ fontSize: 20 }}>⚠️</span>}
            sparkline={outboundSparkline} sparklineColor="#F59E0B" />
          <KpiCard label="Хэвийн нөөц" value={normalCount} change="Тогтвортой түвшин"
            icon={<span style={{ fontSize: 20 }}>✅</span>} sparkline={inboundSparkline} sparklineColor="#10B981" />
        </div>

        {/* Main Charts Row */}
        <div className="wh-main-grid">
          <div className="panel">
            <div className="panel-hdr" style={{ paddingBottom: 12 }}>
              <div>
                <div className="panel-title">Сүүлийн 10 хоногийн орлого / зарлага (КГ)</div>
                <div className="panel-sub">Сүүлийн 10 хоног</div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                {FLOW_LEGEND.map(([c, l]) => (
                  <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: c }}>
                    <span style={{ width: 16, height: 2, background: c, display: "inline-block", borderRadius: 2 }} />
                    {l}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: "0 20px 4px", display: "flex", gap: 24 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#10B981" }}>{totalInbound.toLocaleString("mn-MN")} КГ</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>НИЙТ ОРЛОГО</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#EF4444" }}>{totalOutbound.toLocaleString("mn-MN")} КГ</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>НИЙТ ЗАРЛАГА</div>
              </div>
            </div>
            <div className="chart-wrap" style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={flowSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="inboundGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="outboundGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
                  <Tooltip content={<FlowTooltip />} />
                  <ReferenceLine y={TARGET_LINE} stroke="var(--muted)" strokeDasharray="5 4" strokeWidth={1.5}
                    label={{ value: `Зорилго: ${TARGET_LINE.toLocaleString()} КГ`, position: "insideTopLeft", fontSize: 11, fill: "var(--muted)" }} />
                  <Area type="monotone" dataKey="inbound" name="Орлого" stroke="#10B981" strokeWidth={2.5}
                    fill="url(#inboundGrad)" dot={{ r: 3, fill: "#10B981" }} activeDot={{ r: 5 }} isAnimationActive={false} />
                  <Area type="monotone" dataKey="outbound" name="Зарлага" stroke="#EF4444" strokeWidth={2}
                    fill="url(#outboundGrad)" dot={{ r: 3, fill: "#EF4444" }} activeDot={{ r: 5 }} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <ChartHint>Ногоон талбар нь орлого, улаан талбар нь зарлага. Саарал тасархай шугам нь зорилтот түвшинг харуулна.</ChartHint>
            {totalInbound > TARGET_LINE ? (
              <div style={{ margin: "0 20px 18px", padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, fontSize: 12, color: "#10B981", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span>💡</span>
                <span>Нийт орлого зорилгоос <strong>{(totalInbound - TARGET_LINE).toLocaleString("mn-MN")} КГ</strong>-аар их байна.</span>
              </div>
            ) : null}
          </div>

          {/* Funnel Chart */}
          <div className="panel">
            <div className="panel-hdr" style={{ paddingBottom: 16 }}>
              <div>
                <div className="panel-title">Нөөцийн ангилал (Funnel)</div>
                <div className="panel-sub">Нөөцийн тархалт</div>
              </div>
            </div>
            <div style={{ padding: "0 20px 20px" }}>
              {funnelData.map((item) => (
                <FunnelBar key={item.name} name={item.name} pct={item.pct} value={item.value} color={item.color} />
              ))}
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                {funnelData.map((item) => (
                  <div key={item.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, display: "inline-block" }} />
                      {item.name}
                    </span>
                    <span style={{ color: item.color, fontWeight: 700 }}>{item.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 3 Small Charts */}
        <div className="wh-chart-row">
          <div className="panel">
            <div className="panel-hdr" style={{ paddingBottom: 0 }}>
              <div className="panel-title">Нөөцийн хуваарилалт</div>
            </div>
            <div className="panel-sub" style={{ padding: "2px 20px 0" }}>Одоогийн нөөцийн дүүргэлт</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px 18px" }}>
              <div style={{ width: 120, height: 120, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stockDistribution} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="value" stroke="none" isAnimationActive={false}>
                      {stockDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [`${v} материал`]} contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                {stockDistribution.map((d) => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, display: "inline-block", flexShrink: 0 }} />
                      <span style={{ color: "var(--text)" }}>{d.name} нөөц</span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: d.color }}>
                      {Math.round(d.value)} ({displayMaterials.length ? Math.round((d.value / displayMaterials.length) * 100) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-hdr" style={{ paddingBottom: 4 }}>
              <div className="panel-title">Сарын гүйцэтгэлийн тренд</div>
            </div>
            <div style={{ padding: "4px 20px 2px", display: "flex", gap: 16, flexWrap: "wrap" }}>
              {last4Stats.map((s, i) => (
                <div key={i}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>{s.month}</div>
                  <div style={{ fontSize: 10, color: s.color }}>{s.pct}</div>
                </div>
              ))}
            </div>
            <div className="chart-wrap" style={{ height: 120, paddingTop: 4 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }} />
                  <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3, fill: "#3B82F6" }} activeDot={{ r: 5 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel">
            <div className="panel-hdr" style={{ paddingBottom: 4 }}>
              <div className="panel-title">Орлогын тренд (сар бүр)</div>
            </div>
            <div className="chart-wrap" style={{ height: 148, paddingTop: 8 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }} barSize={8}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="inbound" name="Орлого (КГ)" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="outbound" name="Зарлага (КГ)" stackId="a" fill="#EF4444" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                    <LabelList dataKey="outbound" position="top" fill="var(--text)" fontSize={9} />
                  </Bar>
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottom Section: Table + Right Panel */}
        <div className="wh-bottom-grid">
          <div className="panel">
            <div className="panel-hdr">
              <div>
                <div className="panel-title">Материалын бодит үлдэгдэл</div>
                <div className="panel-sub" style={{ fontFamily: "var(--font-mono), monospace" }}>
                  {lastUpdated
                    ? lastUpdated.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                    : "--:--:--"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {(["all", "crit", "low", "ok"] as const).map((f) => {
                  const labels = { all: "Бүгд", crit: "Критик", low: "Бага", ok: "Хэвийн" };
                  const colors = { all: "var(--accent)", crit: "#EF4444", low: "#F59E0B", ok: "#10B981" };
                  return (
                    <button key={f} type="button" onClick={() => setTableFilter(f)}
                      style={{ padding: "5px 12px", borderRadius: 999, border: `1px solid ${tableFilter === f ? colors[f] : "var(--border)"}`, background: tableFilter === f ? `${colors[f]}15` : "transparent", color: tableFilter === f ? colors[f] : "var(--muted)", fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}>
                      {labels[f]}
                    </button>
                  );
                })}
                <input type="text" placeholder="Хайх..." value={tableSearch} onChange={(e) => setTableSearch(e.target.value)}
                  style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--base3)", color: "var(--text)", fontSize: 11, outline: "none", width: 120 }} />
                {canEdit ? (
                  <button className="add-btn" type="button" onClick={() => setModal(true)}>+ Орлого / Зарлага</button>
                ) : null}
              </div>
            </div>
            <div style={{ borderTop: "1px solid var(--border)", overflowX: "auto" }}>
              <table className="safety-table wh-table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>№</th>
                    <th>Материал</th>
                    <th>Үлдэгдэл (КГ)</th>
                    <th>Өөрчлөлт </th>
                    <th>Дүүргэлтийн хувь</th>
                    <th>Төлөв</th>
                    <th>Сүүлийнх</th>
                    <th style={{ position: "sticky", right: 0, background: "var(--panel)", boxShadow: "-3px 0 8px rgba(0,0,0,0.07)", zIndex: 2 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaterials.length === 0 ? (
                    <tr className="empty-row">
                      <td colSpan={8} style={{ padding: "32px 16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 32 }}>📦</span>
                          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14 }}>Материал олдсонгүй</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>Шүүлтүүр эсвэл хайлтыг өөрчилж үзнэ үү</div>
                          {canEdit && <button type="button" onClick={() => setModal(true)} style={{ marginTop: 4, padding: "6px 18px", borderRadius: 8, border: "1px solid var(--accent)", background: "var(--accent-dim)", color: "var(--accent)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Орлого нэмэх</button>}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredMaterials.map((m, idx) => {
                      const tone = toneMap.get(m.id)!;
                      const fillPct = m.maximumStock > 0
                        ? Math.min(100, Math.round((m.currentStock / m.maximumStock) * 100))
                        : 0;
                      const bgClass = tone.className === "ok" ? "bg-g" : tone.className === "low" ? "bg-a" : "bg-r";
                      return (
                        <tr key={m.id} className="wh-tr-hover">
                          <td style={{ color: "var(--muted)", fontSize: 11 }}>{idx + 1}</td>
                          <td><strong style={{ color: "var(--text)", fontSize: 13 }}>{m.name}</strong></td>
                          <td style={{ fontFamily: "var(--font-mono), monospace", fontWeight: 600 }}>{formatValue(m.currentStock, m.unit)}</td>
                          <td>
                            <span style={{ color: m.currentStock >= m.minimumStock ? "#10B981" : "#EF4444", fontSize: 12, fontWeight: 700 }}>
                              {m.currentStock >= m.minimumStock ? "→ 0" : `↓ ${(m.minimumStock - m.currentStock).toLocaleString("mn-MN")}`}
                            </span>
                          </td>
                          <td style={{ minWidth: 140 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--base3)", overflow: "hidden" }}>
                                <div style={{ width: `${fillPct}%`, height: "100%", borderRadius: 999, background: tone.color, transition: "width 0.4s" }} />
                              </div>
                              <span style={{ fontSize: 11, color: tone.color, fontWeight: 700, width: 32 }}>{fillPct}%</span>
                            </div>
                          </td>
                          <td><span className={`bg ${bgClass}`}>{tone.label}</span></td>
                          <td style={{ color: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono), monospace" }}>
                            {lastUpdated ? lastUpdated.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                          </td>
                          <td style={{ position: "sticky", right: 0, background: "var(--panel)", boxShadow: "-3px 0 8px rgba(0,0,0,0.07)" }}>
                            <button type="button" onClick={tone.className !== "ok" ? () => setModal(true) : () => setDetailMaterial(m)} style={{
                              padding: "4px 10px", borderRadius: 7,
                              border: `1px solid ${tone.className !== "ok" ? `${tone.color}50` : "var(--border)"}`,
                              background: tone.className !== "ok" ? `${tone.color}0f` : "transparent",
                              color: tone.className !== "ok" ? tone.color : "var(--muted)",
                              fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                            }}>
                              {tone.className !== "ok" ? "Захиалах" : "Дэлгэрэнгүй"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="panel" style={{ padding: 20 }}>
              <div className="panel-title" style={{ marginBottom: 14 }}>Үйлдлүүд</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { icon: "➕", label: "Материал нэмэх", color: "#F59E0B", onClick: () => setModal(true) },
                  { icon: "📋", label: "Захиалга үүсгэх", color: "#3B82F6" },
                  { icon: "🔀", label: "Шилжүүлэх", color: "#10B981" },
                  { icon: "📊", label: "Тайлан харах", color: "#8B5CF6", onClick: () => setReportModal(true) },
                  { icon: "📁", label: "Excel экспорт", color: "#10B981" },
                  { icon: "🔄", label: "Шинэчлэх", color: "#F59E0B", onClick: () => { void mutateMaterials(); void mutateTxns(); void mutateStats(); } },
                ].map((a) => (
                  <button key={a.label} type="button" onClick={a.onClick}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "10px 6px", border: `1px solid var(--border)`, borderRadius: 12, background: `${a.color}08`, color: a.color, cursor: "pointer", fontSize: 10, fontWeight: 700, transition: "all 0.15s" }}>
                    <span style={{ fontSize: 18 }}>{a.icon}</span>
                    <span style={{ textAlign: "center", lineHeight: 1.3 }}>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {aiAdvice ? (
              <div className="panel" style={{ padding: 16, border: `1px solid ${aiAdvice.tone.color}28` }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 15 }}>🤖</span>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text)" }}>AI Зөвлөмж</div>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text)", lineHeight: 1.55, marginBottom: 12 }}>{aiAdvice.text}</div>
                <button type="button" onClick={() => setModal(true)} style={{
                  width: "100%", padding: "7px 14px", borderRadius: 8,
                  border: `1px solid ${aiAdvice.tone.color}50`,
                  background: `${aiAdvice.tone.color}12`,
                  color: aiAdvice.tone.color, fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}>Захиалга хийх</button>
              </div>
            ) : (
              <div className="panel" style={{ padding: 16, border: "1px solid rgba(16,185,129,0.2)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 15 }}>🤖</span>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text)" }}>AI Зөвлөмж</div>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.55 }}>Бүх нөөц тогтвортой байна. Одоогоор захиалга шаардлагагүй.</div>
              </div>
            )}

            <div className="panel" style={{ padding: 20, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div className="panel-title">Анхааруулга</div>
                {alerts.length > 0 ? (
                  <span style={{ background: "#EF4444", color: "#fff", borderRadius: 999, fontSize: 10, fontWeight: 800, padding: "2px 7px" }}>{alerts.length}</span>
                ) : null}
              </div>
              {alerts.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 12, textAlign: "center", padding: "20px 0" }}>✅ Анхааруулга байхгүй</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {alerts.map((a, i) => (
                    <div key={i} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${a.type === "crit" ? "rgba(239,68,68,0.22)" : "rgba(245,158,11,0.22)"}`, background: a.type === "crit" ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.06)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <span style={{ fontSize: 14, flexShrink: 0 }}>{a.type === "crit" ? "🚨" : "⚠️"}</span>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{a.name}</div>
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>{a.msg}</div>
                          </div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, color: a.type === "crit" ? "#EF4444" : "#F59E0B", background: a.type === "crit" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)", flexShrink: 0 }}>{a.action}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
          aria-labelledby="warehouse-report-title"
          onClick={(e) => e.target === e.currentTarget && setReportModal(false)}
        >
          <div className="mc" style={{ maxWidth: 1080, width: "100%", padding: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh" style={{ marginBottom: 0, padding: "22px 24px 0", flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 0 4px rgba(16,185,129,0.12)" }} />
                  <span style={{ color: "#10B981", fontSize: 11, fontWeight: 800, letterSpacing: 0 }}>
                    {reportTxnsLoading ? "Тайлан татаж байна" : "14 хоногийн тайлан шинэчлэгдэж байна"}
                  </span>
                </div>
                <h3 id="warehouse-report-title" style={{ marginBottom: 6 }}>Агуулахын 14 хоногийн тайлан</h3>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>
                  Хугацаа: <strong style={{ color: "var(--text)" }}>{formatShortDate(reportStart)} - {formatShortDate(reportNow)}</strong>
                  <span style={{ margin: "0 8px", opacity: 0.45 }}>|</span>
                  Бэлтгэсэн: {formatDateTime(reportNow)}
                  <span style={{ margin: "0 8px", opacity: 0.45 }}>|</span>
                  Сүүлийн sync: {formatDateTime(lastUpdated)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  className="btn bo2"
                  type="button"
                  onClick={() => {
                    setReportClock(new Date());
                    void mutateMaterials();
                    void mutateTxns();
                    void mutateReportTxns();
                    void mutateStats();
                  }}
                >
                  Шинэчлэх
                </button>
                <button className="mx" type="button" aria-label="Тайлан хаах" onClick={() => setReportModal(false)}>×</button>
              </div>
            </div>

            <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 10 }}>
                {[
                  { label: "Тайлангийн хугацаа", value: `${REPORT_DAYS} хоног`, sub: `${formatShortDate(reportStart)} - ${formatShortDate(reportNow)}`, color: "#3B82F6" },
                  { label: "Нийт орлого", value: formatValue(reportTotals.inbound, "КГ"), sub: `${reportTotals.count} гүйлгээ`, color: "#10B981" },
                  { label: "Нийт зарлага", value: formatValue(reportTotals.outbound, "КГ"), sub: `${reportMovedMaterialCount} материал хөдөлсөн`, color: "#EF4444" },
                  { label: "Цэвэр өөрчлөлт", value: formatSignedValue(reportNetChange, "КГ"), sub: "Орлого - Зарлага", color: reportNetChange >= 0 ? "#10B981" : "#EF4444" },
                  { label: "Одоогийн нийт үлдэгдэл", value: formatValue(totalStock, "КГ"), sub: `${displayMaterials.length} материал`, color: "#F59E0B" },
                  { label: "Нөөцийн төлөв", value: reportHealth.label, sub: `Критик ${criticalCount} | Бага ${lowCount}`, color: reportHealth.color },
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
                    { label: "Нийт гүйлгээ", value: `${reportTotals.count}`, sub: "Сүүлийн 14 хоног" },
                    { label: "Хөдөлгөөнтэй материал", value: `${reportMovedMaterialCount}`, sub: `${displayMaterials.length} материалаас` },
                    { label: "Хамгийн их зарлага", value: reportTopOutbound ? reportTopOutbound.material.name : "Байхгүй", sub: reportTopOutbound ? formatValue(reportTopOutbound.outbound, reportTopOutbound.material.unit) : "Зарлага бүртгэгдээгүй" },
                    { label: "Анхаарах нөөц", value: `${criticalCount + lowCount}`, sub: `Критик ${criticalCount}, бага ${lowCount}` },
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
                    <div className="panel-title">Материал тус бүрийн 14 хоногийн хөдөлгөөн</div>
                    <div className="panel-sub" style={{ marginTop: 4 }}>
                      Эхний үлдэгдэл = одоогийн үлдэгдлээс 14 хоногийн цэвэр хөдөлгөөнийг буцаан тооцсон утга.
                    </div>
                  </div>
                  <span style={{ color: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono), monospace" }}>
                    {formatShortDate(reportStart)} - {formatShortDate(reportNow)}
                  </span>
                </div>
                <div style={{ maxHeight: 360, overflow: "auto" }}>
                  <table className="safety-table wh-table">
                    <thead>
                      <tr>
                        <th>Материал</th>
                        <th>Эхний үлдэгдэл</th>
                        <th>Орлого</th>
                        <th>Зарлага</th>
                        <th>Цэвэр</th>
                        <th>Одоогийн үлдэгдэл</th>
                        <th>Дүүргэлт</th>
                        <th>Төлөв</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportTxnsLoading ? (
                        <tr><td colSpan={8} style={{ padding: 18, color: "var(--muted)", textAlign: "center" }}>Материалын хөдөлгөөний тайланг татаж байна...</td></tr>
                      ) : reportMovementRows.map(({ material, tone, openingStock, inbound, outbound, net, fillPct }) => (
                        <tr key={material.id}>
                          <td><strong>{material.name}</strong></td>
                          <td>{formatValue(Math.max(0, openingStock), material.unit)}</td>
                          <td style={{ color: "#10B981", fontWeight: 800 }}>{formatValue(inbound, material.unit)}</td>
                          <td style={{ color: "#EF4444", fontWeight: 800 }}>{formatValue(outbound, material.unit)}</td>
                          <td style={{ color: net >= 0 ? "#10B981" : "#EF4444", fontWeight: 800 }}>{formatSignedValue(net, material.unit)}</td>
                          <td>{formatValue(material.currentStock, material.unit)}</td>
                          <td style={{ color: tone.color, fontWeight: 800 }}>{fillPct}%</td>
                          <td><span className={`bg ${tone.className === "ok" ? "bg-g" : tone.className === "low" ? "bg-a" : "bg-r"}`}>{tone.label}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel" style={{ padding: 18, margin: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                  <div>
                    <div className="panel-title">14 хоногийн гүйлгээний бүртгэл</div>
                    <div className="panel-sub" style={{ marginTop: 4 }}>Сүүлийн 20 гүйлгээг огноогоор бууруулж харуулна.</div>
                  </div>
                  <span style={{ color: "var(--muted)", fontSize: 11 }}>{reportTotals.count} нийт гүйлгээ</span>
                </div>
                <div style={{ maxHeight: 320, overflow: "auto" }}>
                  <table className="safety-table wh-table">
                    <thead>
                      <tr>
                        <th>Огноо</th>
                        <th>Материал</th>
                        <th>Төрөл</th>
                        <th>Хэмжээ</th>
                        <th>Тэмдэглэл</th>
                        <th>Бүртгэсэн</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportTxnsLoading ? (
                        <tr><td colSpan={6} style={{ padding: 18, color: "var(--muted)", textAlign: "center" }}>Тайлангийн гүйлгээг татаж байна...</td></tr>
                      ) : reportLatestTransactions.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: 18, color: "var(--muted)", textAlign: "center" }}>Энэ хугацаанд гүйлгээ байхгүй байна</td></tr>
                      ) : reportLatestTransactions.map((txn) => (
                        <tr key={txn.id}>
                          <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 11 }}>{formatDateTime(new Date(txn.transactionDate))}</td>
                          <td><strong>{txn.material.name}</strong></td>
                          <td>
                            <span className={`bg ${txn.type === "IN" ? "bg-g" : "bg-r"}`}>{txn.type === "IN" ? "Орлого" : "Зарлага"}</span>
                          </td>
                          <td style={{ fontWeight: 800, color: txn.type === "IN" ? "#10B981" : "#EF4444" }}>
                            {formatValue(txn.quantity, txn.material.unit)}
                          </td>
                          <td style={{ color: txn.note ? "var(--text)" : "var(--muted)", fontStyle: txn.note ? "normal" : "italic" }}>
                            {txn.note ?? "-"}
                          </td>
                          <td style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{txn.createdBy.fullName}</td>
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

      {/* Transaction Modal */}
      {modal ? (
        <div className="mo open" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="mc">
            <div className="mh">
              <h3>Орлого / Зарлага нэмэх</h3>
              <button className="mx" type="button" onClick={() => setModal(false)}>×</button>
            </div>
            <form onSubmit={submitTransaction}>
              <div className="fr2">
                <div className="fg">
                  <label>Материал</label>
                  <select value={materialName} onChange={(e) => setMaterialName(e.target.value)}>
                    {WAREHOUSE_PRIORITY.map((name) => {
                      const material = materials.find((item) => item.name === name);
                      return <option key={name} value={name}>{name} ({material?.unit ?? "КГ"})</option>;
                    })}
                  </select>
                </div>
                <div className="fg">
                  <label>Төрөл</label>
                  <select value={transactionType} onChange={(e) => setTransactionType(e.target.value as "IN" | "OUT")}>
                    <option value="IN">Орлого</option>
                    <option value="OUT">Зарлага</option>
                  </select>
                </div>
              </div>
              <div className="fr2">
                <div className="fg">
                  <label>Хэмжээ</label>
                  <input type="number" min="0" step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </div>
                <div className="fg">
                  <label>Огноо</label>
                  <input type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} />
                </div>
              </div>
              <div className="fg">
                <label>Тэмдэглэл</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Нэмэлт тайлбар" />
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

      {/* Detail Modal */}
      {detailMaterial ? (() => {
        const tone = toneMap.get(detailMaterial.id) ?? stockTone(detailMaterial);
        const fillPct = detailMaterial.maximumStock > 0
          ? Math.min(100, Math.round((detailMaterial.currentStock / detailMaterial.maximumStock) * 100))
          : 0;
        const matTxns = (txnsByMaterial.get(detailMaterial.name) ?? [])
          .slice()
          .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
          .slice(0, 15);
        return (
          <div className="mo open" onClick={(e) => e.target === e.currentTarget && setDetailMaterial(null)}>
            <div className="mc" style={{ maxWidth: 620, width: "100%" }}>
              <div className="mh">
                <h3>{detailMaterial.name}</h3>
                <button className="mx" type="button" onClick={() => setDetailMaterial(null)}>×</button>
              </div>
              {/* Stock info */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, padding: "16px 24px 0" }}>
                {[
                  { label: "Одоогийн нөөц", value: formatValue(detailMaterial.currentStock, detailMaterial.unit), color: tone.color },
                  { label: "Доод хязгаар", value: formatValue(detailMaterial.minimumStock, detailMaterial.unit), color: "var(--muted)" },
                  { label: "Дүүргэлт", value: `${fillPct}%`, color: tone.color },
                ].map(s => (
                  <div key={s.label} style={{ padding: "10px 14px", borderRadius: 10, background: "var(--base3)", textAlign: "center" }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Fill bar */}
              <div style={{ padding: "12px 24px 0" }}>
                <div style={{ height: 8, borderRadius: 999, background: "var(--base3)", overflow: "hidden" }}>
                  <div style={{ width: `${fillPct}%`, height: "100%", borderRadius: 999, background: tone.color, transition: "width 0.4s" }} />
                </div>
              </div>
              {/* Transactions with notes */}
              <div style={{ padding: "16px 24px 0", fontWeight: 700, fontSize: 12, color: "var(--text)" }}>
                Сүүлийн гүйлгээ ба тэмдэглэл
              </div>
              <div style={{ padding: "8px 24px 24px", maxHeight: 320, overflowY: "auto" }}>
                {matTxns.length === 0 ? (
                  <div style={{ color: "var(--muted)", fontSize: 12, padding: "20px 0", textAlign: "center" }}>Гүйлгээ байхгүй байна</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        {["Огноо", "Төрөл", "Хэмжээ", "Нэмэлт тайлбар", "Хэн"].map(h => (
                          <th key={h} style={{ padding: "6px 8px", textAlign: "left", color: "var(--muted)", fontWeight: 600, fontSize: 11 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matTxns.map(t => (
                        <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px 8px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                            {t.transactionDate.slice(0, 10)}
                          </td>
                          <td style={{ padding: "8px 8px" }}>
                            <span style={{
                              padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                              background: t.type === "IN" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.1)",
                              color: t.type === "IN" ? "#10B981" : "#EF4444",
                            }}>
                              {t.type === "IN" ? "Орлого" : "Зарлага"}
                            </span>
                          </td>
                          <td style={{ padding: "8px 8px", fontWeight: 700, color: "var(--text)" }}>
                            {t.quantity.toLocaleString("mn-MN")} {detailMaterial.unit}
                          </td>
                          <td style={{ padding: "8px 8px", color: t.note ? "var(--text)" : "var(--muted)", fontStyle: t.note ? "normal" : "italic" }}>
                            {t.note ?? "—"}
                          </td>
                          <td style={{ padding: "8px 8px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                            {t.createdBy.fullName}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {canEdit ? (
                <div style={{ padding: "0 24px 20px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button className="btn bo2" type="button" onClick={() => setDetailMaterial(null)}>Хаах</button>
                  <button className="btn bp" type="button" onClick={() => { setDetailMaterial(null); setMaterialName(detailMaterial.name); setModal(true); }}>+ Орлого / Зарлага</button>
                </div>
              ) : (
                <div style={{ padding: "0 24px 20px", display: "flex", justifyContent: "flex-end" }}>
                  <button className="btn bo2" type="button" onClick={() => setDetailMaterial(null)}>Хаах</button>
                </div>
              )}
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}
