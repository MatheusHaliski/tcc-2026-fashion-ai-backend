"use client";
import { useEffect, useMemo, useState } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { Button, cn, Skeleton, useToast } from "@/components/ui";
import { FlairCardView, type FlairCard } from "@/components/flair/flair-card";
import { PlayButton, ThemeBadge, type ModeResult, type Theme } from "@/components/flair/modes-shared";
import { tr, useI18n } from "@/lib/i18n/i18n";
import { DeckHand, type HandCard } from "@/components/flair/arena/deck-hand";
import { ModeOutcome } from "@/components/flair/arena/mode-outcome";
import { usePlay } from "@/components/flair/modes/use-play";
import type { PanelProps } from "@/components/flair/modes/types";

/** Modos montados carta a carta (cartas de roupa soltas, não looks prontos): Deck Battle, FLAIR Draft e FLAIR Chess. */

const toHand = (cards: FlairCard[], ids: string[]): HandCard[] => ids.map((id) => cards.find((c) => c.id === id)).filter((c): c is FlairCard => !!c);

export function DeckPanel({ onDone }: PanelProps) {
  const { rich, t } = useI18n();
  const toast = useToast();
  const deck = useApi<{ cards: FlairCard[]; valid: boolean; suggestion: string[] }>((signal) => api.get("/api/flair/modes/deck", { signal }), []);
  const all = useApi<{ cards: FlairCard[] }>((signal) => api.get("/api/flair/cards", { signal }), []);
  const [sel, setSel] = useState<string[]>([]); const [game, setGame] = useState<{ id: string; challenge: Theme; hand: FlairCard[]; hint: string[] } | null>(null); const [hand, setHand] = useState<string[]>([]);
  const { busy, result, setResult, play } = usePlay();
  useEffect(() => { if (deck.data) setSel(deck.data.cards.map((c) => c.id)); }, [deck.data]);
  const byCat = (cat: string) => (all.data?.cards ?? []).filter((c) => sel.includes(c.id) && (c.category === cat || (cat === "upper_piece" && c.category === "full_body_piece"))).length;
  async function save(ids: string[]) { try { deck.setData(await api.put("/api/flair/modes/deck", { pieceIds: ids })); toast.success(t("flair.modes.deck_salvo")); } catch (e) { toast.fromError(e); } }
  return (
    <div className="grid gap-3">
      <p className="type-body-sm">{rich("flair.modes.deck_12_superiores_4_inferiores", { selCount: sel.length, byCat: byCat("upper_piece"), byCat2: byCat("lower_piece"), byCat3: byCat("shoes_piece"), byCat4: byCat("accessory_piece") }, { 0: ($c) => <b>{$c}</b> })}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">{(all.data?.cards ?? []).map((c) => <FlairCardView key={c.id} card={c} size="sm" selected={sel.includes(c.id)} onClick={() => setSel(sel.includes(c.id) ? sel.filter((x) => x !== c.id) : sel.length >= 12 ? sel : [...sel, c.id])} />)}</div>
      <div className="flex flex-wrap gap-2"><Button onClick={() => deck.data && setSel(deck.data.suggestion)}>{t("flair.modes.usar_sugestao")}</Button><Button onClick={() => save(sel)} disabled={sel.length !== 12}>{t("flair.modes.salvar_deck")}</Button>
        <PlayButton busy={busy} disabled={!deck.data?.valid} onClick={async () => { setResult(null); const g = await play(() => api.post<{ id: string; challenge: Theme; hand: FlairCard[]; hint: string[] }>("/api/flair/modes/deck/battle"), false); if (g) { setGame(g); setHand([]); } }}>{t("flair.modes.nova_partida")}</PlayButton></div>
      {game && !result && <div className="surface p-3">
        <p className="type-body">{t("flair.modes.desafio")}{" "}<ThemeBadge theme={game.challenge} />{" "}{t("flair.modes.monte_o_melhor_look_com")}</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{game.hand.map((c) => <FlairCardView key={c.id} card={c} size="sm" selected={hand.includes(c.id)} onClick={() => setHand(hand.includes(c.id) ? hand.filter((x) => x !== c.id) : hand.length >= 5 ? hand : [...hand, c.id])} />)}</div>
        <DeckHand cards={toHand(game.hand, hand)} title={t("flair.arena.cartas_em_jogo", { n: hand.length })} />
        <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => setHand(game.hint)}>{t("flair.modes.dica_da_ia")}</Button><PlayButton busy={busy} disabled={hand.length < 2} onClick={() => play(() => api.post(`/api/flair/modes/deck/battle/${game.id}/play`, { pieceIds: hand })).then(onDone)}>{t("flair.modes.jogar_look")}</PlayButton></div>
      </div>}
      <ModeOutcome result={result} labelB={t("flair.modes.a_casa")} />
    </div>
  );
}

interface DraftState { id: string; status: string; pool: FlairCard[]; mine: FlairCard[]; theirs: FlairCard[]; pick: number; turn: string; order: string; themes: Theme[]; }
export function DraftPanel({ onDone }: PanelProps) {
  const { t } = useI18n();
  const toast = useToast(); const [d, setD] = useState<DraftState | null>(null); const [assign, setAssign] = useState<Record<string, number>>({});
  const { busy, result, setResult, play } = usePlay();
  async function pick(id: string) { if (!d) return; try { setD(await api.post<DraftState>(`/api/flair/modes/draft/${d.id}/pick`, { pieceId: id })); } catch (e) { toast.fromError(e); } }
  const looksOf = (n: number) => Object.entries(assign).filter(([, v]) => v === n).map(([k]) => k);
  return (
    <div className="grid gap-3">
      <div><PlayButton busy={busy} onClick={async () => { setResult(null); setAssign({}); const r = await play(() => api.post<DraftState>("/api/flair/modes/draft"), false); if (r) setD(r); }}>{t("flair.modes.novo_draft")}</PlayButton></div>
      {d && !result && <>
        <p className="type-caption">{t("flair.modes.ordem_escolha_20_temas", { order: d.order, Math: Math.min(d.pick + 1, 20), value: d.turn === "COMPOSE" ? t("flair.modes.monte_seus_3_looks") : d.turn === "A" ? t("flair.modes.sua_vez") : t("flair.modes.vez_da_ia") })}{" "}{d.themes.map((x) => `${x.emoji} ${x.label}`).join(" · ")}</p>
        {d.turn === "A" && <div className="flex flex-wrap gap-2">{d.pool.map((c) => <FlairCardView key={c.id} card={c} size="sm" onClick={() => pick(c.id)} />)}</div>}
        <div className="grid gap-2 md:grid-cols-2"><div><p className="label">{t("flair.modes.suas_escolhas", { mineCount: d.mine.length })}</p><div className="flex flex-wrap gap-1">{d.mine.map((c) => <button key={c.id} type="button" className="chip" aria-pressed={!!assign[c.id]} onClick={() => setAssign({ ...assign, [c.id]: ((assign[c.id] ?? 0) + 1) % 4 })}>{c.name}{assign[c.id] ? t("flair.modes.look", { assign: assign[c.id] }) : ""}</button>)}</div></div>
          <div><p className="label">{t("flair.modes.escolhas_da_ia", { theirsCount: d.theirs.length })}</p><p className="type-caption text-muted">{d.theirs.map((c) => c.name).join(", ")}</p></div></div>
        <DeckHand cards={d.mine} />
        {d.turn === "COMPOSE" && <><p className="type-caption text-muted">{t("flair.modes.toque_numa_escolha_para_manda")}</p>
          <PlayButton busy={busy} disabled={[1, 2, 3].some((n) => looksOf(n).length < 2)} onClick={() => play(() => api.post(`/api/flair/modes/draft/${d.id}/looks`, { looks: [looksOf(1), looksOf(2), looksOf(3)] })).then(onDone)}>{t("flair.modes.enfrentar_a_ia")}</PlayButton></>}
      </>}
      <ModeOutcome result={result} labelB={t("flair.modes.ia_do_draft")} />
    </div>
  );
}

const SLOT_LABEL: Record<string, string> = { get ACCESSORY_L() { return tr("common.acessorio"); }, get TOP() { return tr("flair.modes.top"); }, get ACCESSORY_R() { return tr("common.acessorio"); }, get BOTTOM() { return tr("flair.modes.bottom"); }, get HERO() { return tr("flair.modes.hero_1_25"); }, get OUTERWEAR() { return tr("flair.modes.outerwear"); }, get SHOES_L() { return tr("common.calcado"); }, get SUPPORT() { return tr("flair.modes.support"); }, get SHOES_R() { return tr("common.calcado"); } };
export function ChessPanel({ onDone }: PanelProps) {
  const { t } = useI18n();
  const info = useApi<{ slots: string[]; cards: FlairCard[]; suggestion: Record<string, string>; rules: string[] }>((signal) => api.get("/api/flair/modes/chess", { signal }), []);
  const [board, setBoard] = useState<Record<string, string>>({}); const [hand, setHand] = useState<string | null>(null); const { busy, result, play } = usePlay();
  const cards = useMemo(() => Object.fromEntries((info.data?.cards ?? []).map((c) => [c.id, c])), [info.data]);
  if (info.loading || !info.data) return <Skeleton className="h-48" />;
  const r = result as (ModeResult & { me?: { bonuses: string[] }; opponent?: { label: string; board: { bonuses: string[] }; cards: Record<string, string> } }) | null;
  return (
    <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
      <div className="mode-chess" role="grid" aria-label={t("flair.modes.tabuleiro_3_3")}>{info.data.slots.map((s) => (
        <button key={s} type="button" className={cn("mode-cell", s === "HERO" && "mode-cell-hero", s === "SUPPORT" && "mode-cell-support")} onClick={() => { if (hand) { setBoard({ ...Object.fromEntries(Object.entries(board).filter(([, v]) => v !== hand)), [s]: hand }); setHand(null); } else if (board[s]) { const n = { ...board }; delete n[s]; setBoard(n); } }}>
          <small>{SLOT_LABEL[s]}</small>{board[s] && cards[board[s]] ? <><img src={mediaUrl(cards[board[s]].imageUrl)} alt="" /><em>{cards[board[s]].name}</em></> : <span className="text-faint">{t("flair.modes.vazio")}</span>}
        </button>))}</div>
      <div className="grid gap-2">
        <p className="type-caption">{t("flair.modes.toque_numa_carta_e_depois")}</p>
        <div className="flex gap-2 overflow-x-auto pb-1">{info.data.cards.map((c) => <FlairCardView key={c.id} card={c} size="sm" selected={hand === c.id} dim={Object.values(board).includes(c.id)} onClick={() => setHand(c.id)} />)}</div>
        <div className="flex flex-wrap gap-2"><Button onClick={() => setBoard(info.data!.suggestion)}>{t("flair.modes.sugestao")}</Button><PlayButton busy={busy} disabled={Object.keys(board).length < 3} onClick={() => play(() => api.post("/api/flair/modes/chess", { board })).then(onDone)}>{t("flair.modes.jogar_contra_a_ia")}</PlayButton></div>
        <ul className="fai-list type-caption text-muted">{info.data.rules.map((x) => <li key={x}>{x}</li>)}</ul>
        <ModeOutcome result={result} labelB={t("flair.modes.ia_estrategista")} />
        {r?.me && <div className="grid gap-2 md:grid-cols-2"><div><p className="label">{t("flair.modes.seus_bonus")}</p><ul className="fai-list type-caption">{r.me.bonuses.map((x, i) => <li key={i}>{x}</li>)}</ul></div><div><p className="label">{t("flair.modes.bonus_da_ia")}</p><ul className="fai-list type-caption">{r.opponent?.board.bonuses.map((x, i) => <li key={i}>{x}</li>)}</ul></div></div>}
      </div>
    </div>
  );
}
