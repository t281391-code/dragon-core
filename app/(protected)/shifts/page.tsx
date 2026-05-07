"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { DashboardEmptyState, PriorityStatusBar } from "@/components/DashboardUX";
import { DeptTopbar } from "@/components/DeptTopbar";

type ShiftCode = "day" | "night" | "rest" | "leave" | "sick";

type ShiftEntry = { code: ShiftCode; ot: number };

type DbUser = {
  id: string;
  fullName: string;
  mrCode: string | null;
  role: { name: string };
  department: { name: string };
};

type SearchUser = {
  id: string;
  fullName: string;
  mrCode: string | null;
  role: { name: string };
  department: { name: string };
};

type UserSearchResponse = {
  data?: SearchUser[];
  users?: SearchUser[];
};

type DayWindow = { key: string; label: string; isToday: boolean };

type Schedule = Record<string, Record<string, ShiftEntry>>;
type OvertimeEditor = {
  userId: string;
  date: string;
  employeeName: string;
  dateLabel: string;
  value: string;
};

const DEPT_LABEL: Record<string, string> = {
  WAREHOUSE:  "Агуу",
  PRODUCTION: "Үйлд",
  SAFETY:     "ХЭАБО",
  LOGISTICS:  "Тээв",
};

const DB_DEPTS = ["PRODUCTION", "LOGISTICS", "SAFETY", "WAREHOUSE"] as const;

const SHIFT_META: Record<ShiftCode, { label: string; short: string; className: string; hours: number }> = {
  day:   { label: "Өдрийн",  short: "Ө",  className: "shift-day",   hours: 12 },
  night: { label: "Шөнийн",  short: "Ш",  className: "shift-night", hours: 12 },
  rest:  { label: "Амралт",  short: "A",  className: "shift-rest",  hours: 0 },
  leave: { label: "Чөлөө",   short: "Ч",  className: "shift-leave", hours: 0 },
  sick:  { label: "Өвчтэй",  short: "Өв", className: "shift-sick",  hours: 0 },
};

const SHIFT_ORDER: ShiftCode[] = ["day", "night", "rest", "leave", "sick"];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortDateLabel(key: string) {
  const [, month, day] = key.split("-").map(Number);
  return `${month}/${day}`;
}

function makeDateWindow(): DayWindow[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 6 + i);
    const key = dateKey(d);
    return { key, label: shortDateLabel(key), isToday: i === 6 };
  });
}

function nextShift(code: ShiftCode): ShiftCode {
  return SHIFT_ORDER[(SHIFT_ORDER.indexOf(code) + 1) % SHIFT_ORDER.length];
}

function userTotalHours(userId: string, days: DayWindow[], schedule: Schedule) {
  return days.reduce((sum, d) => {
    const entry = schedule[userId]?.[d.key];
    if (!entry) return sum;
    return sum + SHIFT_META[entry.code].hours + entry.ot;
  }, 0);
}

// ── DonutChart ────────────────────────────────────────────────────────────────
function DonutChart({ data, colors, size = 120 }: { data: number[]; colors: string[]; size?: number }) {
  const total = data.reduce((a, b) => a + b, 0) || 1;
  const cx = size / 2, cy = size / 2, r = size * 0.38, ir = size * 0.24;
  const arcs = data.map((value, index) => {
    const previous = data.slice(0, index).reduce((sum, item) => sum + item, 0);
    const start = -Math.PI / 2 + (previous / total) * 2 * Math.PI;
    const angle = (value / total) * 2 * Math.PI;
    return { angle, start, end: start + angle };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      {arcs.map(({ angle, start, end }, i) => {
        const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
        const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
        const x3 = cx + ir * Math.cos(end), y3 = cy + ir * Math.sin(end);
        const x4 = cx + ir * Math.cos(start), y4 = cy + ir * Math.sin(start);
        return (
          <path
            key={i}
            d={`M${x1},${y1} A${r},${r} 0 ${angle > Math.PI ? 1 : 0},1 ${x2},${y2} L${x3},${y3} A${ir},${ir} 0 ${angle > Math.PI ? 1 : 0},0 ${x4},${y4} Z`}
            fill={colors[i]}
          />
        );
      })}
    </svg>
  );
}

// ── ScheduleCharts ────────────────────────────────────────────────────────────
function ScheduleCharts({
  users,
  days,
  schedule,
}: {
  users: DbUser[];
  days: DayWindow[];
  schedule: Schedule;
}) {
  const todayDay = days.find((d) => d.isToday)!;

  const dailyCounts = days.map((d) => ({
    day:   users.filter((u) => (schedule[u.id]?.[d.key]?.code ?? "rest") === "day").length,
    night: users.filter((u) => (schedule[u.id]?.[d.key]?.code ?? "rest") === "night").length,
  }));

  const tdDay   = users.filter((u) => (schedule[u.id]?.[todayDay.key]?.code ?? "rest") === "day").length;
  const tdNight = users.filter((u) => (schedule[u.id]?.[todayDay.key]?.code ?? "rest") === "night").length;
  const tdOff   = users.length - tdDay - tdNight;
  const total   = users.length || 1;
  const maxCount = Math.max(...dailyCounts.map((d) => d.day + d.night), 1);

  return (
    <div className="shift-hours-two-col" style={{ marginBottom: 16 }}>
      <div className="panel" style={{ padding: "14px 18px" }}>
        <div style={{ fontWeight: 600, marginBottom: 2, fontSize: 13 }}>Багийн ирц — 14 хоног</div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>Өдөр тутмын ажилтны тоо</div>
        <svg viewBox="0 0 380 130" style={{ width: "100%", height: 130 }}>
          {[0, 0.5, 1].map((t, i) => (
            <line key={i} x1={0} x2={380} y1={10 + t * 100} y2={10 + t * 100} stroke="var(--border)" strokeWidth={0.5} />
          ))}
          {days.map((day, i) => {
            const { day: dw, night: nw } = dailyCounts[i];
            const x = i * 27 + 2;
            const dayH   = (dw / maxCount) * 100;
            const nightH = (nw / maxCount) * 100;
            return (
              <g key={i}>
                {nightH > 0 && <rect x={x} y={110 - dayH - nightH} width={22} height={nightH} fill="#3b82f6" rx={3} opacity={day.isToday ? 1 : 0.75} />}
                {dayH   > 0 && <rect x={x} y={110 - dayH}          width={22} height={dayH}   fill="#f59e0b" rx={3} opacity={day.isToday ? 1 : 0.75} />}
                <text x={x + 11} y={126} textAnchor="middle" fontSize={8} fill={day.isToday ? "#f59e0b" : "var(--muted)"}>
                  {day.label.split("/")[1]}
                </text>
                {(dw + nw) > 0 && (
                  <text x={x + 11} y={106 - dayH - nightH} textAnchor="middle" fontSize={8} fill="#94a3b8">{dw + nw}</text>
                )}
              </g>
            );
          })}
        </svg>
        <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
          {[["Өдрийн", "#f59e0b"], ["Шөнийн", "#3b82f6"]].map(([l, c]) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ display: "inline-block", width: 10, height: 10, background: c, borderRadius: 2 }} />
              {l}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="panel" style={{ padding: "14px 18px" }}>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>Өнөөдрийн хуваарилалт</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <DonutChart
              data={[Math.max(tdDay, 0.01), Math.max(tdNight, 0.01), Math.max(tdOff, 0.01)]}
              colors={["#f59e0b", "#3b82f6", "#64748b"]}
              size={120}
            />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              {([
                ["Өдрийн ээлж",   "#f59e0b", `${tdDay} хүн`],
                ["Шөнийн ээлж",   "#3b82f6", `${tdNight} хүн`],
                ["Амралт/Өвчтэй", "#64748b", `${tdOff} хүн`],
              ] as [string, string, string][]).map(([label, color, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />
                    {label}
                  </span>
                  <span style={{ color, fontWeight: 700 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel" style={{ padding: "14px 18px" }}>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>KPI үзүүлэлт</div>
          {([
            { label: "Өдрийн ирц",    pct: Math.round(tdDay   / total * 100), color: "#f59e0b" },
            { label: "Шөнийн ирц",    pct: Math.round(tdNight / total * 100), color: "#3b82f6" },
            { label: "Чөлөө/Өвчтэй", pct: Math.round(tdOff   / total * 100), color: "#ef4444" },
          ]).map(({ label, pct, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 128, fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
              <div style={{ flex: 1, height: 6, background: "var(--base3)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
              </div>
              <div style={{ width: 44, textAlign: "right", fontSize: 12, color, fontWeight: 600 }}>{pct}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── AddParticipantModal ───────────────────────────────────────────────────────
function AddParticipantModal({
  existingIds,
  onAdd,
  onClose,
}: {
  existingIds: Set<string>;
  onAdd: (user: SearchUser) => void;
  onClose: () => void;
}) {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) { setResults([]); return; }
    setLoading(true);
    fetch(`/api/users?q=${encodeURIComponent(trimmed)}`)
      .then((r) => r.json())
      .then((data: UserSearchResponse | SearchUser[]) => {
        if (Array.isArray(data)) {
          setResults(data);
          return;
        }

        setResults(data.data ?? data.users ?? []);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, search]);

  const filtered = results.filter((u) => !existingIds.has(u.id));

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.55)", display: "flex",
        alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--base2)", border: "1px solid var(--border)",
          borderRadius: 14, padding: "20px 22px", width: 360, maxWidth: "94vw",
          boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <strong style={{ fontSize: 14 }}>Ажилтан нэмэх</strong>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Нэрээр хайх..."
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "8px 12px", borderRadius: 8,
            border: "1px solid var(--border)", background: "var(--base3)",
            color: "var(--text)", fontSize: 13, outline: "none",
          }}
        />

        <div style={{ marginTop: 10, maxHeight: 260, overflowY: "auto" }}>
          {loading && (
            <div style={{ padding: "10px 0", color: "var(--muted)", fontSize: 12, textAlign: "center" }}>
              Хайж байна…
            </div>
          )}
          {!loading && query.trim() && filtered.length === 0 && (
            <div style={{ padding: "10px 0", color: "var(--muted)", fontSize: 12, textAlign: "center" }}>
              Ажилтан олдсонгүй
            </div>
          )}
          {filtered.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onAdd(u)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", padding: "9px 10px", borderRadius: 8, marginBottom: 4,
                background: "var(--base3)", border: "1px solid var(--border)",
                color: "var(--text)", cursor: "pointer", textAlign: "left",
                fontSize: 13,
              }}
            >
              <span>
                <span style={{ fontWeight: 600 }}>{u.fullName}</span>
                {u.mrCode && <span style={{ color: "var(--muted)", fontSize: 11, marginLeft: 6 }}>{u.mrCode}</span>}
              </span>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {DEPT_LABEL[u.department.name] ?? u.department.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ShiftsPage() {
  const { user: me } = useAuth();
  const days = useMemo(() => makeDateWindow(), []);
  const today = days.find((d) => d.isToday)!;

  const [users, setUsers]         = useState<DbUser[]>([]);
  const [schedule, setSchedule]   = useState<Schedule>({});
  const [loading, setLoading]     = useState(true);
  const [fetchErr, setFetchErr]   = useState("");
  const [filter, setFilter]       = useState("all");
  const [search, setSearch]       = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [overtimeEditor, setOvertimeEditor] = useState<OvertimeEditor | null>(null);

  const canEdit = me?.role === "MODERATOR" || me?.role === "ADMIN";

  const fetchData = useCallback(() => {
    const from = days[0].key;
    const to   = days[days.length - 1].key;
    setLoading(true);
    setFetchErr("");
    fetch(`/api/shifts?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users ?? []);
        const sched: Schedule = {};
        for (const e of (data.entries ?? [])) {
          if (!sched[e.userId]) sched[e.userId] = {};
          sched[e.userId][e.date] = { code: e.shiftCode as ShiftCode, ot: e.overtimeHours ?? 0 };
        }
        setSchedule(sched);
      })
      .catch(() => setFetchErr("Өгөгдөл ачаалахад алдаа гарлаа"))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function getEntry(userId: string, date: string): ShiftEntry {
    return schedule[userId]?.[date] ?? { code: "rest", ot: 0 };
  }

  async function cycleShift(userId: string, date: string) {
    if (!canEdit) return;
    const current = getEntry(userId, date);
    const nextCode = nextShift(current.code);
    const nextOt = (nextCode === "day" || nextCode === "night") ? current.ot : 0;
    setSchedule((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] ?? {}), [date]: { code: nextCode, ot: nextOt } },
    }));
    fetch("/api/shifts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, date, shiftCode: nextCode, overtimeHours: nextOt }),
    }).catch(() => {
      setSchedule((prev) => ({
        ...prev,
        [userId]: { ...(prev[userId] ?? {}), [date]: current },
      }));
    });
  }

  async function setOvertime(userId: string, date: string, overtimeHours: number) {
    if (!canEdit) return;
    const current = getEntry(userId, date);
    const nextOt = Math.min(Math.max(Math.floor(overtimeHours), 0), 24);
    setSchedule((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] ?? {}), [date]: { ...current, ot: nextOt } },
    }));
    try {
      const response = await fetch("/api/shifts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, date, shiftCode: current.code, overtimeHours: nextOt }),
      });
      if (!response.ok) throw new Error("Failed to save overtime");
    } catch {
      setSchedule((prev) => ({
        ...prev,
        [userId]: { ...(prev[userId] ?? {}), [date]: current },
      }));
    }
  }

  function openOvertimeEditor(user: DbUser, day: DayWindow, entry: ShiftEntry) {
    setOvertimeEditor({
      userId: user.id,
      date: day.key,
      employeeName: user.fullName,
      dateLabel: day.label,
      value: String(entry.ot),
    });
  }

  async function saveOvertimeEditor() {
    if (!overtimeEditor) return;
    await setOvertime(overtimeEditor.userId, overtimeEditor.date, Number(overtimeEditor.value || 0));
    setOvertimeEditor(null);
  }

  async function addParticipant(user: SearchUser) {
    setShowAddModal(false);
    const res = await fetch("/api/shifts/participants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    if (res.ok) {
      setUsers((prev) => {
        if (prev.some((u) => u.id === user.id)) return prev;
        return [...prev, user].sort((a, b) => a.fullName.localeCompare(b.fullName));
      });
    }
  }

  async function removeParticipant(userId: string) {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    const res = await fetch("/api/shifts/participants", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      // revert
      fetchData();
    }
  }

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((u) => {
      const deptMatch   = filter === "all" || u.department.name === filter;
      const searchMatch = !query || u.fullName.toLowerCase().includes(query);
      return deptMatch && searchMatch;
    });
  }, [users, filter, search]);

  const todayCounts = useMemo(() => {
    const counts = { day: 0, night: 0, rest: 0, leave: 0, sick: 0 } as Record<ShiftCode, number>;
    for (const u of users) counts[getEntry(u.id, today.key).code] += 1;
    return counts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, schedule, today.key]);

  const workingToday = todayCounts.day + todayCounts.night;
  const absentToday  = todayCounts.leave + todayCounts.sick;
  const priorityTone = absentToday > 0 ? "warning" : workingToday === 0 ? "critical" : "normal";
  const prioritySummary =
    priorityTone === "critical"
      ? "Өнөөдөр ажиллах ээлж бүртгэгдээгүй байна."
      : priorityTone === "warning"
        ? `${absentToday} ажилтан чөлөөтэй эсвэл өвчтэй байна.`
        : "Өнөөдрийн ээлж хэвийн бүртгэгдсэн байна.";

  const existingIds = useMemo(() => new Set(users.map((u) => u.id)), [users]);

  return (
    <div className="department-shifts">
      <DeptTopbar icon="⛏" title="Ээлжийн бүртгэл" />
      <div className="content">
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 18, display: "flex", alignItems: "center", gap: 6 }}>
          <span>Нүүр хуудас</span>
          <span style={{ opacity: 0.4 }}>›</span>
          <span style={{ color: "var(--text)", fontWeight: 700 }}>Ээлжийн бүртгэл</span>
        </div>

        {fetchErr && (
          <div style={{ padding: "16px 18px", borderRadius: 10, background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.35)", color: "#f87171", fontSize: 13, marginBottom: 16 }}>
            ⚠ {fetchErr}
          </div>
        )}

        <PriorityStatusBar
          tone={priorityTone}
          title={priorityTone === "normal" ? "Ээлж хэвийн" : "Ээлж анхаарал шаардсан"}
          summary={prioritySummary}
          attention={absentToday > 0 ? "Орлуулах хүн" : "Анхаарах зүйлгүй"}
          action={priorityTone === "critical" ? "Ажилтан ээлж тохируулна уу" : "Өнөөдрийн ээлжийг баталгаажуулах"}
          metrics={[
            { label: "Өдрийн",         value: todayCounts.day,   tone: todayCounts.day > 0 ? "normal" : "warning" },
            { label: "Шөнийн",         value: todayCounts.night, tone: todayCounts.night > 0 ? "normal" : "warning" },
            { label: "Чөлөө / өвчтэй", value: absentToday,       tone: absentToday > 0 ? "warning" : "normal" },
          ]}
        />

        <ScheduleCharts users={users} days={days} schedule={schedule} />

        {/* Toolbar */}
        <div className="shift-toolbar">
          <div className="shift-legend" aria-label="Ээлжийн тэмдэглэгээ">
            {SHIFT_ORDER.map((code) => (
              <div key={code} className={`shift-pill ${SHIFT_META[code].className}`}>
                <span>{SHIFT_META[code].short}</span>
                {SHIFT_META[code].label}
              </div>
            ))}
          </div>
          <div className="shift-filters">
            <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Бүгд</button>
            {DB_DEPTS.map((dept) => (
              <button key={dept} type="button" className={filter === dept ? "active" : ""} onClick={() => setFilter(dept)}>
                {DEPT_LABEL[dept]}
              </button>
            ))}
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Хайх..." />
          </div>
        </div>

        {/* Grid */}
        <div className="panel shift-panel">
          <div className="shift-panel-head">
            <div>
              <div className="panel-title">Ажилтны ээлжийн хүснэгт</div>
              <div className="panel-sub">
                {canEdit
                  ? "Нүдэн дээр дарж ээлж солих · Улаан тэмдэг = илүү цаг"
                  : "Зөвхөн харах — ээлж засах эрх байхгүй"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                Нийт <strong style={{ color: "var(--text)" }}>{users.length}</strong> ажилтан
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  style={{
                    padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(34,197,94,.4)",
                    background: "rgba(34,197,94,.1)", color: "#22c55e",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  + Ажилтан нэмэх
                </button>
              )}
            </div>
          </div>
          <div className="shift-grid-wrap">
            {loading ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                Ачаалж байна…
              </div>
            ) : (
              <table className="safety-table shift-table">
                <thead>
                  <tr>
                    <th className="shift-col-worker">Ажилтан</th>
                    <th className="shift-col-dept">Хэлтэс</th>
                    {days.map((day) => (
                      <th key={day.key} className={`shift-col-day${day.isToday ? " is-today" : ""}`}>
                        <span>{day.label}</span>
                        {day.isToday ? <small>өнөөдөр</small> : null}
                      </th>
                    ))}
                    <th className="shift-col-total">Цаг</th>
                    {canEdit && <th style={{ width: 32 }} />}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr className="empty-row">
                      <td colSpan={days.length + (canEdit ? 4 : 3)} style={{ padding: 18 }}>
                        <DashboardEmptyState
                          icon="⛏"
                          title={users.length === 0 ? "Бүртгэлтэй ажилтан байхгүй" : "Ажилтан олдсонгүй"}
                          message={users.length === 0 ? "«Ажилтан нэмэх» товч ашиглан ажилтан нэмнэ үү." : "Хайлт эсвэл шүүлтүүрийг өөрчилнө үү."}
                          tone="normal"
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const hours = userTotalHours(u.id, days, schedule);
                      return (
                        <tr key={u.id}>
                          <td className="shift-col-worker">
                            <strong>{u.fullName}</strong>
                            {u.mrCode ? <div style={{ color: "var(--muted)", fontSize: 11 }}>{u.mrCode}</div> : null}
                          </td>
                          <td className="shift-col-dept">
                            <span className="shift-dept-chip">
                              {DEPT_LABEL[u.department.name] ?? u.department.name}
                            </span>
                          </td>
                          {days.map((day) => {
                            const entry = getEntry(u.id, day.key);
                            const meta  = SHIFT_META[entry.code];
                            const hasOt = entry.code === "day" || entry.code === "night";
                            return (
                              <td key={day.key} className={`shift-col-day${day.isToday ? " is-today" : ""}`}>
                                <div style={{ position: "relative", display: "inline-block" }}>
                                  <button
                                    type="button"
                                    className={`shift-cell ${meta.className}`}
                                    onClick={() => cycleShift(u.id, day.key)}
                                    disabled={!canEdit}
                                    style={!canEdit ? { cursor: "default", opacity: 0.75 } : undefined}
                                  >
                                    <span>{meta.short}</span>
                                    <small>{meta.hours ? `${meta.hours}ц` : ""}</small>
                                  </button>
                                  {hasOt && canEdit && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); openOvertimeEditor(u, day, entry); }}
                                      title="Илүү цаг оруулах"
                                      aria-label="Илүү цаг оруулах"
                                      style={{
                                        position: "absolute", top: -5, right: -5,
                                        background: entry.ot > 0 ? "#ef4444" : "var(--base3)",
                                        color: entry.ot > 0 ? "#fff" : "var(--muted)",
                                        border: `1px solid ${entry.ot > 0 ? "#ef4444" : "var(--border)"}`,
                                        borderRadius: 6, fontSize: 8, fontWeight: 800,
                                        padding: "1px 3px", cursor: "pointer",
                                        lineHeight: 1.4, minWidth: 14, textAlign: "center",
                                      }}
                                    >
                                      {entry.ot > 0 ? `+${entry.ot}` : "+"}
                                    </button>
                                  )}
                                  {hasOt && !canEdit && entry.ot > 0 && (
                                    <span
                                      style={{
                                        position: "absolute", top: -5, right: -5,
                                        background: "#ef4444", color: "#fff",
                                        borderRadius: 6, fontSize: 8, fontWeight: 800,
                                        padding: "1px 3px", lineHeight: 1.4, minWidth: 14, textAlign: "center",
                                      }}
                                    >
                                      +{entry.ot}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td className="shift-col-total">
                            <strong style={{ color: "#22C55E" }}>{hours}ц</strong>
                          </td>
                          {canEdit && (
                            <td style={{ textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => removeParticipant(u.id)}
                                title="Хасах"
                                style={{
                                  background: "none", border: "1px solid var(--border)",
                                  borderRadius: 6, color: "var(--muted)",
                                  fontSize: 14, lineHeight: 1, padding: "2px 6px",
                                  cursor: "pointer",
                                }}
                              >
                                ×
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {!canEdit && !loading && (
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
            Ээлж засах эрх авахын тулд менежер эрх шаардлагатай.
          </div>
        )}
      </div>

      {showAddModal && (
        <AddParticipantModal
          existingIds={existingIds}
          onAdd={addParticipant}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {overtimeEditor && (
        <div
          onClick={() => setOvertimeEditor(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.55)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); void saveOvertimeEditor(); }}
            style={{
              width: 320, maxWidth: "94vw",
              background: "var(--base2)", border: "1px solid var(--border)",
              borderRadius: 14, padding: "18px 20px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <strong style={{ fontSize: 14 }}>Илүү цаг</strong>
                <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 3 }}>
                  {overtimeEditor.employeeName} · {overtimeEditor.dateLabel}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOvertimeEditor(null)}
                style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 12 }}>
              Цаг
              <input
                autoFocus
                type="number"
                min={0}
                max={24}
                step={1}
                value={overtimeEditor.value}
                onChange={(e) => setOvertimeEditor((prev) => prev ? { ...prev, value: e.target.value } : prev)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOvertimeEditor(null);
                }}
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "9px 12px", borderRadius: 8,
                  border: "1px solid var(--border)", background: "var(--base3)",
                  color: "var(--text)", fontSize: 14, outline: "none",
                }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setOvertimeEditor(null)}
                style={{
                  border: "1px solid var(--border)", background: "var(--base3)",
                  color: "var(--muted)", borderRadius: 8, padding: "8px 12px",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}
              >
                Болих
              </button>
              <button
                type="submit"
                style={{
                  border: "1px solid rgba(239,68,68,.45)",
                  background: "rgba(239,68,68,.14)", color: "#f87171",
                  borderRadius: 8, padding: "8px 12px",
                  fontSize: 12, fontWeight: 800, cursor: "pointer",
                }}
              >
                Хадгалах
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
