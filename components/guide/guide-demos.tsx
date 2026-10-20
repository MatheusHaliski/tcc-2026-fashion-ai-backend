"use client";
import { useEffect } from "react";
import type { PieceView, SchemeView } from "@/lib/api/types";
import { primeHype } from "@/lib/hype/use-hype";
import { useI18n } from "@/lib/i18n/i18n";
import type { GuideDemo as DemoId } from "@/lib/guides/registry";
import { FaiIcon } from "@/components/fai-icon";
import { PieceCard } from "@/components/piece-card";
import { SealMedallion } from "@/components/seal-medallion";
import { FlairGameCard, type FlairCollectionCard } from "@/components/flair/flair-game-card";
import { CbcSceneArt } from "@/components/flair/cbc-scene";
import { FlairHubIcon } from "@/components/flair/hub-icons";
import type { HubModeId } from "@/lib/flair/hub";

/**
 * Exemplos ilustrados dos tutoriais "Como funciona". Usam os componentes reais (PieceCard, FlairGameCard, selo, ícone
 * oficial de FAI Points) com dados DE EXEMPLO: IDs com prefixo "demo-" (o Hype nunca vai à API), dono fictício sem
 * permissão de edição e palco inerte no diálogo — nada aqui chama a API, consome carta ou concede ponto.
 * A animação é só CSS (pausável; com movimento reduzido fica no quadro final).
 */
import { demoPiece, demoCard, DEMO_SCHEME_SEAL, DEMO_HYPE, DEMO_BRAND, POINTS_NAME, DEMO_PIECE_NAME_2 } from "./demo-data";
export { demoPiece, demoCard, DEMO_SCHEME_SEAL } from "./demo-data";
import { FeedGuideDemo } from "./feed-guide-demo";

export function GuideDemo({ demo }: { demo: DemoId }) {
  useEffect(() => { primeHype("PIECE", DEMO_HYPE); }, []);
  switch (demo) {
    case "games": return <GamesDemo />;
    case "cbc": return <CbcDemo />;
    case "calendar": return <CalendarDemo />;
    case "challenge": return <ChallengeDemo />;
    case "feed": return <FeedGuideDemo />;
    case "schemeSeal": return <SchemeSealDemo />;
    case "seal": return <SealDemo />;
    case "copilot": return <CopilotDemo />;
    case "autopilot": return <AutopilotDemo />;
    case "explore": return <ExploreDemo />;
    case "hype": return <HypeDemo />;
    case "brandVisitor": return <BrandDemo operator={false} />;
    case "brandOperator": return <BrandDemo operator />;
    case "points": return <PointsDemo />;
    case "shop": return <ShopDemo />;
    case "pointsEarn": return <PointsEarnDemo />;
    case "highlights": return <HighlightsDemo />;
    case "flairMatch": return <FlairMatchDemo />;
    case "flairCards": return <FlairCardsDemo />;
    case "flairDecks": return <FlairDecksDemo />;
    case "flairShops": return <FlairShopsDemo />;
    case "flairWallet": return <FlairWalletDemo />;
    case "flairQuests": return <FlairQuestsDemo />;
    default: return null;
  }
}

function GamesDemo() {
  const { t } = useI18n();
  const cols: { k: HubModeId; hint: string }[] = [{ k: "matches", hint: "flair" }, { k: "cbc", hint: "cbc" }, { k: "moments", hint: "moments" }, { k: "challenges", hint: "challenges" }];
  return (
    <div className="gd-games gd-games-4">
      {cols.map((c, i) => (
        <div key={c.k} className={i === 0 ? "gd-tile is-on" : "gd-tile"}>
          <FlairHubIcon id={c.k} size={24} state={i === 0 ? "selected" : "normal"} />
          <b>{t(`flair.hub.mode.${c.k}.title`)}</b>
          <span className="type-caption text-muted">{t(`guide.demo.games.${c.hint}_hint`)}</span>
        </div>
      ))}
    </div>
  );
}

/** Destaques: o Inventory Score com a faixa, três das sete dimensões (uma subindo) e uma conquista desbloqueada. */
function HighlightsDemo() {
  const { t } = useI18n();
  const dims = [{ k: "use", v: 82 }, { k: "variety", v: 64, anim: true }, { k: "rescue", v: 45 }];
  return (
    <div className="gd-highlights">
      <div className="gd-score surface">
        <span className="type-label text-muted">{t("highlights.inventory_score")}</span>
        <b className="gd-score-value tabular">712</b>
        <span className="type-caption">{t("guide.demo.highlights.band")}</span>
        <span className="gd-score-bands" aria-hidden><i /><i /><i className="is-here" /><i /></span>
      </div>
      <ul className="gd-dims surface">
        {dims.map((d) => <li key={d.k}><span>{t(`guide.demo.highlights.${d.k}`)}</span><i><b className={d.anim ? "gd-anim-progress" : undefined} style={{ width: `${d.v}%` }} /></i><em className="tabular">{d.v}</em></li>)}
        <li className="gd-dims-foot"><span className="chip is-active gd-anim-show">🏅 {t("guide.demo.highlights.achievement")}</span><span className="type-caption text-muted">{t("guide.demo.highlights.why")}</span></li>
      </ul>
    </div>
  );
}

/** Como ganhar: as ações que rendem pontos, com o limite por dia e a ação que acabou de contar. */
function PointsEarnDemo() {
  const { t } = useI18n();
  const rows = [{ k: "look", v: 10, cap: true }, { k: "moment", v: 20 }, { k: "cbc", v: 15 }];
  return (
    <div className="gd-points surface">
      <ul className="gd-ledger">{rows.map((r, i) => <li key={r.k} className={i === 0 ? "gd-anim-show" : undefined}><span>{t(`guide.demo.earn.${r.k}`)}{r.cap ? <small className="text-muted"> · {t("guide.demo.earn.cap")}</small> : null}</span><b className="tabular"><FaiIcon id="ACT-40" size={20} decorative /> +{r.v}</b></li>)}</ul>
      <span className="type-caption text-muted">{t("guide.demo.earn.note")}</span>
    </div>
  );
}

/** Partidas: duas cartas FLAIR frente a frente e o placar das rodadas (o exemplo nunca chama a API). */
function FlairMatchDemo() {
  const { t } = useI18n();
  return (
    <div className="gd-match">
      <div className="gd-match-side"><FlairGameCard card={demoCard()} size="sm" flip={false} /><span className="type-caption">{t("flair.voce")}</span></div>
      <div className="gd-match-score surface">
        <b className="tabular">3 × 2</b>
        <ul className="gd-rounds">{["EDGE", "RANGE", "CLOUT", "GLOW", "ART"].map((s, i) => <li key={s} className={i < 3 ? "is-win" : undefined}><span>{s}</span><i className={i === 2 ? "gd-anim-show" : undefined} /></li>)}</ul>
        <span className="badge badge-thread gd-anim-show2">{t("common.vitoria")}</span>
      </div>
      <div className="gd-match-side"><FlairGameCard card={demoCard({ tier: "PRATA", ovr: 70, name: DEMO_PIECE_NAME_2, brandName: null })} size="sm" flip={false} /><span className="type-caption">{t("flair.modesShared.a_casa_comunidade")}</span></div>
    </div>
  );
}

/** Minhas cartas: a peça vira cópia FLAIR (converter) e entra na coleção por nível. */
function FlairCardsDemo() {
  const { t } = useI18n();
  return (
    <div className="gd-convert">
      <div className="gd-card-frame"><PieceCard piece={demoPiece()} flip={false} /></div>
      <div className="gd-convert-arrow" aria-hidden><span className="btn btn-sm">{t("flairCollection.convert")}</span><span className="gd-arrow">→</span></div>
      <div className="gd-anim-show"><FlairGameCard card={demoCard()} size="sm" flip={false} /></div>
    </div>
  );
}

/** Decks: o esquema com peças vira um deck com poder e combos. */
function FlairDecksDemo() {
  const { t } = useI18n();
  return (
    <div className="gd-deck surface">
      <div className="gd-thumbs">{["/assets_pecas/14_jacket_jaqueta.png", "/assets_pecas/02_shirt_camisa.png", "/assets_pecas/03_Calcados/03_tenis_treino.png"].map((src) => <img key={src} src={src} alt="" />)}</div>
      <div className="gd-deck-power"><span className="type-caption text-muted">{t("guide.demo.decks.power")}</span><b className="tabular">312</b></div>
      <ul className="gd-reasons"><li>{t("guide.demo.decks.combo")}</li><li>{t("guide.demo.decks.season")}</li></ul>
    </div>
  );
}

/** Combinações das lojas: requisitos conferidos e o cupom que sai quando tudo bate. */
function FlairShopsDemo() {
  const { t } = useI18n();
  return (
    <div className="gd-challenge surface">
      <span className="badge badge-chalk">{DEMO_BRAND}</span>
      <b>{t("guide.demo.shops.combo")}</b>
      <ul className="gd-checklist"><li className="is-done">✓ {t("guide.demo.shops.req1")}</li><li className="gd-anim-check">✓ {t("guide.demo.shops.req2")}</li></ul>
      <span className="btn btn-sm btn-primary gd-anim-show">{t("flair.trocar_pelo_cupom")}</span>
    </div>
  );
}

/** Carteira: cupom emitido com código, e as moedas só compram cosméticos. */
function FlairWalletDemo() {
  const { t } = useI18n();
  return (
    <div className="gd-points surface">
      <div className="gd-balance"><b className="tabular">240</b><span>{t("guide.demo.wallet.coins")}</span></div>
      <div className="gd-voucher"><span className="type-caption text-muted">{DEMO_BRAND}</span><b>{t("guide.demo.wallet.coupon")}</b><code className="flair-code">FAI-7K2Q</code></div>
      <span className="type-caption text-muted">{t("guide.demo.wallet.note")}</span>
    </div>
  );
}

/** Missões: barra de progresso que completa e o botão de resgatar que aparece. */
function FlairQuestsDemo() {
  const { t } = useI18n();
  return (
    <div className="gd-challenge surface">
      <span className="badge badge-thread">{t("flair.diaria")}</span>
      <b>{t("guide.demo.quests.title")}</b>
      <div className="gd-progress" role="presentation"><i className="gd-anim-progress" /></div>
      <span className="type-caption tabular">3/3</span>
      <span className="btn btn-sm btn-primary gd-anim-show">{t("common.resgatar")}</span>
    </div>
  );
}

function CbcDemo() {
  const { t } = useI18n();
  return (
    <div className="gd-cbc">
      <div className="gd-mosaic">
        <CbcSceneArt scenario="primavera" />
        <div className="gd-tiles" aria-hidden>
          <i className="gd-tile-cover is-filled" /><i className="gd-tile-cover gd-anim-reveal" /><i className="gd-tile-cover" /><i className="gd-tile-cover" />
        </div>
        <span className="gd-req">{t("guide.demo.cbc.requirement")}</span>
      </div>
      <div className="gd-cbc-bank">
        <div className="gd-anim-fly"><FlairGameCard card={demoCard({ tier: "PRATA", ovr: 70 })} size="sm" flip={false} /></div>
        <span className="type-caption">{t("guide.demo.cbc.bank")}</span>
      </div>
    </div>
  );
}

function CalendarDemo() {
  const { t } = useI18n();
  const days = Array.from({ length: 28 }, (_, i) => i + 1);
  return (
    <div className="gd-cal">
      <div className="gd-cal-grid">
        {days.map((d) => (
          <span key={d} className={d >= 20 && d <= 26 ? "gd-cal-day is-event" : "gd-cal-day"}>
            {d}{d === 20 && <i className="gd-cal-chip gd-anim-pick">{t("guide.demo.calendar.event")}</i>}
          </span>
        ))}
      </div>
      <div className="gd-cal-detail gd-anim-show">
        <b>{t("guide.demo.calendar.event")}</b>
        <span className="type-caption">{t("guide.demo.calendar.period")}</span>
        <span className="type-caption">{t("guide.demo.calendar.eligibility")}</span>
        <span className="badge">{t("guide.demo.calendar.scope")}</span>
      </div>
    </div>
  );
}

function ChallengeDemo() {
  const { t } = useI18n();
  return (
    <div className="gd-challenge surface">
      <b>{t("guide.demo.challenge.title")}</b>
      <span className="type-caption text-muted">{t("guide.demo.challenge.period")}</span>
      <ul className="gd-checklist">
        <li className="is-done">✓ {t("guide.demo.challenge.req1")}</li>
        <li className="gd-anim-check">✓ {t("guide.demo.challenge.req2")}</li>
      </ul>
      <div className="gd-progress" role="presentation"><i className="gd-anim-progress" /></div>
      <span className="gd-reward"><FaiIcon id="ACT-40" size={20} decorative /> <b className="tabular">+20</b> {POINTS_NAME}</span>
    </div>
  );
}


function SchemeSealDemo() {
  const { t } = useI18n();
  return (
    <div className="gd-compare">
      <figure><div className="gd-card-frame"><PieceCard piece={demoPiece()} flip={false} /></div><figcaption>{t("guide.demo.seal.without")}</figcaption></figure>
      <figure><div className="gd-card-frame"><PieceCard piece={demoPiece()} flip={false} seals={[DEMO_SCHEME_SEAL]} /></div><figcaption>{t("guide.demo.seal.with")}</figcaption></figure>
    </div>
  );
}

function SealDemo() {
  const { t } = useI18n();
  return (
    <div className="gd-seal">
      <div className="gd-seal-step"><span className="gd-seal-locked"><SealMedallion size={56} /></span><span className="type-caption">{t("guide.demo.seal.locked")}</span></div>
      <span className="gd-arrow" aria-hidden>→</span>
      <div className="gd-seal-step gd-anim-show"><SealMedallion size={56} /><span className="type-caption">{t("guide.demo.seal.earned")}</span></div>
      <span className="gd-arrow" aria-hidden>→</span>
      <div className="gd-seal-step gd-anim-show2"><span className="badge">{t("guide.demo.seal.applied")}</span><span className="type-caption">{t("guide.demo.seal.where")}</span></div>
    </div>
  );
}

function CopilotDemo() {
  const { t } = useI18n();
  return (
    <div className="gd-copilot surface">
      <span className="badge badge-chalk">{t("copilot.sugestao_do_copilot")}</span>
      <div className="gd-thumbs">
        {["/assets_pecas/02_shirt_camisa.png", "/assets_pecas/14_jacket_jaqueta.png", "/assets_pecas/03_Calcados/03_tenis_treino.png"].map((src) => <img key={src} src={src} alt="" />)}
      </div>
      <ul className="gd-reasons">
        <li>{t("guide.demo.copilot.reason1")}</li>
        <li>{t("guide.demo.copilot.reason2")}</li>
      </ul>
      <div className="gd-actions"><span className="btn btn-sm btn-primary gd-anim-show">{t("common.salvar_como_look")}</span></div>
    </div>
  );
}

function AutopilotDemo() {
  const { t } = useI18n();
  const thumbs = ["/assets_pecas/02_shirt_camisa.png", "/assets_pecas/11_cardigan.png", "/assets_pecas/03_Calcados/03_tenis_treino.png"];
  return (
    <div className="gd-autopilot">
      <div className="gd-ap-today surface">
        <div className="gd-chips"><span className="chip is-active">{t("copilot.mode.SAFE")}</span><span className="chip">{t("copilot.mode.DISCOVERY")}</span><span className="chip">{t("copilot.mode.EXPERIMENTAL")}</span></div>
        <span className="type-caption text-muted">{t("guide.demo.autopilot.weather")}</span>
        <div className="gd-thumbs">{thumbs.map((src) => <img key={src} src={src} alt="" />)}</div>
        <span className="type-caption">{t("guide.demo.autopilot.why")}</span>
        <span className="btn btn-sm btn-primary gd-anim-show">{t("autopilot.usar_hoje")}</span>
      </div>
      <ul className="gd-week">
        {["day1", "day2", "day3"].map((d) => <li key={d} className={d === "day3" ? "is-gap" : undefined}>{t(`guide.demo.autopilot.${d}`)}</li>)}
      </ul>
      <span className="type-caption">{t("guide.demo.autopilot.never")}</span>
    </div>
  );
}

function ExploreDemo() {
  const { t } = useI18n();
  const tabs = [t("common.passarela_3d"), t("hypeTrending.title"), t("hypeRanking.title"), t("explorer.painel_global"), t("explorer.buscar_marcas_lojas")];
  return (
    <div className="gd-explore">
      <div className="gd-chips">{tabs.map((x, i) => <span key={x} className={i === 3 ? "chip is-active" : "chip"}>{x}</span>)}</div>
      <div className="gd-chips gd-anim-show"><span className="chip is-active">{t("guide.demo.explore.chip1")}</span><span className="chip is-active">{t("guide.demo.explore.chip2")}</span><span className="chip">{t("guide.demo.explore.clear")}</span></div>
      <div className="gd-results gd-anim-show2">
        {["/assets_pecas/14_jacket_jaqueta.png", "/assets_pecas/17_windbreaker_corta_vento.png", "/assets_pecas/11_cardigan.png"].map((src, i) => <span key={src} className={i === 0 ? "gd-result is-picked" : "gd-result"}><img src={src} alt="" /></span>)}
      </div>
      <span className="type-caption">{t("guide.demo.explore.why")}</span>
    </div>
  );
}

function HypeDemo() {
  const { t } = useI18n();
  const rows: { k: string; v: string; note?: string }[] = [
    { k: "POP", v: "71" }, { k: "ENG", v: "66" }, { k: "TRD", v: "74" }, { k: "RAR", v: "—", note: t("guide.demo.hype.unavailable") },
  ];
  return (
    <div className="gd-hype">
      <div className="gd-flip gd-anim-flip">
        <div className="gd-flip-front"><FlairGameCard card={demoCard()} size="sm" flip={false} /></div>
        <div className="gd-flip-back surface">
          <b>{t("hype.card.score_caption")} <span className="tabular">68</span></b>
          <span className="type-caption text-muted">{t("guide.demo.hype.period")}</span>
          <dl className="gd-factors">{rows.map((r) => <div key={r.k}><dt>{t(`flairCard.hype.${r.k}`)}</dt><dd className="tabular">{r.v}{r.note ? <small> · {r.note}</small> : null}</dd></div>)}</dl>
          <span className="type-caption">{t("hype.explain.disclaimer")}</span>
        </div>
      </div>
    </div>
  );
}

function BrandDemo({ operator }: { operator: boolean }) {
  const { t } = useI18n();
  const tabs = operator
    ? [{ k: "central", l: t("issuerReview.central") }, { k: "flair", l: "FLAIR" }, { k: "metrics", l: t("brands.slug.metricas") }]
    : [{ k: "collections", l: t("common.colecoes") }, { k: "looks", l: t("brands.slug.esquemas_em_destaque") }, { k: "pieces", l: t("brands.slug.pecas_em_destaque") }, { k: "flair", l: "FLAIR" }];
  const active = operator ? "flair" : "collections";
  return (
    <div className="gd-brand">
      <div className="gd-brand-cover" />
      <div className="gd-brand-id"><span className="gd-brand-logo">A</span><div><b>{DEMO_BRAND}</b><span className="type-caption text-muted block">{t("guide.demo.brand.kind")}</span></div></div>
      <div className="gd-brand-tabs">{tabs.map((x) => <span key={x.k} className={x.k === active ? "chip is-active" : "chip"}>{x.l}</span>)}</div>
      {operator ? (
        <div className="gd-specials">
          <FlairGameCard card={demoCard({ tier: "ESPECIAL", ovr: 88, rare: true })} size="sm" flip={false} />
          <ul className="gd-states">{["draft", "review", "published", "retired"].map((s) => <li key={s} className={s === "review" ? "is-on" : undefined}>{t(`guide.demo.brand.state.${s}`)}</li>)}</ul>
        </div>
      ) : <p className="type-caption">{t("guide.demo.brand.visitor_hint")}</p>}
    </div>
  );
}

function PointsDemo() {
  const { t, fmtNumber } = useI18n();
  const rows = [{ k: "earn1", v: 20 }, { k: "earn2", v: 10 }, { k: "spend1", v: -180 }];
  return (
    <div className="gd-points surface">
      <div className="gd-balance"><FaiIcon id="ACT-40" size={32} decorative /><b className="tabular">{fmtNumber(1240)}</b><span>{POINTS_NAME}</span></div>
      <ul className="gd-ledger">{rows.map((r) => <li key={r.k}><span>{t(`guide.demo.points.${r.k}`)}</span><b className={r.v < 0 ? "is-debit tabular" : "tabular"}>{r.v > 0 ? `+${r.v}` : `−${Math.abs(r.v)}`}</b></li>)}</ul>
      <span className="type-caption text-muted">{t("guide.demo.points.units")}</span>
    </div>
  );
}

function ShopDemo() {
  const { t } = useI18n();
  return (
    <div className="gd-shop">
      <div className="gd-shop-step surface"><b>{t("guide.demo.shop.item")}</b><span className="gd-price"><FaiIcon id="ACT-40" size={20} decorative /> <b className="tabular">180</b></span><span className="type-caption">{t("guide.demo.shop.requirement")}</span></div>
      <span className="gd-arrow" aria-hidden>→</span>
      <div className="gd-shop-step surface gd-anim-show"><b>{t("guide.demo.shop.confirm")}</b><span className="type-caption">{t("guide.demo.shop.effect")}</span></div>
      <span className="gd-arrow" aria-hidden>→</span>
      <div className="gd-shop-step surface gd-anim-show2"><b>{t("guide.demo.shop.delivered")}</b><span className="type-caption">{t("guide.demo.shop.balance")}</span></div>
    </div>
  );
}
