"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Dialog } from "@/components/ui";

const VERSION = "v1";
/** Uma preferência por conta; dispensar sem marcar lembra apenas esta sessão do navegador. */
export const hypeGuideKey = (id: string) => `fai:hype-guide:${VERSION}:${id}`;
export function useHypeGuide(drawerOpen: boolean) {
  const { user, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const key = user ? hypeGuideKey(user.id) : null;
  useEffect(() => {
    if (!drawerOpen) { setOpen(false); return; }
    if (!ready || !key) return;
    try {
      if (localStorage.getItem(key) !== "hide" && sessionStorage.getItem(key) !== "seen") setOpen(true);
      setDontShowAgain(localStorage.getItem(key) === "hide");
    } catch { setOpen(true); }
  }, [drawerOpen, key, ready]);
  function close() {
    if (key) try {
      sessionStorage.setItem(key, "seen");
      if (dontShowAgain) localStorage.setItem(key, "hide"); else localStorage.removeItem(key);
    } catch { /* A ajuda continua disponível quando o armazenamento estiver bloqueado. */ }
    setOpen(false);
  }
  return { open, close, dontShowAgain, setDontShowAgain, show: () => setOpen(true) };
}

export function HypeGuideIcon({ kind, className }: { kind: "score" | "growth" | "seal" | "help"; className?: string }) {
  const paths = {
    score: <><path d="M13 3c1 5-4 5-2 9 2-1 3-3 3-3 4 5 4 12-2 12S3 15 6 11c0 3 2 4 3 3-2-4 4-6 4-11Z" /></>,
    growth: <><path d="M4 18V6m0 12h16M7 14l5-5 3 3 5-7m-5 0h5v5" /></>,
    seal: <><circle cx="12" cy="9" r="6" /><path d="m8 14-1 7 5-3 5 3-1-7m-7-5 2 2 4-4" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="32" height="32" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>;
}

export function HypeGuide({ guide }: { guide: ReturnType<typeof useHypeGuide> }) {
  const { t } = useI18n();
  return <Dialog open={guide.open} onClose={guide.close} title={t("hypeGuide.title")} footer={<Button variant="primary" onClick={guide.close}>{t("hypeGuide.continue")}</Button>}>
    <div className="grid gap-4">
      {(["score", "growth", "seal"] as const).map((kind) => <section key={kind} className="flex items-start gap-3 rounded-lg bg-surface-2 p-3">
        <HypeGuideIcon kind={kind} className="shrink-0" /><div><h3 className="type-h3">{t(`hypeGuide.${kind}.title`)}</h3><p className="type-body mt-1">{t(`hypeGuide.${kind}.text`)}</p></div>
      </section>)}
      <div className="rounded-lg border border-line-soft p-3">
        <p className="type-body font-semibold">{t("hypeGuide.example")}</p>
        <div className="mt-2 flex items-center justify-between gap-2 text-center" aria-hidden="true"><span className="rounded-md bg-surface-2 p-2"><b className="type-h2">72</b><br />{t("hypeGuide.current")}</span><span className="type-h2">→</span><span className="rounded-md bg-surface-2 p-2"><b className="type-h2">90</b><br />{t("hypeGuide.target")}</span><span className="rounded-md bg-surface-2 p-2"><b className="type-h2">18</b><br />{t("hypeGuide.missing_short")}</span></div>
        <p className="mt-2 type-body">{t("hypeGuide.example_text")}</p>
      </div>
      <label className="flex items-center gap-3 type-body"><input type="checkbox" checked={guide.dontShowAgain} onChange={(event) => guide.setDontShowAgain(event.target.checked)} />{t("hypeGuide.dont_show")}</label>
    </div>
  </Dialog>;
}
