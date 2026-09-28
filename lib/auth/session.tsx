"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, onUnauthorized, restoreSession, tokenStore } from "@/lib/api/client";
import type { Me, Session, UserCard } from "@/lib/api/types";

interface Auth {
  user: UserCard | null; me: Me | null; ready: boolean; isAdmin: boolean; emailVerified: boolean;
  signIn: (s: Session) => void; signOut: () => Promise<void>; refreshMe: () => Promise<Me | null>;
}
const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserCard | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  const refreshMe = useCallback(async () => {
    if (!tokenStore.access) { setMe(null); setUser(null); return null; }
    try {
      const m = await api.get<Me>("/api/me");
      setMe(m); setUser(m.user);
      try { localStorage.setItem(tokenStore.userKey, JSON.stringify(m.user)); } catch { /* ignore */ }
      return m;
    } catch { return null; }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // a sessão volta pelo cookie HttpOnly (BFF): primeiro o access token em memória, depois os dados da conta
    (async () => {
      const restored = await restoreSession();
      if (cancelled) return;
      if (restored) {
        try { const cached = localStorage.getItem(tokenStore.userKey); if (cached) setUser(JSON.parse(cached)); } catch { /* ignore */ }
      }
      await refreshMe();
    })().finally(() => { if (!cancelled) setReady(true); });
    const off = onUnauthorized(() => { setUser(null); setMe(null); router.push("/login?reason=session"); });
    return () => { cancelled = true; off(); };
  }, [refreshMe, router]);

  const signIn = useCallback((s: Session) => {
    tokenStore.set(s.accessToken);
    setUser(s.user);
    try { localStorage.setItem(tokenStore.userKey, JSON.stringify(s.user)); } catch { /* ignore */ }
    void refreshMe();
  }, [refreshMe]);

  const signOut = useCallback(async () => {
    try { await api.post("/bff/auth/logout"); } catch { /* sessão já encerrada */ }
    tokenStore.clear(); setUser(null); setMe(null); router.push("/login");
  }, [router]);

  const value = useMemo<Auth>(() => ({
    user, me, ready, isAdmin: me?.role === "ADMIN", emailVerified: me?.emailVerified ?? false, signIn, signOut, refreshMe,
  }), [user, me, ready, signIn, signOut, refreshMe]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** true quando a sessão já foi restaurada (ou quando não há provedor, ex.: testes). Usado pelo useApi. */
export function useAuthReady(): boolean {
  const ctx = useContext(Ctx);
  return ctx ? ctx.ready : true;
}

export function useAuth(): Auth {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}
