"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import { ErrorState, Skeleton } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { MirrorControls, useMirrorActions, wornOf } from "@/components/mirror/mirror-controls";
import { MirrorStage } from "@/components/mirror/mirror-stage";
import { MirrorSidePanel } from "@/components/mirror/mirror-side-panel";
import { MirrorVistaSection } from "@/components/mirror/mirror-vista-section";
import { useMirrorPage } from "@/components/mirror/use-mirror-page";

/*
 * O Espelho (RF28) com casa própria (/mirror). O espelho ocupa a área inteira da página: o palco 2D — a foto parada do
 * mesmo Avatar 3D do perfil e do provador vestindo o look, ou as peças em 2D sobre o vidro quando não há WebGL. Os
 * painéis laterais (MirrorSidePanel) abrem por cima do vidro: à esquerda o Vista-me (nível térmico, ocasiões, Outra
 * sugestão); à direita os controles (MirrorControls: partes do look, para quem é o look, leitura do look, usar hoje,
 * salvar, provar, tira uma coisa). Os dois podem ficar abertos com o reflexo no meio.
 * Os pedidos vão direto ao servidor (/api/me/mirror). O link `?vestir=<id>` veste a peça ao abrir (use-mirror-page.ts).
 */
export function MirrorPage() {
  const { t } = useI18n();
  const { data, error, reload, setData, pins, webgl } = useMirrorPage();
  const { run, busy } = useMirrorActions(setData as Parameters<typeof useMirrorActions>[0], reload);
  const empty = wornOf(data).length === 0;
  return (
    <>
      <h1 className="sr-only">{t("nav.mirror")}</h1>
      {!data ? (
        // o estado do espelho não veio: o erro com tentar de novo (ou o carregamento) no lugar de uma vista vazia
        error ? <ErrorState error={error} onRetry={reload} /> : <Skeleton className="mirror-fullscreen" />
      ) : (
        <div className="mirror-fullscreen" role="region" aria-label={t("nav.mirror")}>
          <MirrorStage slots={data.slots} kelvin={data.light?.kelvin} mode="2d" webgl={webgl}>
            {empty && <div className="mirror-empty"><p className="type-h3">{t("mirror.emptyTitle")}</p><p className="type-body-sm mt-1 text-muted">{t("mirror.vazio_dica")}</p></div>}
          </MirrorStage>
          <MirrorSidePanel id="mirror-vista-panel" side="left" icon="OCC-11" label={t("mirror.vista_me")}>
            <MirrorVistaSection data={data} busy={busy} anchorIds={pins.anchorIds} run={run} inPanel />
          </MirrorSidePanel>
          <MirrorSidePanel id="mirror-panel" icon="NAV-14" label={t("mirror.painel.abrir")}>
            <p className="type-body-sm text-muted">{data.restriction ? t("mirror.desafio_ativo_so_as_pecas", { challenge: data.restriction.challenge }) : t("mirror.page.lead")}</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/closet" className="btn btn-sm"><FaiIcon id="NAV-02" size={20} decorative />{t("nav.closet")}</Link>
              <Link href="/try-on" className="btn btn-sm"><FaiIcon id="NAV-07" size={20} decorative />{t("nav.tryon")}</Link>
            </div>
            <MirrorControls data={data} setData={setData} reload={reload} pins={pins} compact vista={false} />
          </MirrorSidePanel>
        </div>
      )}
    </>
  );
}
