"use client";
import { useEffect } from "react";
import type { Counters, PieceView, SchemeView, UserCard, ViewerState } from "@/lib/api/types";
import type { HypeSummary } from "@/lib/hype/types";
import { DEMO_ID_PREFIX, primeHype } from "@/lib/hype/use-hype";
import { useI18n } from "@/lib/i18n/i18n";
import type { GuideDemo as DemoId } from "@/lib/guides/registry";
import { FaiIcon } from "@/components/fai-icon";
import { PieceCard } from "@/components/piece-card";
import { SealMedallion } from "@/components/seal-medallion";
import { FlairGameCard, type FlairCollectionCard } from "@/components/flair/flair-game-card";
import { CbcSceneArt } from "@/components/flair/cbc-scene";

/**
 * Exemplos ilustrados dos tutoriais "Como funciona". Usam os componentes reais (PieceCard, FlairGameCard, selo, ícone
 * oficial de FAI Points) com dados DE EXEMPLO: IDs com prefixo "demo-" (o Hype nunca vai à API), dono fictício sem
 * permissão de edição e palco inerte no diálogo — nada aqui chama a API, consome carta ou concede ponto.
 * A animação é só CSS (pausável; com movimento reduzido fica no quadro final).
 */
const DEMO_OWNER: UserCard = { id: `${DEMO_ID_PREFIX}owner`, username: "exemplo", displayName: "Exemplo", profileType: "PESSOAL", verified: false, privateAccount: false, country: "BR" };
const DEMO_COUNTERS: Counters = { likes: 24, comments: 5, shares: 2, remixes: 1, views: 180, saves: 7, reactions: {} };
const DEMO_VIEWER: ViewerState = { liked: false, reactions: [], saved: false, canEdit: false, following: false };
const AT = "2026-10-01T12:00:00Z";
/** nomes próprios do exemplo (marca fictícia e o nome do produto FAI Points): não se traduzem */
const DEMO_BRAND = "Atelier Lumi";
const POINTS_NAME = "FAI Points";
/** dados fictícios do exemplo ilustrado (não vão à API nem viram conteúdo de ninguém) */
const DEMO_PIECE_NAME = "Jaqueta jeans";
const DEMO_SEAL_NAME = "Selo de exemplo";

export function demoPiece(over: Partial<PieceView> = {}): PieceView {
  return {
    id: `${DEMO_ID_PREFIX}piece`, owner: DEMO_OWNER, name: DEMO_PIECE_NAME, category: "upper_piece", subcategory: "jacket", sex: "UNISSEX",
    brandName: null, brandLogoUrl: null, color: "denim", colorHex: "#4a6a8c", material: "DENIM", size: "m", style: ["streetwear"], occasion: ["casual"],
    seals: [], price: null, imageUrl: "/assets_pecas/14_jacket_jaqueta.png", originalImageUrl: null, thumbnailUrl: "/assets_pecas/14_jacket_jaqueta.png",
    defaultImage: true, aiGeneratedImage: false, visibility: "PUBLIC", disponivel: true, availabilityStatus: "AVAILABLE", favorite: false, forSale: false,
    wearCount: 3, moderationStatus: "APPROVED", photoProcessingStatus: "COMPLETED", flatLayMetadata: {}, background: { skin: "atelier" },
    hypeScore: null, hypeScoreGlobal: null, tags: [], counters: DEMO_COUNTERS, viewer: DEMO_VIEWER, notAvailableAnymore: false, createdAt: AT, updatedAt: AT,
    ...over,
  } as PieceView;
}

export function demoCard(over: Partial<FlairCollectionCard> = {}): FlairCollectionCard {
  return {
    id: `${DEMO_ID_PREFIX}card`, originType: "PIECE", originId: `${DEMO_ID_PREFIX}piece`, season: "SPRING", tier: "OURO", ovr: 78, rare: false, position: "SUP",
    name: DEMO_PIECE_NAME, brandName: DEMO_BRAND, imageUrl: "/assets_pecas/14_jacket_jaqueta.png", category: "upper_piece", subcategory: "jacket",
    hype: { POP: 71, RAR: 40, ENG: 66, LON: 58, TRD: 74, NOV: 62, ORI: 55, HYP: 68 }, priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED",
    ...over,
  };
}

export const DEMO_SCHEME_SEAL = { label: "LOOK", name: DEMO_SEAL_NAME, kind: "BRAND" as const, premium: false, design: null };
// o Hype dos exemplos nasce no cache (nunca é pedido à API): um com números de exemplo, outro sem dados
const DEMO_HYPE: Record<string, HypeSummary> = {
  [`${DEMO_ID_PREFIX}piece`]: { status: "INSUFFICIENT_DATA", score: null },
  [`${DEMO_ID_PREFIX}piece-hype`]: { status: "AVAILABLE", score: 68, level: "HOT", direction: "UP", calculatedAt: AT },
};

export function GuideDemo({ demo }: { demo: DemoId }) {
  useEffect(() => { primeHype("PIECE", DEMO_HYPE); }, []);
  switch (demo) {
    case "games": return <GamesDemo />;
    case "cbc": return <CbcDemo />;
    case "calendar": return <CalendarDemo />;
    case "challenge": return <ChallengeDemo />;
    case "feed": return <FeedDemo />;
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
    default: return null;
  }
}

function GamesDemo() {
  const { t } = useI18n();
  const cols = [{ k: "flair", icon: "ACT-46" }, { k: "moments", icon: "NAV-13" }, { k: "challenges", icon: "ACT-43" }];
  return (
    <div className="gd-games">
      {cols.map((c) => (
        <div key={c.k} className="gd-tile">
          <FaiIcon id={c.icon} size={32} variant="glyph" decorative />
          <b>{t(`guide.demo.games.${c.k}`)}</b>
          <span className="type-caption text-muted">{t(`guide.demo.games.${c.k}_hint`)}</span>
        </div>
      ))}
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

function FeedDemo() {
  const { t } = useI18n();
  return (
    <div className="gd-feed">
      <div className="gd-card-frame"><PieceCard piece={demoPiece()} flip={false} /></div>
      <ul className="gd-callouts">
        <li><span className="gd-dot">1</span>{t("guide.demo.feed.open")}</li>
        <li><span className="gd-dot">2</span>{t("guide.demo.feed.piece")}</li>
        <li><span className="gd-dot">3</span>{t("guide.demo.feed.actions")}</li>
      </ul>
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
