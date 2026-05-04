import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthProvider } from "@/components/AuthProvider";
import { AiAgentWidget } from "@/components/AiAgentWidget";
import Sidebar from "@/components/Sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AuthProvider initial={user}>
      <ThemeProvider>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <Sidebar />
          <div className="main">{children}</div>
        </div>
        <AiAgentWidget />
      </ThemeProvider>
    </AuthProvider>
  );
}
