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
import { DeptTopbar } from "@/components/DeptTopbar";
import { KpiCard } from "@/components/KpiCard";
import { ChartHint, RealtimeBadge, REALTIME_REFRESH_MS } from "@/components/RealtimeBadge";

type ProductionLog = {
  id: string;
  lotNumber: string;
  productionDate: string;
  productName: string;
  outputQuantity: number;
  scheduledDate: string | null;
  destinationMine: string | null;
  status: string;
  workerInfo: string | null;
  density: number | null;
  note: string | null;
  createdBy: { fullName: string };
  material: { name: string; unit: string };
};

type Material = { id: string; name: string; unit: string };
type ProductionPlan = {
  id: string;
  planDate: string;
  targetQuantity: number;
};

const PRODUCTS = [
  "ANDO-V 90MM","ANDO-V 120MM","ANDO-V 60MM",
  "ANDO-EV 32MM","ANDO-EV 25MM","ANDO-SPLIT 38MM",
] as const;

const PRODUCT_COLORS: Record<string, string> = {
  "ANDO-V 90MM": "#10B981","ANDO-V 120MM": "#3B82F6","ANDO-V 60MM": "#F59E0B",
  "ANDO-EV 32MM": "#A78BFA","ANDO-EV 25MM": "#14B8A6","ANDO-SPLIT 38MM": "#F97316",
};
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

function buildDailySeries(logs: ProductionLog[], plans: ProductionPlan[]) {
  const now = new Date();
  const pts = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - 6 + i);
    return { key: d.toISOString().slice(0,10), date:`${d.getMonth()+1}/${d.getDate()}`, produced:0, shipment:0, target:null as number | null };
  });
  const map = new Map(pts.map(p=>[p.key,p]));
  for (const l of logs) {
    const b = map.get(l.productionDate.slice(0,10));
    if (b) b.produced += l.outputQuantity;
    if (l.scheduledDate) { const s = map.get(l.scheduledDate.slice(0,10)); if (s) s.shipment += l.outputQuantity; }
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
      if (shipmentRow) shipmentRow.shipment += log.outputQuantity;
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
  const [shipmentTargetLogId, setShipmentTargetLogId] = useState("");
  const [shipmentProductName, setShipmentProductName] = useState("");
  const [shipmentAmount, setShipmentAmount] = useState("");
  const [shipmentAmountUnit, setShipmentAmountUnit] = useState<"kg" | "ton">("ton");
  const [shipmentDate, setShipmentDate] = useState("");
  const [shipmentDestinationMine, setShipmentDestinationMine] = useState(MINE_OPTIONS[0]);
  const [shipmentError, setShipmentError] = useState("");
  const [savingShipmentDate, setSavingShipmentDate] = useState(false);
  const [deletingLog, setDeletingLog] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [tableSearch, setTableSearch] = useState("");
  const [tablePage, setTablePage] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [productName, setProductName] = useState<(typeof PRODUCTS)[number]>("ANDO-V 90MM");
  const [productionDate, setProductionDate] = useState(toDateInputValue());
  const [amount, setAmount] = useState("");
  const [amountUnit, setAmountUnit] = useState<"kg"|"ton">("kg");
  const [dailyTarget, setDailyTarget] = useState("");
  const [dailyTargetUnit, setDailyTargetUnit] = useState<"kg"|"ton">("kg");
  const [destinationMine, setDestinationMine] = useState(MINE_OPTIONS[0]);
  const [workerInfo, setWorkerInfo] = useState("");
  const [density, setDensity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: logsData, isLoading: logsLoading, mutate: mutateLogs } = useSWR(
    "/api/production-logs?limit=180",
    fetcher,
    { refreshInterval: REALTIME_REFRESH_MS, revalidateOnFocus: false, onSuccess: () => setLastUpdated(new Date()) }
  );
  const { data: materialsData, isLoading: materialsLoading, mutate: mutateMaterials } = useSWR(
    "/api/materials",
    fetcher,
    { refreshInterval: REALTIME_REFRESH_MS, revalidateOnFocus: false }
  );

  const logs: ProductionLog[] = useMemo(() => logsData?.data ?? [], [logsData]);
  const productionPlans: ProductionPlan[] = useMemo(() => logsData?.plans ?? [], [logsData]);
  const materials: Material[] = useMemo(() => materialsData?.data ?? [], [materialsData]);
  const loading = logsLoading || materialsLoading;
  const selectedMaterialId = materials[0]?.id || "";

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

  function openCreateModal(product: (typeof PRODUCTS)[number] = "ANDO-V 90MM") {
    setProductName(product);
    setProductionDate(toDateInputValue());
    setAmount("");
    setAmountUnit("kg");
    setDailyTarget("");
    setDailyTargetUnit("kg");
    setDestinationMine(MINE_OPTIONS[0]);
    setWorkerInfo("");
    setDensity("");
    setNote("");
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
    const dailyTargetQty = dailyTarget.trim() ? toKg(dailyTarget, dailyTargetUnit) : null;
    const densityValue = density.trim() ? Number(density) : null;
    if (!qty) { setError("Үйлдвэрлэсэн хэмжээг зөв оруулна уу"); return; }
    if (dailyTarget.trim() && !dailyTargetQty) { setError("Өдрийн үйлдвэрлэлийн төлөвлөгөөг зөв оруулна уу"); return; }
    if (densityValue === null || !Number.isFinite(densityValue) || densityValue <= 0) { setError("Нягтын утгыг заавал зөв оруулна уу"); return; }
    if (!selectedMaterialId) { setError("Материал сонгогдоогүй байна"); return; }
    setSubmitting(true); setError("");
    const res = await fetch("/api/production-logs", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ lotNumber:makeLotNumber(), productionDate, productName, outputQuantity:qty, dailyTargetQuantity:dailyTargetQty, destinationMine, materialId:selectedMaterialId, workerInfo:workerInfo.trim()||null, density:densityValue, note:note||null }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error??"Алдаа гарлаа"); setSubmitting(false); return; }
    setModal(false); setSubmitting(false); setAmount(""); setDailyTarget(""); setWorkerInfo(""); setDensity(""); setNote("");
    await Promise.all([mutateLogs(), mutateMaterials()]);
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
    setShipmentTargetLogId(log?.id ?? "");
    setShipmentProductName(log?.productName ?? PRODUCTS[0]);
    if (log && log.outputQuantity >= 1000) {
      const tons = log.outputQuantity / 1000;
      setShipmentAmount(tons % 1 === 0 ? String(tons) : String(Number(tons.toFixed(1))));
      setShipmentAmountUnit("ton");
    } else if (log) {
      setShipmentAmount(String(log.outputQuantity));
      setShipmentAmountUnit("kg");
    } else {
      setShipmentAmount("");
      setShipmentAmountUnit("ton");
    }
    const scheduledKey = log?.scheduledDate?.slice(0,10);
    setShipmentDate(scheduledKey && scheduledKey >= todayKey ? scheduledKey : todayKey);
    setShipmentDestinationMine(log?.destinationMine ?? MINE_OPTIONS[0]);
    setShipmentError("");
  }

  function openShipmentDateModal(log: ProductionLog | null) {
    applyShipmentForm(log);
    setShipmentModal(true);
  }

  function closeShipmentModal() {
    setShipmentModal(false);
    setShipmentLog(null);
    setShipmentTargetLogId("");
    setShipmentProductName("");
    setShipmentAmount("");
    setShipmentAmountUnit("ton");
    setShipmentDate("");
    setShipmentDestinationMine(MINE_OPTIONS[0]);
    setShipmentError("");
  }

  function changeShipmentTarget(logId: string) {
    const log = logs.find((item) => item.id === logId) ?? null;
    applyShipmentForm(log);
  }

  async function saveShipmentDate() {
    if (!canEdit) {
      setShipmentError("Ачилт хадгалах эрхгүй байна");
      return;
    }
    if (!shipmentLog) {
      setShipmentError("Ачилт холбох үйлдвэрлэлийн бүртгэл сонгоно уу");
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
    if (!shipmentDestinationMine.trim()) {
      setShipmentError("Очих газар оруулна уу");
      return;
    }
    const shipmentQuantity = toKg(shipmentAmount, shipmentAmountUnit);
    if (!shipmentQuantity) {
      setShipmentError("Ачилтын хэмжээг зөв оруулна уу");
      return;
    }

    setSavingShipmentDate(true);
    setShipmentError("");
    const res = await fetch("/api/production-logs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: shipmentLog.id,
        productName: shipmentProductName.trim(),
        outputQuantity: shipmentQuantity,
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
  const upcomingShipments = useMemo(
    () => logs
      .filter(l=>l.scheduledDate && l.scheduledDate.slice(0,10) >= todayKey)
      .sort((a,b)=>a.scheduledDate!.slice(0,10).localeCompare(b.scheduledDate!.slice(0,10))),
    [logs, todayKey]
  );
  const pendingCount = upcomingShipments.length;
  const nextShipmentLog = upcomingShipments[0] ?? null;
  const nextShipmentDate = nextShipmentLog?.scheduledDate?.slice(0,10) ?? "—";
  const nextShipmentDays = nextShipmentLog
    ? Math.max(0, Math.round((new Date(nextShipmentDate).getTime() - new Date(todayKey).getTime()) / 86400000))
    : null;
  const nextShipmentSummary = nextShipmentLog
    ? `${nextShipmentLog.productName} · ${fmtDisplay(nextShipmentLog.outputQuantity)}${nextShipmentLog.destinationMine ? ` · ${nextShipmentLog.destinationMine}` : ""}`
    : "Ачигдах бүртгэл алга";
  const shipmentEditableLog = nextShipmentLog
    ?? logs.find((log) => !log.scheduledDate || log.scheduledDate.slice(0,10) < todayKey)
    ?? logs[0]
    ?? null;
  const shipmentReadyTotal = useMemo(
    () => upcomingShipments.reduce((s,l)=>s+l.outputQuantity,0),
    [upcomingShipments]
  );

  const dailySeries = useMemo(()=>buildDailySeries(logs, productionPlans),[logs, productionPlans]);
  const avgDaily = Math.max(Math.round(dailySeries.reduce((s,d)=>s+d.produced,0)/dailySeries.length), 200);
  const todayPoint = useMemo(()=>dailySeries.find(d=>d.key===todayKey),[dailySeries, todayKey]);
  const todayTarget = typeof todayPoint?.target === "number" ? todayPoint.target : 0;
  const todayProgressPct = todayTarget > 0 ? Math.min(100, Math.round((todayProduced / todayTarget) * 100)) : 0;

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
  const reportShipmentTotal = reportShipments.reduce((sum, log) => sum + log.outputQuantity, 0);
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
      const shipped = productShipments.reduce((sum, log) => sum + log.outputQuantity, 0);
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

        {/* Production Status Banner */}
        <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
          <div style={{
            flex:"1 1 220px", padding:"12px 16px", borderRadius:12,
            border:`1px solid ${todayProduced>=avgDaily*1.2?"rgba(16,185,129,0.28)":todayProduced>=avgDaily*0.5?"rgba(245,158,11,0.28)":"rgba(239,68,68,0.28)"}`,
            background:todayProduced>=avgDaily*1.2?"rgba(16,185,129,0.06)":todayProduced>=avgDaily*0.5?"rgba(245,158,11,0.06)":"rgba(239,68,68,0.06)",
            display:"flex",alignItems:"center",gap:12,
          }}>
            <span style={{fontSize:16}}>{todayProduced>=avgDaily*1.2?"🟢":todayProduced>=avgDaily*0.5?"🟠":"🔴"}</span>
            <div>
              <div style={{fontSize:12,fontWeight:800,color:todayProduced>=avgDaily*1.2?"#10B981":todayProduced>=avgDaily*0.5?"#F59E0B":"#EF4444"}}>
                ӨНӨӨДРИЙН ГАРЦ: {fmtKg(todayProduced)}
              </div>
              <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>
                {todayProduced>=avgDaily*1.2?"Зорилго биелсэн — маш сайн!":todayProduced>=avgDaily*0.5?"Хэвийн явц":"Зорилгоос хоцорч байна"}
              </div>
            </div>
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={()=>openShipmentDateModal(shipmentEditableLog)}
            onKeyDown={(event)=>{
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openShipmentDateModal(shipmentEditableLog);
              }
            }}
            style={{flex:"1 1 260px",padding:"12px 16px",borderRadius:12,border:"1px solid rgba(59,130,246,0.24)",background:"rgba(59,130,246,0.06)",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}
          >
            <span style={{fontSize:16}}>🚚</span>
            <div style={{minWidth:0}}>
              <div style={{fontSize:12,fontWeight:800,color:"#3B82F6"}}>
                ДАРААГИЙН АЧИЛТ: {nextShipmentDate}
              </div>
              <div style={{fontSize:11,color:"var(--muted)",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                {nextShipmentLog ? `${nextShipmentSummary} · ${nextShipmentDays===0?"өнөөдөр":`${nextShipmentDays} хоногийн дараа`}` : "Ачигдах бүртгэл алга"}
              </div>
            </div>
          </div>
          <div style={{flex:"0 0 auto",padding:"12px 16px",borderRadius:12,border:"1px solid rgba(16,185,129,0.22)",background:"rgba(16,185,129,0.05)",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:16}}>🟢</span>
            <div>
              <div style={{fontSize:12,fontWeight:800,color:"#10B981"}}>СИСТЕМИЙН ТӨЛӨВ: ТОГТВОРТОЙ</div>
              <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>Үйлдвэрлэл хэвийн ажиллаж байна</div>
            </div>
          </div>
        </div>

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
                <div className="panel-title">Үйлдвэрлэлт, төлөвлөгөө ба ачилт (14 хоног)</div>
                <div className="panel-sub">Өдрийн төлөвлөгөө, бодит гарц, ачигдах өдрийн харьцуулалт</div>
              </div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                {[["#10B981","Үйлдвэрлэл"],["#3B82F6","Ачилт"],["#64748B","Төлөвлөгөө"]].map(([c,l])=>(
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
              <div style={{minWidth:180,flex:"1 1 220px"}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:12,fontSize:11,color:"var(--muted)",marginBottom:6}}>
                  <span>ӨНӨӨДРИЙН ТӨЛӨВЛӨГӨӨ</span>
                  <strong style={{color:todayTarget>0?"#10B981":"var(--muted)"}}>{todayTarget>0 ? `${todayProgressPct}%` : "—"}</strong>
                </div>
                <div style={{height:9,borderRadius:999,background:"var(--base3,#f1f5f9)",overflow:"hidden"}}>
                  <div style={{width:`${todayProgressPct}%`,height:"100%",background:"#10B981",borderRadius:999,transition:"width .35s ease"}}/>
                </div>
                <div style={{fontSize:11,color:"var(--muted)",marginTop:5}}>
                  {todayTarget>0 ? `${fmtDisplay(todayProduced)} / ${fmtDisplay(todayTarget)}` : "Төлөвлөгөө бүртгээгүй"}
                </div>
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
                  <Area type="monotone" dataKey="target" name="Төлөвлөгөө" stroke="#64748B" strokeDasharray="5 4" strokeWidth={2} fillOpacity={0} dot={{r:3,fill:"#64748B"}} activeDot={{r:5}} isAnimationActive={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <ChartHint>Ногоон нь үйлдвэрлэсэн хэмжээ, цэнхэр нь ачилт, саарал тасархай шугам нь өдрийн төлөвлөгөө. Мэдээлэл 5 секунд тутам шинэчлэгдэнэ.</ChartHint>
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
            <div style={{borderTop:"1px solid var(--border)",overflowX:"auto"}}>
              <table className="safety-table wh-table">
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
                      <td colSpan={9} style={{padding:"32px 16px"}}>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
                          <span style={{fontSize:32}}>🏭</span>
                          <div style={{fontWeight:700,color:"var(--text)",fontSize:14}}>Бүртгэл байхгүй</div>
                          <div style={{fontSize:12,color:"var(--muted)"}}>Одоогоор бүртгэл алга. Шинэ бүртгэл нэмж эхлэцгээе.</div>
                          {canEdit&&<button type="button" onClick={()=>openCreateModal()} style={{marginTop:4,padding:"6px 18px",borderRadius:8,border:"1px solid #10B981",background:"rgba(16,185,129,0.1)",color:"#10B981",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Бүртгэл нэмэх</button>}
                        </div>
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
                          <button type="button" onClick={()=>openLogDetails(l)} style={{padding:"4px 10px",borderRadius:7,border:"1px solid var(--border)",background:"transparent",color:"var(--muted)",fontSize:10,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
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
                  {icon:"📋",label:"PDF",color:"#EF4444"},
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

            {/* Alert panel — richer context */}
            <div className="panel" style={{padding:20,flex:1}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <div className="panel-title">Анхааруулга</div>
                {alerts.length>0 && (
                  <span style={{background:"#EF4444",color:"#fff",borderRadius:999,fontSize:10,fontWeight:800,padding:"2px 7px"}}>{alerts.length}</span>
                )}
              </div>
              {alerts.length===0 ? (
                <div style={{color:"var(--muted)",fontSize:12,textAlign:"center",padding:"20px 0"}}>✅ Анхааруулга байхгүй</div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {alerts.map((a,i)=>(
                    <div key={i} style={{
                      padding:"11px 12px", borderRadius:10,
                      border:`1px solid ${a.type==="crit"?"rgba(239,68,68,.25)":"rgba(245,158,11,.25)"}`,
                      background: a.type==="crit"?"rgba(239,68,68,.05)":"rgba(245,158,11,.05)",
                    }}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:8}}>
                        <span style={{fontSize:15,flexShrink:0,marginTop:1}}>{a.type==="crit"?"🚨":"⚠️"}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:800,color:a.type==="crit"?"#EF4444":"#F59E0B",marginBottom:2}}>{a.name}</div>
                          <div style={{fontSize:11,color:"var(--text)",fontWeight:600,marginBottom:2}}>{a.msg}</div>
                          <div style={{fontSize:10,color:"var(--muted)",lineHeight:1.4}}>{a.detail}</div>
                        </div>
                      </div>
                      {canEdit && (
                        <button type="button" onClick={()=>openCreateModal(a.name as (typeof PRODUCTS)[number])} style={{
                          width:"100%", padding:"6px 10px", borderRadius:7,
                          border:`1px solid ${a.type==="crit"?"rgba(239,68,68,.35)":"rgba(245,158,11,.35)"}`,
                          background: a.type==="crit"?"rgba(239,68,68,.09)":"rgba(245,158,11,.09)",
                          color: a.type==="crit"?"#EF4444":"#F59E0B",
                          fontSize:10, fontWeight:800, cursor:"pointer",
                        }}>
                          {a.action}
                        </button>
                      )}
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
          aria-labelledby="production-report-title"
          onClick={(e) => e.target === e.currentTarget && setReportModal(false)}
        >
          <div className="mc" style={{ maxWidth: 1080, width: "100%", padding: 0 }} onClick={(e) => e.stopPropagation()}>
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
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                <button className="mx" type="button" aria-label="Тайлан хаах" onClick={() => setReportModal(false)}>×</button>
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
                  <table className="safety-table wh-table">
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
                  <table className="safety-table wh-table">
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
                    <div className="panel-title">14 хоногийн үйлдвэрлэлийн бүртгэл</div>
                    <div className="panel-sub" style={{ marginTop: 4 }}>Сүүлийн 20 бүртгэлийг огноогоор бууруулж харуулна.</div>
                  </div>
                  <span style={{ color: "var(--muted)", fontSize: 11 }}>{reportLogs.length} нийт бүртгэл</span>
                </div>
                <div style={{ maxHeight: 320, overflow: "auto" }}>
                  <table className="safety-table wh-table">
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
          <div className="mc" style={{width:"min(980px, 100%)",overflowY:"visible"}}>
            <div className="mh">
              <h3>Бүртгэл нэмэх</h3>
              <button className="mx" type="button" onClick={()=>setModal(false)}>×</button>
            </div>
            <form onSubmit={submitLog}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12}}>
                <div className="fg"><label>Бүтээгдэхүүн</label>
                  <select value={productName} onChange={e=>setProductName(e.target.value as (typeof PRODUCTS)[number])}>
                    {PRODUCTS.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="fg"><label>Үйлдвэрлэсэн өдөр</label>
                  <input type="date" value={productionDate} onChange={e=>setProductionDate(e.target.value)}/>
                </div>
                <div className="fg"><label>Өдөрт үйлдвэрлэх төлөвлөгөө</label>
                  <input type="number" min="0" step="0.1" value={dailyTarget} onChange={e=>setDailyTarget(e.target.value)} placeholder="Жишээ: 2500"/>
                </div>
                <div className="fg"><label>Төлөвлөгөөний нэгж</label>
                  <select value={dailyTargetUnit} onChange={e=>setDailyTargetUnit(e.target.value as "kg" | "ton")}>
                    <option value="kg">Кг</option><option value="ton">Тонн</option>
                  </select>
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
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div className="fg"><label>Ажилтнууд / MR код</label>
                  <textarea style={{height:112,minHeight:112,maxHeight:112,overflow:"hidden",resize:"none"}} value={workerInfo} onChange={e=>setWorkerInfo(e.target.value)} placeholder={"Жишээ:\nБат MR-0123\nСараа MR-0456"}/>
                </div>
                <div className="fg"><label>Тэмдэглэл</label>
                  <textarea style={{height:112,minHeight:112,maxHeight:112,overflow:"hidden",resize:"none"}} value={note} onChange={e=>setNote(e.target.value)} placeholder="Нэмэлт тайлбар"/>
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
                  Хэзээ, хаашаа, ямар бүтээгдэхүүн ачигдахыг гараар бүртгэнэ
                </div>
              </div>
              <button className="mx" type="button" onClick={closeShipmentModal}>×</button>
            </div>
            {logs.length === 0 ? (
              <div style={{padding:"16px",borderRadius:12,border:"1px solid rgba(245,158,11,0.28)",background:"rgba(245,158,11,0.08)",color:"var(--text)",fontSize:13,lineHeight:1.5}}>
                Ачилт төлөвлөхийн тулд эхлээд үйлдвэрлэлийн бүртгэл нэмнэ үү.
              </div>
            ) : (
              <>
                <div className="fg"><label>Холбох үйлдвэрлэлийн бүртгэл</label>
                  <select value={shipmentTargetLogId} onChange={e=>changeShipmentTarget(e.target.value)}>
                    {logs.map((log) => (
                      <option key={log.id} value={log.id}>
                        {log.productionDate.slice(0,10)} · {log.productName} · {fmtDisplay(log.outputQuantity)} · {log.destinationMine ?? "очих газаргүй"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="fg"><label>Ямар бүтээгдэхүүн ачигдах вэ?</label>
                  <input type="text" value={shipmentProductName} onChange={e=>setShipmentProductName(e.target.value)} placeholder="Жишээ: ANDO-EV 32MM"/>
                </div>
                <div className="fr2">
                  <div className="fg"><label>Ачилтын хэмжээ</label>
                    <input type="number" min="0" step="0.1" value={shipmentAmount} onChange={e=>setShipmentAmount(e.target.value)} placeholder="Жишээ: 25"/>
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
                      list="shipment-destination-options"
                      type="text"
                      value={shipmentDestinationMine}
                      onChange={e=>setShipmentDestinationMine(e.target.value)}
                      placeholder="Жишээ: Оюутолгой"
                    />
                    <datalist id="shipment-destination-options">
                      {MINE_OPTIONS.map((mine) => <option key={mine} value={mine} />)}
                    </datalist>
                  </div>
                </div>
                <div style={{padding:"10px 12px",borderRadius:10,border:"1px solid rgba(59,130,246,0.2)",background:"rgba(59,130,246,0.06)",fontSize:11,color:"var(--muted)",lineHeight:1.45}}>
                  Энэ мэдээлэл сонгосон үйлдвэрлэлийн бүртгэл дээр хадгалагдаж, “Дараагийн ачилт” карт болон хүснэгтэд харагдана.
                </div>
              </>
            )}
            {shipmentError && <div style={{color:"#f87171",fontSize:12,marginTop:10,marginBottom:8}}>{shipmentError}</div>}
            <div className="mf">
              <button className="btn bo2" type="button" onClick={closeShipmentModal}>Цуцлах</button>
              <button className="btn bp" type="button" onClick={saveShipmentDate} disabled={savingShipmentDate || logs.length === 0}>
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
