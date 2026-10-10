"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import type { MomentCard as MomentCardData } from "@/lib/moments/types";
import { MomentCountdown, MomentIcon, MomentThemed, pointsBonusLabel } from "./moment-shared";

/**
 * AGORA NO FASHIONAI (§43): aparece no feed só quando há um Momento ativo relevante — nunca um banner permanente.
 * Dispensável por Momento (lembrado neste navegador); some sozinho quando o Momento termina.
 */
export function MomentNowBanner({ className }: { className?: string }) {
  const { t } = useI18n(); const { user } = useAuth();
  const [m, setM] = useState<MomentCardData | null>(null); const [at, setAt] = useState(0); const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    api.get<{ moment?: MomentCardData | null }>("/api/moments/now", { signal: ctrl.signal, anonymous: !user }).then((r) => { setM(r.moment ?? null); setAt(Date.now()); }).catch(() => setM(null));
    return () => ctrl.abort();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!m) return; try { setDismissed(localStorage.getItem(`fai.moment.banner.${m.id}`)); } catch { setDismissed(null); } }, [m?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m || dismissed === "1") return null;
  const bonus = pointsBonusLabel(t, m); const joined = m.me && m.me.status !== "INTERESTED" && m.me.status !== "LEFT";
  const dismiss = () => { try { localStorage.setItem(`fai.moment.banner.${m.id}`, "1"); } catch { /* armazenamento bloqueado */ } setDismissed("1"); };
  return (
    <MomentThemed as="section" theme={m.theme} className={`moment-banner ${className ?? ""}`} aria-labelledby={`mb-${m.id}`}>
      <MomentIcon theme={m.theme} size={36} />
      <div className="min-w-0 flex-1">
        <p className="moment-hero-kicker">{t("moments.now_kicker")}</p>
        <p id={`mb-${m.id}`} className="type-h3 truncate">{m.name}</p>
        <p className="type-caption moment-banner-sub"><MomentCountdown time={m.time} receivedAt={at} />{bonus ? ` · ${bonus}` : ""}{joined ? ` · ${t("moments.me.participating")}` : ""}</p>
      </div>
      <Link href={`/moments/${m.slug}`} className="btn btn-sm btn-primary">{joined ? t("moments.cta.open") : t("moments.cta.join")}</Link>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={dismiss} aria-label={t("moments.banner_dismiss")}>×</button>
    </MomentThemed>
  );
}
