"use client";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import type { HubAvailability, HubDemo } from "@/lib/flair/hub";
import { Badge, Button, cn, PageHeader } from "@/components/ui";
import { FlairHubIcon, type HubIconId, type HubIconState } from "@/components/flair/hub-icons";
import { DemoPlayer } from "@/components/flair/demo-player";
import { GuideAuto, HowItWorks, useGuide } from "@/components/guide/guide";

/** Um item da lista lateral: identidade, grupo, rota, tutorial, demonstração, textos e disponibilidade já resolvidos. */
export interface HubModeView {
  id: string; group: string; href: string; guide: string; demo: HubDemo; icon: HubIconId;
  title: string; lead: string; demoDescription: string; kicker?: string; av: HubAvailability;
}

/**
 * Tela de seleção no modelo dos menus de jogos: lista lateral com um item por modo (ícone exclusivo + nome, em grupos
 * pela função real) e, ao lado, o painel do modo escolhido com título grande, objetivo em uma frase, demonstração
 * gravada e a ação para começar. Escolher um item nunca inicia nada: só a ação principal leva à rota. A escolha fica
 * guardada por conta e volta ao retornar; navegação por toque, teclado (setas, Home/End, Enter) e controle (direcional
 * + A). Usada pela Central FLAIR (/flair) e pela central de FAI Points (/points).
 */
export function ModeHub({ title, kicker, navLabel, hubGuide, groups, modes, storageKey, basePath, legacy, headerActions, badges }: {
  title: string; kicker: string; navLabel: string; hubGuide: string; groups: { id: string; label: string }[]; modes: HubModeView[];
  /** chave do navegador onde a escolha fica guardada (por conta) */ storageKey: string;
  /** rota desta central (a URL recebe ?mode=…) */ basePath: string;
  /** links antigos (?tab=…) → rota nova */ legacy?: Record<string, string>;
  headerActions?: ReactNode; badges?: ReactNode;
}) {
  const { t } = useI18n(); const { user } = useAuth(); const router = useRouter(); const sp = useSearchParams(); const { gate } = useGuide();
  const legacyTab = sp.get("tab"); const asked = sp.get("mode");
  useEffect(() => { if (legacyTab && legacy?.[legacyTab]) router.replace(legacy[legacyTab]); }, [legacyTab, legacy, router]);
  const ids = modes.map((m) => m.id);
  const isMode = (v: unknown): v is string => typeof v === "string" && ids.includes(v);
  const key = `${storageKey}:${user?.id ?? "anon"}`;
  const [selected, setSelected] = useState<string>(() => (isMode(asked) ? asked : ids[0]));
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    // sem ?mode= na URL, volta ao último item escolhido por esta conta
    if (!isMode(asked)) { try { const last = localStorage.getItem(key); if (isMode(last)) setSelected(last); } catch { /* sem armazenamento */ } }
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked, key]);
  const select = useCallback((id: string) => {
    setSelected(id);
    try { localStorage.setItem(key, id); } catch { /* armazenamento bloqueado: vale só nesta visita */ }
    try { window.history.replaceState(window.history.state, "", `${basePath}?mode=${id}`); } catch { /* sem histórico (teste) */ }
  }, [key, basePath]);

  const mode = modes.find((m) => m.id === selected) ?? modes[0];
  const av = mode.av;
  const primaryHref = av.action === "unlock" && av.unlockHref ? av.unlockHref : mode.href;
  const start = useCallback(() => {
    // primeira entrada no modo: a explicação abre antes; "Entendi, começar" leva à rota. Depois, vai direto.
    if (av.action === "unlock") { router.push(primaryHref); return; }
    gate(mode.guide, () => router.push(primaryHref));
  }, [av.action, gate, mode.guide, primaryHref, router]);

  // teclado: setas movem e escolhem (ativação automática, como abas); Home/End; Enter começa
  const listRef = useRef<HTMLDivElement>(null);
  const focusItem = (id: string) => listRef.current?.querySelector<HTMLElement>(`[data-mode="${id}"]`)?.focus();
  const move = useCallback((delta: number) => {
    const i = ids.indexOf(selected); const next = ids[(i + delta + ids.length) % ids.length];
    select(next); focusItem(next);
  }, [ids, selected, select]);
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
    else if (e.key === "Home") { e.preventDefault(); select(ids[0]); focusItem(ids[0]); }
    else if (e.key === "End") { e.preventDefault(); const last = ids[ids.length - 1]; select(last); focusItem(last); }
    else if (e.key === "Enter") { e.preventDefault(); start(); }
  };
  useGamepad({ onMove: move, onPrimary: start, enabled: restored });

  return (
    <div className="flair-hub" data-selected={mode.id}>
      <PageHeader title={title} kicker={kicker} actions={<div className="flex flex-wrap items-center gap-2"><HowItWorks id={hubGuide} />{headerActions}{badges}</div>} />
      <GuideAuto id={hubGuide} />
      <div className="flair-hub-body">
        <div ref={listRef} className="flair-hub-nav" role="tablist" aria-label={navLabel} aria-orientation="vertical" onKeyDown={onKey}>
          {groups.map((g) => (
            <div key={g.id} className="flair-hub-group" role="presentation">
              <p className="flair-hub-group-title" aria-hidden>{g.label}</p>
              {modes.filter((x) => x.group === g.id).map((x) => (
                <button key={x.id} type="button" role="tab" id={`flair-tab-${x.id}`} aria-selected={x.id === mode.id} aria-controls={`flair-panel-${x.id}`} tabIndex={x.id === mode.id ? 0 : -1} data-mode={x.id}
                  className={cn("flair-hub-item", x.id === mode.id && "is-selected", !x.av.available && "is-unavailable")} onClick={() => select(x.id)}>
                  <FlairHubIcon id={x.icon} size={24} state={x.id === mode.id ? "selected" : x.av.available ? "normal" : "unavailable"} />
                  <span className="flair-hub-item-text">
                    <span className="flair-hub-item-name">{x.title}</span>
                    {!x.av.available && <span className="flair-hub-item-flag">{t("flair.hub.unavailable")}</span>}
                  </span>
                  <span className="flair-hub-item-indicator" aria-hidden />
                </button>
              ))}
            </div>
          ))}
        </div>
        <section className="flair-hub-panel" role="tabpanel" id={`flair-panel-${mode.id}`} aria-labelledby={`flair-tab-${mode.id}`} tabIndex={-1}>
          <div className="flair-hub-panel-head">
            <FlairHubIcon id={mode.icon} size={28} state={av.available ? "selected" : "unavailable"} />
            <div className="min-w-0">
              <p className="type-label text-muted">{groups.find((g) => g.id === mode.group)?.label}{mode.kicker ? ` · ${mode.kicker}` : ""}</p>
              <h2 className="flair-hub-title type-display">{mode.title}</h2>
            </div>
          </div>
          <p className="flair-hub-lead type-body-lg">{mode.lead}</p>
          <DemoPlayer key={mode.id} demo={mode.demo} title={mode.title} description={mode.demoDescription} />
          <div className="flair-hub-actions">
            <Button variant="primary" size="lg" className="flair-hub-play" onClick={start} data-testid="hub-primary">{t(`flair.hub.action.${av.action}`)}</Button>
            <HowItWorks id={mode.guide} className="btn btn-lg" />
            {av.status && <span className={cn("flair-hub-status", !av.available && "is-unavailable")} role="status">{t(av.status.key, av.status.vars)}</span>}
            {av.action === "unlock" && <Link href={mode.href} className="btn btn-ghost btn-lg">{t("flair.hub.action.open_anyway")}</Link>}
          </div>
        </section>
      </div>
    </div>
  );
}

export function HubBadge({ tone, children }: { tone?: "mark" | "thread" | "chalk"; children: ReactNode }) { return <Badge tone={tone}>{children}</Badge>; }
export type { HubIconState };

/**
 * Controle (Gamepad API): direcional ou analógico esquerdo movem a seleção; A (botão 0) começa. Só liga quando o
 * navegador anuncia um controle conectado; repete a leitura por animação (sem intervalo quando não há controle).
 */
function useGamepad({ onMove, onPrimary, enabled }: { onMove: (d: number) => void; onPrimary: () => void; enabled: boolean }) {
  const cb = useRef({ onMove, onPrimary }); cb.current = { onMove, onPrimary };
  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;
    let raf = 0; let active = false; const held = new Set<string>();
    const poll = () => {
      const pads = navigator.getGamepads?.() ?? [];
      for (const p of pads) {
        if (!p) continue;
        const press = (key: string, on: boolean, fn: () => void) => { if (on && !held.has(key)) { held.add(key); fn(); } else if (!on) held.delete(key); };
        const ay = p.axes[1] ?? 0; const ax = p.axes[0] ?? 0;
        press("down", !!p.buttons[13]?.pressed || ay > 0.6, () => cb.current.onMove(1));
        press("up", !!p.buttons[12]?.pressed || ay < -0.6, () => cb.current.onMove(-1));
        press("right", !!p.buttons[15]?.pressed || ax > 0.6, () => cb.current.onMove(1));
        press("left", !!p.buttons[14]?.pressed || ax < -0.6, () => cb.current.onMove(-1));
        press("a", !!p.buttons[0]?.pressed, () => cb.current.onPrimary());
      }
      if (active) raf = requestAnimationFrame(poll);
    };
    const on = () => { if (!active) { active = true; raf = requestAnimationFrame(poll); } };
    const off = () => { if (![...(navigator.getGamepads?.() ?? [])].some(Boolean)) { active = false; cancelAnimationFrame(raf); } };
    window.addEventListener("gamepadconnected", on); window.addEventListener("gamepaddisconnected", off);
    if ([...(navigator.getGamepads?.() ?? [])].some(Boolean)) on();
    return () => { active = false; cancelAnimationFrame(raf); window.removeEventListener("gamepadconnected", on); window.removeEventListener("gamepaddisconnected", off); };
  }, [enabled]);
}
