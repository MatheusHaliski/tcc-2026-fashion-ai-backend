"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { availability, HUB_GROUPS, HUB_MODES, isHubMode, LEGACY_TABS, readSelected, writeSelected, type HubGroup, type HubMode, type HubModeId, type HubSummary } from "@/lib/flair/hub";
import type { CbcList } from "@/lib/flair/cbc";
import type { MomentsHome } from "@/lib/moments/types";
import { Badge, Button, cn, PageHeader } from "@/components/ui";
import { FlairHubIcon } from "@/components/flair/hub-icons";
import { DemoPlayer } from "@/components/flair/demo-player";
import { GuideAuto, HowItWorks, useGuide } from "@/components/guide/guide";

interface Me { coins: number; rank: { label: string; points: number }; wins: number; losses: number; draws: number }
interface Quest { done: boolean }
interface Combo { active: boolean; available: boolean; complete: boolean; redemption?: unknown }

/**
 * Central FLAIR: lista vertical de modos (ícone + nome) e, ao lado, o painel do modo escolhido com título, objetivo,
 * demonstração gravada e a ação para começar. Escolher nunca inicia o jogo. A escolha fica guardada por conta e volta
 * ao retornar de uma partida. Navegação por toque, teclado (setas, Home/End, Enter) e controle (direcional + A/B).
 */
export function FlairHub() {
  const { t } = useI18n(); const { user } = useAuth(); const router = useRouter(); const sp = useSearchParams(); const { gate } = useGuide();
  const legacy = sp.get("tab"); const asked = sp.get("mode");
  useEffect(() => { if (legacy && LEGACY_TABS[legacy]) router.replace(LEGACY_TABS[legacy].href); }, [legacy, router]);

  const [selected, setSelected] = useState<HubModeId>(() => (isHubMode(asked) ? asked : "matches"));
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    // sem ?mode= na URL, volta ao último item escolhido por esta conta
    if (!isHubMode(asked)) { const last = readSelected(user?.id); if (last) setSelected(last); }
    setRestored(true);
  }, [asked, user?.id]);
  const select = useCallback((id: HubModeId) => {
    setSelected(id); writeSelected(user?.id, id);
    try { window.history.replaceState(window.history.state, "", `/flair?mode=${id}`); } catch { /* sem histórico (teste) */ }
  }, [user?.id]);

  const me = useApi<Me>((signal) => api.get("/api/flair/me", { signal }), []);
  const decks = useApi<unknown[]>((signal) => api.get("/api/flair/decks", { signal }), []);
  const cards = useApi<{ total: number }>((signal) => api.get("/api/me/flair/cards", { signal }), []);
  const cbc = useApi<CbcList>((signal) => api.get("/api/flair/challenges", { signal }), []);
  const moments = useApi<MomentsHome>((signal) => api.get("/api/moments", { signal }), []);
  const challenges = useApi<{ active?: unknown[]; invites?: unknown[] }>((signal) => api.get("/api/me/challenges", { signal }), []);
  const combos = useApi<Combo[]>((signal) => api.get("/api/flair/combinations", { signal }), []);
  const quests = useApi<Quest[]>((signal) => api.get("/api/flair/quests", { signal }), []);
  const vouchers = useApi<unknown[]>((signal) => api.get("/api/flair/vouchers", { signal }), []);
  const summary = useMemo<HubSummary>(() => ({
    decks: decks.data ? decks.data.length : null,
    cards: cards.data ? cards.data.total : null,
    cbc: cbc.data ? { now: cbc.data.now.length, upcoming: cbc.data.upcoming.length, always: cbc.data.always.length } : null,
    moments: moments.data ? { active: moments.data.active.length, upcoming: moments.data.upcoming.length } : null,
    challenges: challenges.data ? { active: challenges.data.active?.length ?? 0, invites: challenges.data.invites?.length ?? 0 } : null,
    combos: combos.data ? { active: combos.data.filter((c) => c.active !== false && c.available !== false).length, ready: combos.data.filter((c) => c.complete && !c.redemption).length } : null,
    quests: quests.data ? { done: quests.data.filter((q) => q.done).length, total: quests.data.length } : null,
    coins: me.data?.coins ?? null,
    vouchers: vouchers.data ? vouchers.data.length : null,
  }), [decks.data, cards.data, cbc.data, moments.data, challenges.data, combos.data, quests.data, me.data, vouchers.data]);

  const mode = HUB_MODES.find((m) => m.id === selected) ?? HUB_MODES[0];
  const av = availability(mode.id, summary);
  const primaryHref = av.action === "unlock" && av.unlockHref ? av.unlockHref : mode.href;
  const start = useCallback(() => {
    // primeira entrada no modo: a explicação abre antes; "Entendi, começar" leva à rota. Depois, vai direto.
    if (av.action === "unlock") { router.push(primaryHref); return; }
    gate(mode.guide, () => router.push(primaryHref));
  }, [av.action, gate, mode.guide, primaryHref, router]);

  // teclado: setas movem e escolhem (ativação automática, como abas); Home/End; Enter/Espaço começam
  const listRef = useRef<HTMLDivElement>(null);
  const order = HUB_MODES.map((m) => m.id);
  const move = useCallback((delta: number) => {
    const i = order.indexOf(selected); const next = order[(i + delta + order.length) % order.length];
    select(next);
    listRef.current?.querySelector<HTMLElement>(`[data-mode="${next}"]`)?.focus();
  }, [order, selected, select]);
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
    else if (e.key === "Home") { e.preventDefault(); select(order[0]); listRef.current?.querySelector<HTMLElement>(`[data-mode="${order[0]}"]`)?.focus(); }
    else if (e.key === "End") { e.preventDefault(); const last = order[order.length - 1]; select(last); listRef.current?.querySelector<HTMLElement>(`[data-mode="${last}"]`)?.focus(); }
    else if (e.key === "Enter") { e.preventDefault(); start(); }
  };
  useGamepad({ onMove: move, onPrimary: start, enabled: restored });

  const m = me.data;
  return (
    <div className="flair-hub" data-selected={mode.id}>
      <PageHeader title={t("flair.hub.title")} kicker={t("flair.hub.kicker")}
        actions={<div className="flex flex-wrap items-center gap-2"><HowItWorks id="games.hub" />{m && <><Badge tone="thread">{m.rank.label}</Badge><Badge>{t("flair.coins_3", { coins: m.coins })}</Badge></>}</div>} />
      <GuideAuto id="games.hub" />
      <div className="flair-hub-body">
        <div ref={listRef} className="flair-hub-nav" role="tablist" aria-label={t("flair.hub.nav_label")} aria-orientation="vertical" onKeyDown={onKey}>
          {HUB_GROUPS.map((g) => (
            <div key={g} className="flair-hub-group" role="presentation">
              <p className="flair-hub-group-title" aria-hidden>{t(`flair.hub.group.${g}`)}</p>
              {HUB_MODES.filter((x) => x.group === g).map((x) => <NavItem key={x.id} mode={x} selected={x.id === mode.id} summary={summary} onSelect={() => select(x.id)} />)}
            </div>
          ))}
        </div>
        <section className="flair-hub-panel" role="tabpanel" id={`flair-panel-${mode.id}`} aria-labelledby={`flair-tab-${mode.id}`} tabIndex={-1}>
          <div className="flair-hub-panel-head">
            <FlairHubIcon id={mode.id} size={28} state={av.available ? "selected" : "unavailable"} />
            <div className="min-w-0">
              <p className="type-label text-muted">{t(`flair.hub.group.${mode.group}`)}{mode.id === "cbc" ? ` · ${t("flair.hub.mode.cbc.kicker")}` : ""}</p>
              <h2 className="flair-hub-title type-display">{t(`flair.hub.mode.${mode.id}.title`)}</h2>
            </div>
          </div>
          <p className="flair-hub-lead type-body-lg">{t(`flair.hub.mode.${mode.id}.lead`)}</p>
          <DemoPlayer key={mode.id} demo={mode.demo} title={t(`flair.hub.mode.${mode.id}.title`)} description={t(`flair.hub.mode.${mode.id}.demo`)} />
          <div className="flair-hub-actions">
            <Button variant="primary" size="lg" className="flair-hub-play" onClick={start} data-testid="hub-primary">
              {t(`flair.hub.action.${av.action}`)}
            </Button>
            <HowItWorks id={mode.guide} className="btn btn-lg" />
            {av.status && <span className={cn("flair-hub-status", !av.available && "is-unavailable")} role="status">{t(av.status.key, av.status.vars)}</span>}
            {av.action === "unlock" && <Link href={mode.href} className="btn btn-ghost btn-lg">{t("flair.hub.action.open_anyway")}</Link>}
          </div>
        </section>
      </div>
    </div>
  );
}

function NavItem({ mode, selected, summary, onSelect }: { mode: HubMode; selected: boolean; summary: HubSummary; onSelect: () => void }) {
  const { t } = useI18n();
  const av = availability(mode.id, summary);
  return (
    <button type="button" role="tab" id={`flair-tab-${mode.id}`} aria-selected={selected} aria-controls={`flair-panel-${mode.id}`} tabIndex={selected ? 0 : -1} data-mode={mode.id}
      className={cn("flair-hub-item", selected && "is-selected", !av.available && "is-unavailable")} onClick={onSelect}>
      <FlairHubIcon id={mode.id} size={24} state={selected ? "selected" : av.available ? "normal" : "unavailable"} />
      <span className="flair-hub-item-text">
        <span className="flair-hub-item-name">{t(`flair.hub.mode.${mode.id}.title`)}</span>
        {!av.available && <span className="flair-hub-item-flag">{t("flair.hub.unavailable")}</span>}
      </span>
      <span className="flair-hub-item-indicator" aria-hidden />
    </button>
  );
}

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
