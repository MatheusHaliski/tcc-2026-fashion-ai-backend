"use client";
import { useState } from "react";
import { mediaUrl } from "@/lib/api/client";
import { Badge, Button, Chip, cn, Field, Input } from "@/components/ui";
import { tr, useI18n } from "@/lib/i18n/i18n";

/** Tipos e peças de interface compartilhados pelos modos do FLAIR (PEÇA → CARD → LOOK → TEAM/DECK → COMPETIÇÃO). */
export const STAT_LABEL: Record<string, string> = { HYPE: "HypeScore", STYLE: "Style", COLOR: "Color Harmony", OCCASION: "Occasion Fit", ORIGINALITY: "Originality", BRAND: "Brand Power", RARITY: "Rarity", TREND: "Trend", COMMUNITY: "Community", AI: "AI Score" };
export const STAT_COLOR: Record<string, string> = { HYPE: "#C6275E", STYLE: "#E0457B", COLOR: "#E9B949", OCCASION: "#2D55C9", ORIGINALITY: "#7B4FD6", BRAND: "#B8860B", RARITY: "#8a6a1c", TREND: "#1F7A76", COMMUNITY: "#F08DB1", AI: "#3a86ff" };
export interface Synergy { code: string; label: string; emoji: string; stat: string; bonus: number; }
export interface LookCardMini { id: string; name: string; imageUrl: string; category: string; rarity: string; power: number; }
export interface ModeLook { schemeId: string | null; title: string; owner: string; coverUrl?: string | null; rating: number; stats: Record<string, number>; synergies: Synergy[]; styles: string[]; occasions: string[]; cards: LookCardMini[]; }
export interface Theme { code: string; label: string; emoji: string; occasions: string[]; styles: string[]; weights: Record<string, number>; hint: string; }
export interface Round { label: string; a: string; b: string; scoreA: number; scoreB: number; winner: "A" | "B" | "DRAW"; notes: string[]; breakdown: { stat: string; label: string; weight: number; a: number; b: number }[]; }
export interface ModeResult { matchId?: string; mode: string; outcome: "WIN" | "LOSS" | "DRAW"; coins: number; rewardCapReached: boolean; scoreA: number; scoreB: number; rounds?: Round[]; theme?: Theme; opponent?: { label: string }; [k: string]: unknown; }

const OUT: Record<string, { label: string; tone: "thread" | "mark" | "chalk" }> = { WIN: { get label() { return tr("common.vitoria"); }, tone: "thread" }, LOSS: { get label() { return tr("common.derrota"); }, tone: "mark" }, DRAW: { get label() { return tr("common.empate"); }, tone: "chalk" } };

/** Card de look com a nota geral (rating), os 10 atributos em barras e as sinergias ativas. */
export function LookTile({ look, selected, onClick, compact }: { look: ModeLook; selected?: boolean; onClick?: () => void; compact?: boolean }) {
  const { t } = useI18n();
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className={cn("mode-look text-left", selected && "mode-look-on")} aria-pressed={onClick ? !!selected : undefined}>
      <div className="flex items-start gap-2">
        <div className="mode-look-cover">{look.coverUrl ? <img src={mediaUrl(look.coverUrl)} alt="" /> : look.cards.slice(0, 4).map((c) => <img key={c.id} src={mediaUrl(c.imageUrl)} alt="" />)}</div>
        <div className="min-w-0 flex-1">
          <p className="type-body font-semibold truncate">{look.title}</p>
          <p className="type-caption text-muted truncate">{t("flair.modesShared.cartas", { owner: look.owner, cardsCount: look.cards.length })}</p>
          {look.synergies.length > 0 && <p className="type-caption truncate">{look.synergies.map((s) => `${s.emoji} ${s.label}`).join(" · ")}</p>}
        </div>
        <span className="mode-rating tabular" title={t("flair.modesShared.rating_do_look")}>{look.rating}</span>
      </div>
      {!compact && <ul className="mode-stats">{Object.entries(look.stats).map(([k, v]) => <li key={k} title={STAT_LABEL[k]}><span>{STAT_LABEL[k]}</span><i><b style={{ width: `${Math.min(100, v)}%`, background: STAT_COLOR[k] }} /></i><em className="tabular">{v}</em></li>)}</ul>}
    </Tag>
  );
}

/** Seleção de looks (1 ou vários) entre os looks do jogador. */
export function LookPicker({ looks, value, onChange, max = 1, label = "Seu look" }: { looks: ModeLook[]; value: string[]; onChange: (ids: string[]) => void; max?: number; label?: string }) {
  const { t } = useI18n();
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : max === 1 ? [id] : value.length >= max ? value : [...value, id]);
  return (
    <div>
      <p className="label">{label}{max > 1 ? ` (${value.length}/${max})` : ""}</p>
      {looks.length === 0 ? <p className="type-caption text-muted">{t("flair.modesShared.crie_um_esquema_com_pecas")}</p> :
        <div className="mode-look-grid">{looks.map((l) => <LookTile key={l.schemeId ?? l.title} look={l} compact selected={value.includes(l.schemeId ?? "")} onClick={() => toggle(l.schemeId ?? "")} />)}</div>}
    </div>
  );
}

export function OpponentField({ value, onChange, allowHouse = true, label = "Oponente" }: { value: string; onChange: (v: string) => void; allowHouse?: boolean; label?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label={label} id="opp-mode" className="min-w-[180px] flex-1"><Input id="opp-mode" placeholder="@usuário" value={value === "CASA" ? "" : value} onChange={(e) => onChange(e.target.value)} /></Field>
      {allowHouse && <Chip active={value === "CASA" || value === ""} onClick={() => onChange("CASA")}>{t("flair.modesShared.a_casa_comunidade")}</Chip>}
    </div>
  );
}

export function ThemeBadge({ theme }: { theme?: Theme | null }) {
  if (!theme) return null;
  return <span className="mode-theme" title={theme.hint}>{theme.emoji} {theme.label}</span>;
}

/** Resultado de qualquer modo: placar, rodadas com barras A × B, notas (combos, bônus do tema) e recompensa. */
export function ResultView({ result, labelA = "Você", labelB }: { result: ModeResult | null; labelA?: string; labelB?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(null);
  if (!result) return null;
  const o = OUT[result.outcome] ?? OUT.DRAW;
  const rounds = result.rounds ?? [];
  const max = Math.max(1, ...rounds.map((r) => Math.max(r.scoreA, r.scoreB)));
  return (
    <div className="mode-result" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={o.tone}>{o.label}</Badge><b className="text-2xl tabular">{result.scoreA} × {result.scoreB}</b>
        <span className="type-caption text-muted">{labelA} × {labelB ?? result.opponent?.label ?? t("flair.modesShared.oponente")}</span>
        <ThemeBadge theme={result.theme} />
        <span className="type-caption ml-auto">{result.rewardCapReached ? t("flair.modesShared.teto_diario_de_partidas_premiadas") : t("common.coins", { coins: result.coins })}</span>
      </div>
      {rounds.length > 0 && <ol className="mt-3 grid gap-2">{rounds.map((r, i) => (
        <li key={i} className="flair-round">
          <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
            <b className="type-body-sm">{r.label}</b><span className="type-caption">{r.winner === "DRAW" ? t("common.empate") : r.winner === "A" ? `✔ ${labelA}` : `✔ ${labelB ?? "Oponente"}`}</span>
          </button>
          <div className="flair-round-bars">
            <span className={r.winner === "A" ? "win" : ""}>{r.a || labelA}</span><i><b style={{ width: `${(r.scoreA / max) * 100}%` }} /></i><em className="tabular">{r.scoreA}</em>
            <span className={r.winner === "B" ? "win" : ""}>{r.b || labelB}</span><i><b className="alt" style={{ width: `${(r.scoreB / max) * 100}%` }} /></i><em className="tabular">{r.scoreB}</em>
          </div>
          {r.notes.length > 0 && <p className="type-caption text-muted">{r.notes.join(" · ")}</p>}
          {open === i && r.breakdown.length > 0 && (
            <table className="mode-breakdown"><thead><tr><th>{t("flair.modesShared.atributo")}</th><th>{t("flair.modesShared.peso")}</th><th>A</th><th>B</th></tr></thead>
              <tbody>{r.breakdown.map((x) => <tr key={x.stat} className={x.weight > 1 ? "font-semibold" : ""}><td>{x.label}</td><td className="tabular">×{Number(x.weight).toFixed(1)}</td><td className={cn("tabular", x.a > x.b && "text-thread")}>{x.a}</td><td className={cn("tabular", x.b > x.a && "text-mark")}>{x.b}</td></tr>)}</tbody></table>
          )}
        </li>))}</ol>}
    </div>
  );
}

export function PlayButton({ busy, disabled, onClick, children }: { busy: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Button variant="primary" loading={busy} disabled={disabled} onClick={onClick}>{children}</Button>;
}
