"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useThemeMode } from "@/components/ThemeProvider";
import { useDeptTheme } from "@/hooks/useDeptTheme";
import { clearCachedSessionUser } from "@/lib/clientAuthCache";

type NavItem = {
  href: string;
  icon: string;
  label: string;
  section: string;
};

const DEPT_LABELS: Record<string, string> = {
  WAREHOUSE: "АГУУЛАХ",
  PRODUCTION: "ҮЙЛДВЭРЛЭЛ",
  SAFETY: "ХЭАБО",
  LOGISTICS: "ТЭЭВЭРЛЭЛТ",
};

const DEPT_COLORS: Record<string, string> = {
  "/warehouse": "#F59E0B",
  "/production": "#10B981",
  "/safety": "#EF4444",
  "/logistics": "#3B82F6",
};

function getNavItems(role: string, department: string): NavItem[] {
  const departmentItems: NavItem[] = [
    { href: "/warehouse", icon: "🏭", label: "Агуулах", section: "Үйл ажиллагаа" },
    { href: "/production", icon: "⚙️", label: "Үйлдвэрлэл", section: "Үйл ажиллагаа" },
    { href: "/safety", icon: "🛡️", label: "ХЭАБО", section: "Үйл ажиллагаа" },
    { href: "/logistics", icon: "🚛", label: "Тээвэрлэлт", section: "Үйл ажиллагаа" },
  ];

  if (role === "ADMIN") {
    return [
      { href: "/users", icon: "👥", label: "Ажилтан удирдлага", section: "Ерөнхий" },
      ...departmentItems,
    ];
  }

  const departmentMap: Record<string, string> = {
    WAREHOUSE: "/warehouse",
    PRODUCTION: "/production",
    SAFETY: "/safety",
    LOGISTICS: "/logistics",
  };

  const allowedPath = departmentMap[department] ?? "/warehouse";
  return departmentItems.filter((item) => item.href === allowedPath);
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() ?? "SA";
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

export default function Sidebar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { accent, glow, dim } = useDeptTheme();
  const { mode, toggleMode } = useThemeMode();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = useMemo(() => user ? getNavItems(user.role, user.department) : [], [user]);
  const sections = useMemo(() => [...new Set(items.map((item) => item.section))], [items]);

  useEffect(() => {
    if (!user) return;

    for (const item of items) {
      router.prefetch(item.href);
    }
  }, [items, router, user]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  if (!user) return null;

  const userTitle = user.role === "ADMIN" ? "System Admin" : user.fullName;
  const userSubtitle = `${user.role} · ${DEPT_LABELS[user.department] ?? user.department}`;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearCachedSessionUser();
    router.replace("/login");
  }

  function shouldRevealMobileSidebar() {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches && !mobileOpen;
  }

  function handleThemeClick() {
    if (shouldRevealMobileSidebar()) {
      setMobileOpen(true);
      return;
    }

    toggleMode();
  }

  function handleLogoutClick() {
    if (shouldRevealMobileSidebar()) {
      setMobileOpen(true);
      return;
    }

    void logout();
  }

  return (
    <>
    <button
      className={`sidebar-mobile-backdrop${mobileOpen ? " show" : ""}`}
      type="button"
      aria-label="Close sidebar"
      onClick={() => setMobileOpen(false)}
    />
    <aside className={`sidebar${mobileOpen ? " mobile-open" : ""}`}>
      <div className="sidebar-glow" style={{ background: glow }} />
      <button
        className="sidebar-mobile-toggle"
        type="button"
        aria-label={mobileOpen ? "Close sidebar" : "Open sidebar"}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((current) => !current)}
      >
        {mobileOpen ? "x" : "☰"}
      </button>

      <div className="logo">
        <Image
          src="/EXPLOSIVE.png"
          alt="EXPLO-KPI"
          width={52}
          height={52}
          style={{
            width: 52,
            height: 52,
            objectFit: "contain",
            flexShrink: 0,
            filter: `drop-shadow(0 0 12px ${glow})`,
          }}
        />
        <div className="logo-copy">
          <div className="logo-name">EXPLO-KPI</div>
          <div className="logo-sub" style={{ color: accent }}>
            MINING SYSTEM
          </div>
        </div>
      </div>

      <div className="sidebar-profile relative z-[1] border-b border-[var(--border)] px-4 py-4">
        <div
          className="flex items-center gap-3 rounded-2xl border border-white/6 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.18)] backdrop-blur-sm"
          style={{ background: dim }}
        >
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-extrabold tracking-[0.08em] text-[#0a0f1e]"
            style={{ background: accent, boxShadow: `0 0 14px ${glow}` }}
          >
            {user.role === "ADMIN" ? (
              <Image
                src="/img/moderator.jpg"
                alt="System Admin"
                width={44}
                height={44}
                className="h-full w-full object-cover"
              />
            ) : (
              initials(user.fullName)
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[1.08rem] font-semibold leading-none tracking-[-0.02em] text-[var(--text)]">
              {userTitle}
            </div>
            <div className="mt-1 truncate text-[0.68rem] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
              {userSubtitle}
            </div>
          </div>
        </div>
      </div>

      <div className="nav">
        {sections.map((section) => (
          <div key={section}>
            <div className="nav-group-label">{section}</div>
            {items
              .filter((item) => item.section === section)
              .map((item) => {
                const isActive = pathname.startsWith(item.href);

                const deptColor = DEPT_COLORS[item.href];

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item${isActive ? " active" : ""}`}
                    onMouseEnter={() => router.prefetch(item.href)}
                    onFocus={() => router.prefetch(item.href)}
                    onClick={(event) => {
                      if (shouldRevealMobileSidebar()) {
                        event.preventDefault();
                        setMobileOpen(true);
                        return;
                      }

                      if (typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches) {
                        setMobileOpen(false);
                      }
                    }}
                    style={isActive ? { color: accent, background: dim } : undefined}
                  >
                    <span className="ni">{item.icon}</span>
                    <span className="nav-label" style={{ flex: 1 }}>{item.label}</span>
                    {deptColor ? (
                      <span
                        className="nav-dept-dot"
                        style={{
                          background: deptColor,
                          boxShadow: isActive ? `0 0 6px ${deptColor}` : "none",
                          opacity: isActive ? 1 : 0.45,
                        }}
                      />
                    ) : null}
                  </Link>
                );
              })}
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="theme-toggle" type="button" onClick={handleThemeClick}>
          <span>{mode === "dark" ? "☀" : "☾"}</span>
          <span>{mode === "dark" ? "Light mode" : "Dark mode"}</span>
        </button>
        <button className="logout" type="button" onClick={handleLogoutClick}>
          <span>🚪</span>
          <span>Гарах</span>
        </button>
      </div>
    </aside>
    </>
  );
}
