"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  clearCachedSessionUser,
  readCachedSessionUser,
  writeCachedSessionUser,
  type ClientSessionUser,
} from "@/lib/clientAuthCache";

export type SessionUser = ClientSessionUser;

type AuthCtx = { user: SessionUser | null; loading: boolean; refresh: () => void };

const Ctx = createContext<AuthCtx>({ user: null, loading: true, refresh: () => {} });

export function AuthProvider({ children, initial }: { children: ReactNode; initial: SessionUser | null }) {
  const [user, setUser] = useState<SessionUser | null>(() => initial ?? readCachedSessionUser());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    writeCachedSessionUser(initial);
  }, [initial]);

  function refresh() {
    setLoading(true);
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => {
        const nextUser = d.user ?? null;
        setUser(nextUser);
        if (nextUser) writeCachedSessionUser(nextUser);
        else clearCachedSessionUser();
      })
      .finally(() => setLoading(false));
  }

  return <Ctx.Provider value={{ user, loading, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
