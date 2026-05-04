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

const DEPARTMENTS = [
  { value: "WAREHOUSE", label: "Агуулах" },
  { value: "PRODUCTION", label: "Үйлдвэрлэл" },
  { value: "SAFETY", label: "ХЭАБО" },
  { value: "LOGISTICS", label: "Тээвэрлэлт" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const codeNum = parseInt(companyCode, 10);
    if (!/^\d{4}$/.test(companyCode) || codeNum < 1 || codeNum > 2215) {
      setError("MR код буруу байна. 0001–2215 хооронд байх ёстой.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          password,
          departmentName: department,
          website: String(new FormData(event.currentTarget).get("website") ?? ""),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Бүртгэхэд алдаа гарлаа");
        return;
      }
      writeCachedSessionUser(data.user);
      router.replace(DEPT_HOME[data.user.department] ?? "/warehouse");
    } catch {
      setError("Сервертэй холбогдоход алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="landing-login-page">
      <div className="login-modal login-modal--page" aria-labelledby="register-title">
        <div className="login-modal__backdrop" />

        <section className="login-modal__panel">
          <Link className="landing-login-page__back" href="/login">
            <span aria-hidden="true">&#8592;</span>
            <span>Нэвтрэх рүү буцах</span>
          </Link>

          <div className="login-modal__ring" aria-hidden="true">
            <span className="login-modal__ring-core" />
          </div>

          <div className="login-box">
            <h1 id="register-title" className="login-box__title">
              Бүртгүүлэх
            </h1>

            <form className="login-form" onSubmit={submit}>
              <AuthHoneypot />
              <label className="login-form__field">
                <span>Бүтэн нэр</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Овог Нэр"
                  required
                  autoComplete="name"
                />
              </label>

              <label className="login-form__field">
                <span>И-мэйл</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Хамгийн багадаа 6 тэмдэгт"
                  required
                  autoComplete="new-password"
                />
              </label>

              <label className="login-form__field">
                <span>Компанийн код</span>
                <input
                  type="text"
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value)}
                  placeholder=""
                  required
                  autoComplete="off"
                />
              </label>

              <label className="login-form__field">
                <span>Хэлтэс</span>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                >
                  <option value="" disabled>Хэлтсээ сонгоно уу</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </label>

              {error ? <p className="login-form__error">{error}</p> : null}

              <button type="submit" className="login-form__submit" disabled={loading}>
                {loading ? "Бүртгэж байна..." : "Бүртгүүлэх"}
              </button>

              <p className="login-form__signup">
                Бүртгэлтэй юу? <Link href="/login">Нэвтрэх</Link>
              </p>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
