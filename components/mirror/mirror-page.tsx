"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import { ErrorState, Skeleton } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { MirrorControls, wornOf } from "@/components/mirror/mirror-controls";
import { MirrorStage } from "@/components/mirror/mirror-stage";
import { MirrorSidePanel } from "@/components/mirror/mirror-side-panel";
import { useMirrorPage } from "@/components/mirror/use-mirror-page";

/*
 * O Espelho (RF28) com casa própria (/mirror). O espelho ocupa a área inteira da página: o palco 2D — a foto parada do
 * mesmo Avatar 3D do perfil e do provador vestindo o look, ou as peças em 2D sobre o vidro quando não há WebGL. Os
 * controles (MirrorControls: partes do look, para quem é o look, Vista-me com nível térmico/Outra sugestão, leitura do
 * look, usar hoje, salvar, provar, tira uma coisa) abrem no painel lateral (MirrorSidePanel), por cima do vidro.
 * Os pedidos vão direto ao servidor (/api/me/mirror). O link `?vestir=<id>` veste a peça ao abrir (use-mirror-page.ts).
 */
export function MirrorPage() {
  const { t } = useI18n();
  const { data, error, reload, setData, pins, webgl } = useMirrorPage();
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
          <MirrorSidePanel>
            <p className="type-body-sm text-muted">{data.restriction ? t("mirror.desafio_ativo_so_as_pecas", { challenge: data.restriction.challenge }) : t("mirror.page.lead")}</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/closet" className="btn btn-sm"><FaiIcon id="NAV-02" size={20} decorative />{t("nav.closet")}</Link>
              <Link href="/try-on" className="btn btn-sm"><FaiIcon id="NAV-07" size={20} decorative />{t("nav.tryon")}</Link>
            </div>
            <MirrorControls data={data} setData={setData} reload={reload} pins={pins} compact />
          </MirrorSidePanel>
        </div>
      )}
    </>
  );
}
