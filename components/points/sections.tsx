"use client";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { POINTS_MODES, POINTS_SECTION_MODE, type PointsAccount } from "@/lib/points/hub";
import { Card, ErrorState, PageHeader, Skeleton, UiIcon } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { FlairHubIcon } from "@/components/flair/hub-icons";
import { RoomStore } from "@/components/room3d/room-store";
import { HowItWorks } from "@/components/guide/guide";

export type PointsSectionId = "saldo" | "ganhar" | "loja";

/** Onde cada ação rende pontos: o atalho para a tela certa (os códigos vêm da API; sem correspondência, sem atalho). */
const ACTION_HREF: Record<string, string> = {
  LOOK_DO_DIA: "/autopilot", LOOK_CONFIRMED: "/looks", MOMENT: "/moments", MOMENT_LOOK: "/moments", CHALLENGE: "/challenges", CHALLENGE_DONE: "/challenges",
  FLAIR_CBC: "/flair/desafios", FLAIR_MATCH: "/flair/partidas", FLAIR_DUEL: "/flair/partidas", PIECE_CREATED: "/pieces/new", REDISCOVERY: "/closet", SHARE: "/feed",
};
function hrefFor(action: string): string | null {
  const key = Object.keys(ACTION_HREF).find((k) => action.toUpperCase().startsWith(k) || action.toUpperCase().includes(k));
  return key ? ACTION_HREF[key] : null;
}

/**
 * Sub-rotas de FAI Points (/points/saldo, /ganhar, /loja): cada uma é uma parte da antiga página única, com o caminho
 * de volta à central, o nome do modo e "Como funciona". A loja continua sendo o componente RoomStore (RF35 + RF39).
 */
export function PointsSection({ section }: { section: PointsSectionId }) {
  const { t, fmtNumber, rich } = useI18n();
  const modeId = POINTS_SECTION_MODE[section]; const mode = POINTS_MODES.find((m) => m.id === modeId)!;
  const acc = useApi<PointsAccount>((signal) => api.get("/api/me/points", { signal }), []);
  const a = acc.data;
  return (
    <>
      <div className="flair-section-head">
        <Link href={`/points?mode=${modeId}`} className="btn btn-sm"><UiIcon name="chevronLeft" size={18} />{t("points.hub.back")}</Link>
        <PageHeader title={t(`points.hub.mode.${modeId}.title`)} kicker={t("nav.points")}
          actions={<div className="flex flex-wrap items-center gap-2"><HowItWorks id={mode.guide} />{a && <span className="badge badge-chalk"><FaiIcon id="ACT-40" size={20} decorative />{fmtNumber(a.balance)}</span>}</div>} />
      </div>
      {acc.error ? <ErrorState error={acc.error} onRetry={acc.reload} /> : section !== "loja" && (acc.loading || !a) ? <Skeleton className="h-80" /> : (
        <>
          {section === "saldo" && a && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Card className="text-center">
                <p className="label">{t("points.saldo")}</p>
                <p className="hero-number text-6xl"><FaiIcon id="ACT-40" size={48} decorative className="mr-2 inline-block align-middle" />{fmtNumber(a.balance)}</p>
                <p className="type-caption text-muted">{rich("points.acumulado_nivel", { number: fmtNumber(a.lifetime), level: a.level }, { 0: ($c) => <b>{$c}</b> })}</p>
                {a.nextLevel && <><div className="hype-bar mt-3"><i style={{ width: `${Math.min(100, (100 * a.lifetime) / Math.max(1, a.nextLevel.threshold))}%`, background: "var(--chalk)" }} /></div><p className="mt-1 type-caption">{t("points.faltam_para", { missing: a.nextLevel.missing, level: a.nextLevel.level, unlocks: a.nextLevel.unlocks })}</p></>}
                {a.note && <p className="mt-2 type-caption text-faint">{a.note}</p>}
                <div className="mt-3 flex flex-wrap justify-center gap-2"><Link href="/notifications?cat=POINTS" className="btn btn-sm">{t("points.ver_extrato")}</Link><Link href="/points/loja" className="btn btn-sm btn-primary">{t("points.loja_do_quarto")}</Link></div>
              </Card>
              <Card>
                <div className="flex items-center gap-2"><FlairHubIcon id="balance" size={20} /><h2 className="type-h3">{t("points.niveis")}</h2></div>
                <ol className="points-levels mt-2">{(a.levels ?? []).map((l) => (
                  <li key={l.level} className={l.reached ? "is-reached" : undefined}>
                    <span className="points-level-mark" aria-hidden>{l.reached ? "✓" : "○"}</span>
                    <span className="min-w-0"><b>{l.level}</b> <span className="type-caption text-muted tabular">{fmtNumber(l.threshold)}</span>{l.unlocks && <span className="block type-body-sm text-muted">{l.unlocks}</span>}</span>
                  </li>))}</ol>
              </Card>
            </div>
          )}
          {section === "ganhar" && a && (
            <div className="grid gap-4">
              <p className="type-body-lg max-w-prose">{t("points.hub.mode.earn.lead")}</p>
              {a.rules?.length ? (
                <ul className="points-rules">{a.rules.map((r) => { const href = hrefFor(r.action); const label = r.description && r.description !== "null" ? r.description : r.action.toLowerCase().replace(/_/g, " "); return (
                  <li key={r.action} className="points-rule">
                    <span className="points-rule-value"><FaiIcon id="ACT-40" size={20} decorative /><b className="tabular">+{r.points}</b></span>
                    <span className="min-w-0 flex-1"><span className="type-body">{label}</span>{r.dailyCap ? <span className="block type-caption text-muted">{t("points.max_dia", { dailyCap: r.dailyCap }).trim()}</span> : null}</span>
                    {href && <Link href={href} className="btn btn-sm">{t("points.hub.go")}</Link>}
                  </li>); })}</ul>
              ) : <Card><p className="type-body text-muted">{t("points.hub.no_rules")}</p></Card>}
              <p className="type-caption text-muted">{t("points.pontos_por_usar_o_que")}</p>
            </div>
          )}
          {section === "loja" && <Card><div className="mb-3 flex items-center gap-2"><FlairHubIcon id="store" size={20} /><h2 className="type-h3">{t("points.loja_do_quarto")}</h2></div><RoomStore onChanged={acc.reload} /></Card>}
        </>
      )}
    </>
  );
}
