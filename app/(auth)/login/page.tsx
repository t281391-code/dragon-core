"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthHoneypot } from "@/components/auth-honeypot";
import { writeCachedSessionUser } from "@/lib/clientAuthCache";

const DEPT_HOME: Record<string, string> = {
  WAREHOUSE: "/warehouse",
  PRODUCTION: "/production",
  SAFETY: "/safety",
  LOGISTICS: "/logistics",
};

function homeFor(role: string, department: string): string {
  if (role === "ADMIN" || role === "MODERATOR") {
    return DEPT_HOME[department] ?? "/warehouse";
  }

  return DEPT_HOME[department] ?? "/warehouse";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginErr("");
    setLoginLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          website: String(new FormData(event.currentTarget).get("website") ?? ""),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setLoginErr(data.error ?? "Нэвтрэхэд алдаа гарлаа");
        return;
      }

      writeCachedSessionUser(data.user);
      router.replace(homeFor(data.user.role, data.user.department));
    } catch {
      setLoginErr("Сервертэй холбогдоход алдаа гарлаа");
    } finally {
      setLoginLoading(false);
    }
  }

  return (
    <main className="landing-login-page">
      <div className="login-modal login-modal--page" aria-labelledby="landing-login-title">
        <div className="login-modal__backdrop" />

        <section className="login-modal__panel">
          <Link className="landing-login-page__back" href="/">
            <span aria-hidden="true">&#8592;</span>
            <span>Буцах</span>
          </Link>

          <div className="login-modal__ring" aria-hidden="true">
            <span className="login-modal__ring-core" />
          </div>

          <div className="login-box">
            <h1 id="landing-login-title" className="login-box__title">
              Нэвтрэх
            </h1>
            <form className="login-form" onSubmit={submitLogin}>
              <AuthHoneypot />
              <label className="login-form__field">
                <span>И-мэйл</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  required
                  autoComplete="email"
                />
              </label>

              <label className="login-form__field">
                <span>Нууц үг</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Нууц үгээ оруулна уу"
                  required
                  autoComplete="current-password"
                />
              </label>

              <div className="login-form__meta">
                <Link href="/register">Бүртгэл үүсгэх</Link>
              </div>

              {loginErr ? <p className="login-form__error">{loginErr}</p> : null}

              <button type="submit" className="login-form__submit" disabled={loginLoading}>
                {loginLoading ? "Нэвтэрч байна..." : "Нэвтрэх"}
              </button>

            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
