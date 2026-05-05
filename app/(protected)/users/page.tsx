"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useEscapeClose } from "@/hooks/useEscapeClose";

type User = {
  id: string; fullName: string; email: string;
  mrCode: string | null;
  isActive: boolean;
  role: { name: string };
  department: { name: string };
};

const DEPT_MN: Record<string, string> = {
  WAREHOUSE: "Агуулах", PRODUCTION: "Үйлдвэрлэл",
  SAFETY: "ХЭАБО", LOGISTICS: "Тээвэр"
};
const ROLE_MN: Record<string, string> = {
  ADMIN: "Admin", MODERATOR: "Менежер", USER: "Ажилтан"
};
const ROLE_BADGE: Record<string, string> = {
  ADMIN: "bg-r", MODERATOR: "bg-a", USER: "bg-b"
};

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Role modal
  const [selected, setSelected] = useState<User | null>(null);
  const [newRole, setNewRole] = useState("USER");
  const [changing, setChanging] = useState(false);
  const [changeErr, setChangeErr] = useState("");
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [kickErr, setKickErr] = useState("");

  useEscapeClose(Boolean(selected), () => setSelected(null));

  async function load() {
    setLoading(true);
    const res = await fetch("/api/users").then(r => r.json());
    setUsers(res.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function openModal(u: User) {
    setSelected(u);
    setNewRole(u.role.name);
    setChangeErr("");
  }

  function canKick(u: User) {
    if (!me || me.role !== "ADMIN") return false;
    return u.id !== me.id && u.role.name !== "ADMIN" && u.isActive;
  }

  async function kickUser(u: User) {
    if (!canKick(u)) return;
    const confirmed = window.confirm(`${u.fullName}-г системээс kick хийх үү? Нэвтрэх эрх нь хаагдана.`);
    if (!confirmed) return;

    setKickingId(u.id);
    setKickErr("");
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null) as { error?: string } | null;

    if (!res.ok) {
      setKickErr(data?.error ?? "Kick failed");
      setKickingId(null);
      return;
    }

    setUsers((current) => current.filter((item) => item.id !== u.id));
    setKickingId(null);
  }

  async function submitRoleChange(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setChanging(true);
    setChangeErr("");
    const res = await fetch(`/api/users/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleName: newRole })
    });
    const data = await res.json();
    if (!res.ok) {
      setChangeErr(data.error ?? "Алдаа гарлаа");
      setChanging(false);
      return;
    }
    setSelected(null);
    setChanging(false);
    load();
  }

  if (me?.role !== "ADMIN") {
    return (
      <div className="content" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
        <span style={{ color: "#f87171" }}>⛔ Энэ хуудсанд хандах эрх байхгүй</span>
      </div>
    );
  }

  const filtered = users.filter(u =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.mrCode ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const showMrCodes = me?.role === "ADMIN";
  const tableColumnCount = showMrCodes ? 7 : 6;

  if (loading) return (
    <div className="content" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <span style={{ color: "var(--muted)" }}>Ачааллаж байна...</span>
    </div>
  );

  const moderators = users.filter(u => u.role.name === "MODERATOR").length;

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">👥 Ажилтан удирдлага</div>
        <div className="topbar-right">
          <span className="topbar-date">{new Date().toLocaleDateString("mn-MN", { year: "numeric", month: "long", day: "numeric" })}</span>
        </div>
      </div>

      <div className="content">
        <div className="phd">
          <h2>👥 Ажилтан удирдлага</h2>
          <p>Бүртгэлтэй хэрэглэгчид, дүр өөрчлөх — зөвхөн Admin хийж чадна</p>
        </div>

        <div className="kg">
          <div className="kc bta">
            <div className="kl">Нийт ажилтан</div>
            <div className="kv ca">{users.length}</div>
            <div className="kch">Бүртгэлтэй хэрэглэгч</div>
            <div className="ki">👥</div>
          </div>
          <div className="kc btg">
            <div className="kl">Идэвхтэй</div>
            <div className="kv cg">{users.filter(u => u.isActive).length}</div>
            <div className="kch cg">Нэвтрэх боломжтой</div>
            <div className="ki">✅</div>
          </div>
          <div className="kc bta">
            <div className="kl">Менежер (Moderator)</div>
            <div className="kv ca">{moderators}</div>
            <div className="kch">Бүх хэлтэст хандах эрхтэй</div>
            <div className="ki">⭐</div>
          </div>
          <div className="kc btr">
            <div className="kl">Admin</div>
            <div className="kv cr">{users.filter(u => u.role.name === "ADMIN").length}</div>
            <div className="kch">Системийн администратор</div>
            <div className="ki">🔑</div>
          </div>
        </div>

        {me?.role === "ADMIN" && (
          <div className="al al-b" style={{ marginBottom: 16 }}>
            <span className="al-ic">ℹ️</span>
            <div>
              <strong>Дүр өөрчлөх:</strong> Ажилтны нэр дээр дарж Менежер болгох эсвэл буцааж Ажилтан болгоно уу.
              Менежер нь бүх хэлтсийн мэдээллийг харах боломжтой.
            </div>
          </div>
        )}

        {kickErr && (
          <div className="al al-r" style={{ marginBottom: 16 }}>
            <span className="al-ic">!</span>
            <div>{kickErr}</div>
          </div>
        )}

        <div className="pn">
          <div className="ph"><h3>Ажилтнуудын жагсаалт</h3></div>
          <div style={{ padding: "12px 18px" }}>
            <div className="fb">
              <input
                placeholder="🔍 Нэр эсвэл имэйлээр хайх..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Нэр</th>
                  <th>Email</th>
                  {showMrCodes && <th>MR код</th>}
                  <th>Дүр</th>
                  <th>Хэлтэс</th>
                  <th>Статус</th>
                  {me?.role === "ADMIN" && <th>Үйлдэл</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={tableColumnCount} style={{ textAlign: "center", color: "#64748b", padding: 20 }}>Ажилтан олдсонгүй</td></tr>
                )}
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="av" style={{ width: 26, height: 26, fontSize: 10 }}>{u.fullName[0]}</div>
                        <div>
                          <strong
                            style={{ cursor: me?.role === "ADMIN" && u.role.name !== "ADMIN" ? "pointer" : "default",
                                     textDecoration: me?.role === "ADMIN" && u.role.name !== "ADMIN" ? "underline dotted" : "none",
                                     color: me?.role === "ADMIN" && u.role.name !== "ADMIN" ? "var(--acc)" : "inherit" }}
                            onClick={() => me?.role === "ADMIN" && u.role.name !== "ADMIN" && openModal(u)}
                            title={me?.role === "ADMIN" && u.role.name !== "ADMIN" ? "Дүр өөрчлөх" : ""}
                          >
                            {u.fullName}
                          </strong>
                          {u.id === me?.id && (
                            <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 5 }}>(та)</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: "#94a3b8", fontSize: 12 }}>{u.email}</td>
                    {showMrCodes && (
                      <td style={{ color: "var(--text)", fontSize: 12, fontFamily: "var(--font-numeric)", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                        {u.mrCode ?? "—"}
                      </td>
                    )}
                    <td><span className={`bg ${ROLE_BADGE[u.role.name] ?? "bg-gr"}`}>{ROLE_MN[u.role.name] ?? u.role.name}</span></td>
                    <td><span className="bg bg-gr">{DEPT_MN[u.department.name] ?? u.department.name}</span></td>
                    <td><span className={`bg ${u.isActive ? "bg-g" : "bg-r"}`}>{u.isActive ? "Идэвхтэй" : "Идэвхгүй"}</span></td>
                    {me?.role === "ADMIN" && (
                      <td>
                        {u.role.name !== "ADMIN" && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              className="btn bp bs"
                              style={{ fontSize: 10 }}
                              onClick={() => openModal(u)}
                            >
                              Дүр өөрчлөх
                            </button>
                            <button
                              className="btn bd2 bs"
                              style={{ fontSize: 10 }}
                              disabled={!canKick(u) || kickingId === u.id}
                              onClick={() => void kickUser(u)}
                            >
                              {kickingId === u.id ? "Kick..." : "Kick"}
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pg">
              <span className="pgi">Нийт {filtered.length} ажилтан</span>
              <button className="pgb on">1</button>
            </div>
          </div>
        </div>
      </div>

      {/* Role change modal */}
      {selected && (
        <div className="mo open" onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="mc" style={{ width: 420 }}>
            <div className="mh">
              <h3>Дүр өөрчлөх</h3>
              <button className="mx" onClick={() => setSelected(null)}>✕</button>
            </div>

            {/* User info */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#0f172a", borderRadius: 9, marginBottom: 20 }}>
              <div className="av" style={{ width: 38, height: 38, fontSize: 16 }}>{selected.fullName[0]}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{selected.fullName}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{selected.email}</div>
                {showMrCodes && (
                  <div style={{ fontSize: 11, color: "var(--text)", marginTop: 3, fontFamily: "var(--font-numeric)", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                    MR: {selected.mrCode ?? "—"}
                  </div>
                )}
                <div style={{ marginTop: 4 }}>
                  <span className={`bg ${ROLE_BADGE[selected.role.name] ?? "bg-gr"}`} style={{ marginRight: 6 }}>
                    {ROLE_MN[selected.role.name]}
                  </span>
                  <span className="bg bg-gr">{DEPT_MN[selected.department.name] ?? selected.department.name}</span>
                </div>
              </div>
            </div>

            <form onSubmit={submitRoleChange}>
              <div className="fg">
                <label>Шинэ дүр сонгох</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value)}>
                  <option value="USER">👤 Ажилтан — зөвхөн өөрийн хэлтэс</option>
                  <option value="MODERATOR">⭐ Менежер — бүх хэлтсийг харах</option>
                </select>
              </div>

              {/* Explanation */}
              {newRole === "MODERATOR" && selected.role.name !== "MODERATOR" && (
                <div className="al al-a" style={{ marginBottom: 12 }}>
                  <span className="al-ic">⭐</span>
                  <div>
                    <strong>{selected.fullName}-г Менежер болгоно.</strong> Бүх хэлтсийн хуудас болон тайлангуудыг харах боломжтой болно.
                  </div>
                </div>
              )}
              {newRole === "USER" && selected.role.name !== "USER" && (
                <div className="al al-a" style={{ marginBottom: 12 }}>
                  <span className="al-ic">👤</span>
                  <div>
                    <strong>{selected.fullName}-г Ажилтан болгоно.</strong> Зөвхөн {DEPT_MN[selected.department.name] ?? selected.department.name} хэлтсийн хуудсанд нэвтрэх боломжтой болно.
                  </div>
                </div>
              )}

              {changeErr && (
                <div style={{ color: "#f87171", fontSize: 12, marginBottom: 10, padding: "8px 12px", background: "rgba(239,68,68,.08)", borderRadius: 6, border: "1px solid rgba(239,68,68,.25)" }}>
                  {changeErr}
                </div>
              )}

              <div className="mf">
                <button type="button" className="btn bo2" onClick={() => setSelected(null)}>Цуцлах</button>
                <button
                  type="submit"
                  className="btn bp"
                  disabled={changing || newRole === selected.role.name}
                >
                  {changing ? "Хадгалж байна..." : newRole === selected.role.name ? "Өөрчлөлт байхгүй" : "✓ Хадгалах"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
