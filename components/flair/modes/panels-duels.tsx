"use client";
import { useMemo, useState } from "react";
import { useApi } from "@/lib/hooks/use-api";
import type { FlairCard } from "@/components/flair/flair-card";
import { api } from "@/lib/api/client";
import { Field, Select } from "@/components/ui";
import { LookPicker, LookTile, OpponentField, PlayButton, type ModeLook, type ModeResult } from "@/components/flair/modes-shared";
import { useI18n } from "@/lib/i18n/i18n";
import { DeckHand } from "@/components/flair/arena/deck-hand";
import { ModeOutcome } from "@/components/flair/arena/mode-outcome";
import { TacticsCard } from "@/components/flair/arena/tactics-card";
import { useInvite } from "@/components/flair/arena/invite-banner";
import { FaiNetworkPicker } from "@/components/flair/network/fai-network-picker";
import { usePlay } from "@/components/flair/modes/use-play";
import { handOf, lookOf, themeOf, type PanelProps } from "@/components/flair/modes/types";

/**
 * Confrontos diretos (look × look): Battle of Looks, Squad 5×5, Combo Battle, Wardrobe Wars e Tag Team. Em todos o
 * adversário é a Casa (solo) ou alguém da rede FAI escolhido na busca (multiplayer; quem chegou por convite já vem com o
 * rival escolhido). Antes de jogar: a leitura tática e a mão de cartas de roupa; depois, a arena do confronto.
 */
function useRival() {
  const { rival } = useInvite();
  return useState(rival ?? "CASA");
}
const opponentOf = (opp: string) => opp || "CASA";

export function BattlePanel({ looks, catalog, onDone }: PanelProps) {
  const { t } = useI18n();
  const [pick, setPick] = useState<string[]>([]); const [opp, setOpp] = useRival(); const [theme, setTheme] = useState("");
  const { busy, result, play } = usePlay();
  const r = result as (ModeResult & { me?: ModeLook; opponent?: { label: string; look: ModeLook } }) | null;
  return (
    <div className="grid gap-3">
      <Field label={t("settings.theme")} id="b-theme"><Select id="b-theme" value={theme} onChange={(e) => setTheme(e.target.value)}><option value="">{t("flair.modes.sortear_tema")}</option>{catalog.themes.map((x) => <option key={x.code} value={x.code}>{x.emoji} {x.label}</option>)}</Select></Field>
      <TacticsCard looks={looks} theme={themeOf(catalog, theme)} onPick={setPick} />
      <LookPicker looks={looks} value={pick} onChange={setPick} />
      <DeckHand cards={handOf(looks, pick)} />
      <OpponentField value={opp} onChange={setOpp} />
      <div><PlayButton busy={busy} disabled={!pick[0] || !opp} onClick={() => play(() => api.post("/api/flair/modes/battle", { schemeId: pick[0], opponent: opponentOf(opp), theme: theme || null })).then(onDone)}>{t("flair.modes.batalhar")}</PlayButton></div>
      {r && <div className="grid gap-3 md:grid-cols-2">{r.me && <LookTile look={r.me} />}{r.opponent?.look && <LookTile look={r.opponent.look} />}</div>}
      <ModeOutcome result={result} myLook={lookOf(looks, pick[0])} />
    </div>
  );
}

export function SquadPanel({ looks, onDone }: PanelProps) {
  const { t } = useI18n();
  const [pick, setPick] = useState<string[]>([]); const [opp, setOpp] = useRival();
  const { busy, result, play } = usePlay();
  return (
    <div className="grid gap-3">
      <TacticsCard looks={looks} slots={5} onPick={setPick} />
      <LookPicker looks={looks} value={pick} onChange={setPick} max={5} label={t("flair.modes.seu_fashion_squad_vazio_o")} />
      <DeckHand cards={handOf(looks, pick)} />
      <OpponentField value={opp} onChange={setOpp} />
      <div><PlayButton busy={busy} disabled={!opp} onClick={() => play(() => api.post("/api/flair/modes/squad", { schemeIds: pick, opponent: opponentOf(opp) })).then(onDone)}>{t("flair.modes.jogar_5_5")}</PlayButton></div>
      <p className="type-caption text-muted">{t("flair.modes.rodadas_date_night_business_meeting")}</p>
      <ModeOutcome result={result} myLook={lookOf(looks, pick[0])} />
    </div>
  );
}

export function ComboPanel({ looks, onDone }: PanelProps) {
  const { t } = useI18n();
  const [pick, setPick] = useState<string[]>([]); const [opp, setOpp] = useRival(); const { busy, result, play } = usePlay();
  const book = (result as (ModeResult & { comboBook?: string[] }) | null)?.comboBook;
  return (
    <div className="grid gap-3">
      <LookPicker looks={looks} value={pick} onChange={setPick} />
      <DeckHand cards={handOf(looks, pick)} />
      <OpponentField value={opp} onChange={setOpp} />
      <div><PlayButton busy={busy} disabled={!pick[0] || !opp} onClick={() => play(() => api.post("/api/flair/modes/combo", { schemeId: pick[0], opponent: opponentOf(opp) })).then(onDone)}>{t("flair.modes.combo_battle")}</PlayButton></div>
      <ModeOutcome result={result} myLook={lookOf(looks, pick[0])} />
      <ul className="fai-list type-caption">{(book ?? [t("flair.modes.streetwear_combo_tenis_cargo_jeans"), t("flair.modes.classic_formal_blazer_camisa_sapato"), t("flair.modes.monochrome_3_pecas_da_mesma"), t("flair.modes.brand_loyalty_3_da_mesma"), t("flair.modes.mix_match_3_marcas_diferentes"), t("flair.modes.vintage_revival_2_pecas_vintage")]).map((x) => <li key={x}>{x}</li>)}</ul>
    </div>
  );
}

export function WardrobePanel({ onDone }: PanelProps) {
  const { t } = useI18n();
  const [opp, setOpp] = useRival(); const { busy, result, play } = usePlay();
  const cards = useApi<{ cards: FlairCard[] }>((signal) => api.get("/api/flair/cards", { signal }), []);
  const top = useMemo(() => [...(cards.data?.cards ?? [])].sort((a, b) => b.power - a.power).slice(0, 8), [cards.data]);
  // o guarda-roupa inteiro joga: as cartas mais fortes representam o lado da pessoa no palco, rodada a rodada
  const wardrobeLook = useMemo<ModeLook | null>(() => (top.length ? { schemeId: null, title: t("flair.voce"), owner: "", rating: 0, stats: {}, synergies: [], styles: [], occasions: [],
    cards: top.map((c) => ({ id: c.id, name: c.name, imageUrl: c.imageUrl ?? "", category: c.category, rarity: c.rarity, power: c.power })) } : null), [top, t]);
  return (
    <div className="grid gap-3">
      <DeckHand cards={top} title={t("flair.arena.guarda_roupa_em_jogo", { n: cards.data?.cards.length ?? 0 })} />
      <OpponentField value={opp} onChange={setOpp} label={t("flair.modes.guarda_roupa_adversario")} />
      <div><PlayButton busy={busy} disabled={!opp.trim()} onClick={() => play(() => api.post("/api/flair/modes/wardrobe-wars", { opponent: opp })).then(onDone)}>{t("flair.modes.guarda_roupa_guarda_roupa")}</PlayButton></div>
      <p className="type-caption text-muted">{t("flair.modes.do_oponente_contam_so_pecas")}</p>
      <ModeOutcome result={result} myLook={wardrobeLook} />
    </div>
  );
}

export function TagPanel({ looks, onDone }: PanelProps) {
  const { rich, t } = useI18n();
  const { rival } = useInvite();
  const [pick, setPick] = useState<string[]>([]); const [partner, setPartner] = useState<string[]>(rival ? [rival] : []); const [rivals, setRivals] = useState<string[]>([]);
  const { busy, result, play } = usePlay();
  const r = result as (ModeResult & { teamA?: { harmony: number }; teamB?: { harmony: number } }) | null;
  return (
    <div className="grid gap-3">
      <LookPicker looks={looks} value={pick} onChange={setPick} />
      <DeckHand cards={handOf(looks, pick)} />
      <div className="grid gap-3 md:grid-cols-2">
        <FaiNetworkPicker id="tt-p" label={t("flair.modes.sua_dupla_usuario")} value={partner} onChange={setPartner} exclude={rivals} />
        <FaiNetworkPicker id="tt-o" label={t("flair.modes.dupla_adversaria_opcional")} value={rivals} onChange={setRivals} max={2} exclude={partner} />
      </div>
      <div><PlayButton busy={busy} disabled={!pick[0] || !partner[0]} onClick={() => play(() => api.post("/api/flair/modes/tag-team", { schemeId: pick[0], partner: partner[0], opponents: rivals.length === 2 ? rivals : [] })).then(onDone)}>{t("flair.modes.jogar_em_dupla")}</PlayButton></div>
      {r?.teamA && <p className="type-body-sm">{rich("flair.modes.team_harmony", { harmony: r.teamA.harmony, harmony2: r.teamB?.harmony }, { 0: ($c) => <b>{$c}</b> })}</p>}
      <ModeOutcome result={result} myLook={lookOf(looks, pick[0])} labelA={t("flair.modes.sua_dupla")} labelB={t("flair.modes.dupla_adversaria")} />
    </div>
  );
}
