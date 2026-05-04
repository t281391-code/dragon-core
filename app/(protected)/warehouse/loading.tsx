import { DeptTopbar } from "@/components/DeptTopbar";

export default function WarehouseLoading() {
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
