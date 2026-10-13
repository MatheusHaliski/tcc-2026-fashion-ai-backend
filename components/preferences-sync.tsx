"use client";
import { useEffect } from "react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useTheme } from "@/lib/theme/theme";
export function PreferencesSync() {
  const { user } = useAuth(); const { update } = useTheme();
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    void api.get<{ auraHype?: boolean }>("/api/me/preferences", { signal: controller.signal }).then(p => {
      if (!controller.signal.aborted && typeof p.auraHype === "boolean") update({ auraHype: p.auraHype });
    }).catch(() => {});
    return () => controller.abort();
  }, [user?.id, update]);
  return null;
}
