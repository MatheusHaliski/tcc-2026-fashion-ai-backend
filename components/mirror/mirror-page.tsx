"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import { ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { MirrorControls, wornOf } from "@/components/mirror/mirror-controls";
import { MirrorStage } from "@/components/mirror/mirror-stage";
import { useMirrorPage } from "@/components/mirror/use-mirror-page";

/*
 * O Espelho (RF28) com casa própria (/mirror). Era a vista "flat mirror" do Meu Quarto (app/(site)/(app)/room/page.tsx,
 * aparelho sem WebGL): o palco 2D do espelho — a foto parada do mesmo Avatar 3D do perfil e do provador vestindo o look,
 * ou as peças em 2D sobre o vidro quando não há WebGL — e, ao lado, o painel do espelho (MirrorControls): partes do look,
 * para quem é o look, Vista-me/Outra sugestão, leitura do look, usar hoje, salvar, provar, tira uma coisa, GRWM.
 * Os pedidos vão direto ao servidor (/api/me/mirror): não há mais o quarto como anfitrião (reação do personagem, luz nas
 * portas, "Mostrar no quarto"). O link `?vestir=<id>` veste a peça ao abrir (use-mirror-page.ts).
 */
export function MirrorPage() {
  const { t } = useI18n();
  const { data, error, reload, setData, pins, webgl } = useMirrorPage();
  const empty = wornOf(data).length === 0;
  return (
    <>
      <PageHeader title={t("nav.mirror")} kicker="RF28"
        lead={data?.restriction ? t("mirror.desafio_ativo_so_as_pecas", { challenge: data.restriction.challenge }) : t("mirror.page.lead")}
        actions={<>
          <Link href="/closet" className="btn"><FaiIcon id="NAV-02" size={24} decorative />{t("nav.closet")}</Link>
          <Link href="/try-on" className="btn"><FaiIcon id="NAV-07" size={24} decorative />{t("nav.tryon")}</Link>
        </>} />
      {!data ? (
        // o estado do espelho não veio: o erro com tentar de novo (ou o carregamento) no lugar de uma vista vazia
        error ? <ErrorState error={error} onRetry={reload} /> : <Skeleton className="h-96" />
      ) : (
        <div className="room-flat-mirror" role="region" aria-label={t("nav.mirror")}>
          <div className="room-flat-mirror-stage">
            <MirrorStage slots={data.slots} kelvin={data.light?.kelvin} mode="2d" webgl={webgl}>
              {empty && <div className="mirror-empty"><p className="type-h3">{t("mirror.emptyTitle")}</p><p className="type-body-sm mt-1 text-muted">{t("mirror.vazio_dica")}</p></div>}
              {data.postIt && <p className="absolute right-3 top-3 max-w-[150px] rotate-2 bg-chalk-soft p-2 text-xs shadow" role="note">📌 {data.postIt}</p>}
            </MirrorStage>
          </div>
          <MirrorControls data={data} setData={setData} reload={reload} pins={pins} />
        </div>
      )}
    </>
  );
}
