"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { GUIDES, shouldAutoOpen, type GuidePref } from "@/lib/guides/registry";
import { Button, Dialog, UiIcon } from "@/components/ui";
import { GuideDemo } from "@/components/guide/guide-demos";

/**
 * Orientação "Como funciona" (docs/ux/ORIENTACAO.md).
 *
 * - Abre sozinha na primeira visita pertinente, no máximo um tutorial por tela (nunca empilha modais).
 * - "Entendi" sem marcar: não reabre nesta sessão e volta no máximo mais uma vez, em outro dia.
 * - "Não mostrar novamente": vale só para aquele tutorial e aquela versão.
 * - "Como funciona" reabre a qualquer momento.
 * - A preferência é guardada no servidor, por pessoa (troca de conta não herda); visitante sem conta usa o navegador.
 */
type Mode = "auto" | "manual";
interface Ctx { open: (key: string) => void; requestAuto: (key: string) => void; ready: boolean }
const GuideCtx = createContext<Ctx | null>(null);
const ANON_KEY = "fai.guides.anon";

function readAnon(): Record<string, GuidePref> {
  try { return JSON.parse(localStorage.getItem(ANON_KEY) ?? "{}") as Record<string, GuidePref>; } catch { return {}; }
}
function writeAnon(prefs: Record<string, GuidePref>) {
  try { localStorage.setItem(ANON_KEY, JSON.stringify(prefs)); } catch { /* armazenamento bloqueado: vale só nesta visita */ }
}

/** Aplica o evento localmente com a mesma regra do servidor (a resposta do servidor substitui depois). */
function apply(pref: GuidePref | undefined, version: number, event: string): GuidePref {
  let p: GuidePref = pref && pref.version >= version ? { ...pref } : { version, hidden: false, autoCount: 0, lastShownAt: null };
  const now = new Date().toISOString();
  if (event === "AUTO_SHOWN") p = { ...p, autoCount: p.autoCount + 1, lastShownAt: now };
  if (event === "MANUAL_SHOWN" || event === "CLOSED") p = { ...p, lastShownAt: now };
  if (event === "HIDDEN") p = { ...p, hidden: true, lastShownAt: now };
  if (event === "UNHIDDEN") p = { ...p, hidden: false };
  return p;
}

export function GuideProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const pathname = usePathname();
  const [prefs, setPrefs] = useState<Record<string, GuidePref> | null>(null);
  const [active, setActive] = useState<{ key: string; mode: Mode; hidden: boolean } | null>(null);
  const closed = useRef(new Set<string>());
  const autoThisView = useRef(false);
  const pending = useRef<string | null>(null);
  const userId = user?.id ?? null;

  // troca de conta: recomeça do zero com as preferências da outra pessoa
  useEffect(() => {
    closed.current = new Set(); pending.current = null; setActive(null); setPrefs(null);
    if (!authReady) return;
    if (!userId) { setPrefs(readAnon()); return; }
    const ctrl = new AbortController();
    api.get<{ guides: Record<string, GuidePref> }>("/api/me/guides", { signal: ctrl.signal })
      .then((r) => setPrefs(r?.guides ?? {})).catch(() => { if (!ctrl.signal.aborted) setPrefs({}); });
    return () => ctrl.abort();
  }, [userId, authReady]);

  useEffect(() => { autoThisView.current = false; }, [pathname]);

  const record = useCallback((key: string, version: number, event: string) => {
    setPrefs((cur) => {
      const next = { ...(cur ?? {}), [key]: apply(cur?.[key], version, event) };
      if (!userId) writeAnon(next);
      return next;
    });
    if (userId) {
      api.put<GuidePref>(`/api/me/guides/${encodeURIComponent(key)}`, { version, event })
        .then((v) => { if (v) setPrefs((cur) => ({ ...(cur ?? {}), [key]: v })); }).catch(() => undefined);
    }
  }, [userId]);

  const tryAuto = useCallback((key: string, current: Record<string, GuidePref>) => {
    const def = GUIDES[key];
    if (!def || active || autoThisView.current || closed.current.has(key)) return false;
    if (!shouldAutoOpen(current[key], def.version)) return false;
    autoThisView.current = true;
    setActive({ key, mode: "auto", hidden: false });
    record(key, def.version, "AUTO_SHOWN");
    return true;
  }, [active, record]);

  const requestAuto = useCallback((key: string) => {
    if (!prefs) { pending.current = pending.current ?? key; return; }
    tryAuto(key, prefs);
  }, [prefs, tryAuto]);

  useEffect(() => {
    if (prefs && pending.current) { const k = pending.current; pending.current = null; tryAuto(k, prefs); }
  }, [prefs, tryAuto]);

  const open = useCallback((key: string) => {
    const def = GUIDES[key]; if (!def) return;
    // o estado da caixa "Não mostrar novamente" é o do momento em que abriu (a resposta do servidor pode chegar depois)
    const pref = prefs?.[key];
    setActive({ key, mode: "manual", hidden: !!pref?.hidden && pref.version >= def.version });
    record(key, def.version, "MANUAL_SHOWN");
  }, [prefs, record]);

  const close = useCallback((key: string, hide: boolean, wasHidden: boolean) => {
    const def = GUIDES[key]; if (!def) return;
    closed.current.add(key);
    record(key, def.version, hide ? "HIDDEN" : wasHidden ? "UNHIDDEN" : "CLOSED");
    setActive(null);
  }, [record]);

  const value = useMemo<Ctx>(() => ({ open, requestAuto, ready: prefs != null }), [open, requestAuto, prefs]);
  const def = active ? GUIDES[active.key] : null;
  return (
    <GuideCtx.Provider value={value}>
      {children}
      {active && def && <GuideDialog key={active.key} guideKey={active.key} initiallyHidden={active.hidden} onClose={(hide) => close(active.key, hide, active.hidden)} />}
    </GuideCtx.Provider>
  );
}

export function useGuide() {
  const ctx = useContext(GuideCtx);
  return ctx ?? { open: () => undefined, requestAuto: () => undefined, ready: false };
}

/** Abre o tutorial sozinho na primeira visita pertinente (se ainda for o caso para esta pessoa e esta versão). */
export function GuideAuto({ id, when = true }: { id: string; when?: boolean }) {
  const { requestAuto } = useGuide();
  useEffect(() => { if (when) requestAuto(id); }, [id, when, requestAuto]);
  return null;
}

/** Botão "Como funciona": reabre o tutorial daquela aba a qualquer momento. */
export function HowItWorks({ id, className, label }: { id: string; className?: string; label?: string }) {
  const { t } = useI18n(); const { open } = useGuide();
  return (
    <button type="button" className={className ?? "btn btn-sm btn-ghost"} onClick={() => open(id)} aria-haspopup="dialog">
      <UiIcon name="info" size={18} />{label ?? t("guide.how_it_works")}
    </button>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function GuideDialog({ guideKey, initiallyHidden, onClose }: { guideKey: string; initiallyHidden: boolean; onClose: (hide: boolean) => void }) {
  const { t } = useI18n();
  const def = GUIDES[guideKey];
  const [hide, setHide] = useState(initiallyHidden);
  const [playing, setPlaying] = useState(() => def.animated && !prefersReducedMotion());
  const base = `guide.${guideKey}`;
  const steps = Array.from({ length: Math.min(3, def.steps) }, (_, i) => t(`${base}.step${i + 1}`));
  return (
    <Dialog open title={t(`${base}.title`)} onClose={() => onClose(hide)} size="lg"
      footer={<>
        <label className="guide-hide"><input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} />{t("guide.dont_show_again")}</label>
        <Button variant="primary" onClick={() => onClose(hide)} data-autofocus>{t("guide.got_it")}</Button>
      </>}>
      <div className="guide">
        <p className="type-body">{t(`${base}.body`)}</p>
        <figure className="guide-demo">
          <div className="guide-demo-head">
            <span className="badge badge-chalk">{t("guide.example_badge")}</span>
            {def.animated && (
              <button type="button" className="btn btn-sm btn-ghost" aria-pressed={!playing} onClick={() => setPlaying((p) => !p)}>
                {playing ? t("guide.pause_animation") : t("guide.play_animation")}
              </button>
            )}
          </div>
          {/* palco inerte: nada ali dentro recebe foco, clique ou chamada à API */}
          <div className="guide-demo-stage" data-playing={playing ? "true" : "false"} inert aria-hidden>
            <GuideDemo demo={def.demo} />
          </div>
          <figcaption className="type-body-sm text-muted">{t(`${base}.demo`)}</figcaption>
        </figure>
        {steps.length > 0 && <ol className="guide-steps">{steps.map((s, i) => <li key={i}><span className="guide-step-n" aria-hidden>{i + 1}</span><span>{s}</span></li>)}</ol>}
      </div>
    </Dialog>
  );
}
