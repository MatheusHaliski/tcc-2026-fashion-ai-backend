"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { FaiIcon } from "@/components/fai-icon";
import { UiIcon } from "@/components/ui";

/**
 * Primeiros passos: mostra ao usuário novo o caminho que ativa o app (3 peças → 1 look → seguir 3 pessoas).
 * Some sozinho quando os três passos estão feitos, ou quando a pessoa dispensa (lembrado neste navegador).
 */
type Profile = { counters: { pieces?: number; schemes?: number; following: number } };
const GOALS = { pieces: 3, looks: 1, following: 3 };

export function OnboardingChecklist() {
  const { t } = useI18n(); const { user } = useAuth();
  const key = user ? `fai.onboarding.dismissed.${user.id}` : "";
  const [dismissed, setDismissed] = useState(true);
  const [c, setC] = useState<Profile["counters"] | null>(null);
  useEffect(() => {
    if (!user) return;
    try { setDismissed(localStorage.getItem(key) === "1"); } catch { setDismissed(false); }
    const ctrl = new AbortController();
    api.get<Profile>(`/api/profiles/${encodeURIComponent(user.username)}`, { signal: ctrl.signal }).then((p) => setC(p.counters)).catch(() => undefined);
    return () => ctrl.abort();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user || dismissed || !c) return null;
  const steps = [
    { done: (c.pieces ?? 0) >= GOALS.pieces, title: t("onboarding.pieces", { n: GOALS.pieces }), hint: t("onboarding.piecesHint", { count: c.pieces ?? 0, n: GOALS.pieces }), href: "/pieces/new", cta: t("nav.createPiece"), icon: "ACT-06" },
    { done: (c.schemes ?? 0) >= GOALS.looks, title: t("onboarding.look"), hint: t("onboarding.lookHint"), href: "/schemes/new", cta: t("nav.createLook"), icon: "NAV-03" },
    { done: c.following >= GOALS.following, title: t("onboarding.follow", { n: GOALS.following }), hint: t("onboarding.followHint", { count: c.following, n: GOALS.following }), href: "/search?tab=PESSOAS", cta: t("onboarding.findPeople"), icon: "SOC-12" },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const dismiss = () => { try { localStorage.setItem(key, "1"); } catch { /* armazenamento bloqueado */ } setDismissed(true); };
  return (
    <section className="onboarding" aria-labelledby="onb-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="onb-title" className="type-h2">{t("onboarding.title")}</h2>
          <p className="type-body text-muted mt-1">{t("onboarding.lead")}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-icon" aria-label={t("onboarding.dismiss")} title={t("onboarding.dismiss")} onClick={dismiss}><UiIcon name="close" /></button>
      </div>
      <div className="onboarding-progress" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label={t("onboarding.progress", { done, total: steps.length })}>
        <i style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="onboarding-steps">
        {steps.map((s, i) => (
          <li key={i} className={s.done ? "is-done" : undefined}>
            <span className="onboarding-mark" aria-hidden>{s.done ? <UiIcon name="check" size={18} /> : i + 1}</span>
            <FaiIcon id={s.icon} size={32} variant="glyph" decorative />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{s.title}{s.done && <span className="sr-only"> — {t("onboarding.done")}</span>}</p>
              {!s.done && <p className="type-body-sm text-muted">{s.hint}</p>}
            </div>
            {!s.done && <Link href={s.href} className="btn btn-sm btn-primary">{s.cta}</Link>}
          </li>
        ))}
      </ol>
    </section>
  );
}
