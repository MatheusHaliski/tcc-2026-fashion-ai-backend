"use client";
/**
 * ACERVO — aba "Tamanhos" da ficha. Reusa os dados do passaporte digital da peça (GET /api/pieces/{id}/digital-passport):
 * tamanho comercial com a disponibilidade cadastrada, medidas com unidade e origem, e a representação 3D de cada
 * tamanho. Tamanho indisponível aparece desligado, com o motivo; tamanho sem 3D diz isso, sem trocar por outro;
 * variação visual é sempre dita como aproximação. Escolher aqui é só consulta: não muda o avatar nem afirma caimento.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Chip, ErrorState, Skeleton } from "@/components/ui";
import { SizeTable } from "@/components/passport/digital-passport";
import { sizeLabel } from "@/components/piece-snapshot";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { digitalPassportApi, type SizeRow } from "@/lib/passport/digital";

export function PecaFichaTamanhos({ pieceId }: { pieceId: string }) {
  const { t } = useI18n();
  const ficha = useApi((signal) => digitalPassportApi.sheet(pieceId, signal), [pieceId]);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const tamanhos = ficha.data?.sizes;

  useEffect(() => {
    const daPeca = tamanhos?.sizes.find((row) => row.ownerDeclared && row.availability !== "UNAVAILABLE");
    setEscolhido(daPeca?.label ?? null);
  }, [tamanhos]);

  if (ficha.error) return <ErrorState error={ficha.error} onRetry={ficha.reload} />;
  if (!tamanhos) return <Skeleton className="h-40" />;
  if (tamanhos.sizes.length === 0) return <p className="acv-dica">{t("acervo.tamanhos.vazio")}</p>;

  const linha = tamanhos.sizes.find((row) => row.label === escolhido);
  // o tamanho da peça fora da grade (calça cadastrada em letra) vem primeiro, não perdido no meio da numeração
  const ordem = [...tamanhos.sizes].sort((a, b) => Number(b.source === "OWNER") - Number(a.source === "OWNER"));
  const daPeca = tamanhos.sizes.find((row) => row.ownerDeclared);
  const tem3d = tamanhos.representation3d.kind !== "NONE";
  const nome = (row: SizeRow) => [
    sizeLabel(row.label),
    row.ownerDeclared ? t("sheet.ownerSize") : null,
    row.availability === "UNAVAILABLE" ? t("acervo.tamanhos.indisponivel") : null,
  ].filter(Boolean).join(" · ");

  return (
    <section className="acv-tamanhos" aria-label={t("acervo.integracoes.tamanhos")} data-testid="acervo-tamanhos">
      <div className="acv-tamanhos-lista" role="radiogroup" aria-label={t("acervo.tamanhos.comerciais")}>
        {ordem.map((row) => {
          const indisponivel = row.availability === "UNAVAILABLE";
          return (
            <Chip key={row.label} role="radio" aria-checked={escolhido === row.label} active={escolhido === row.label} blocked={indisponivel}
              disabled={indisponivel} title={nome(row)} onClick={() => setEscolhido(row.label)}>
              <span aria-hidden>{sizeLabel(row.label)}</span>
              <span className="sr-only">{nome(row)}</span>
            </Chip>
          );
        })}
      </div>
      {daPeca && <p className="acv-dica">{t("acervo.tamanhos.daPeca", { size: sizeLabel(daPeca.label) })}</p>}
      {!tamanhos.availabilityKnown && <p className="acv-dica">{t("acervo.tamanhos.semDisponibilidade")}</p>}
      <p className="acv-tamanhos-estado" role="status">
        {!linha && t("acervo.tamanhos.escolha")}
        {linha && !tem3d && t("acervo.tamanhos.escolhidoSem3d", { size: sizeLabel(linha.label) })}
        {linha && tem3d && linha.representation === "NONE" && t("size.sem_3d_para_tamanho", { size: sizeLabel(linha.label) })}
        {linha && tem3d && linha.representation !== "NONE" && t("size.aproximacao_visual", { size: sizeLabel(linha.label) })}
      </p>
      {tem3d && <p className="acv-dica"><span className="acv-selo">{t("acervo.tamanhos.aproximacao")}</span> {t(`sheet.note.${tamanhos.visualApproximationNote}`)}</p>}
      {tem3d && !tamanhos.representation3d.approvedForTryOn && <p className="acv-dica">{t("sheet.notApprovedForTryOn")}</p>}
      <h4 className="acv-ficha-subtitulo">{t("acervo.tamanhos.medidas")}</h4>
      {tamanhos.measurementsKnown ? <SizeTable rows={linha ? [linha] : tamanhos.sizes} /> : <p className="acv-dica">{t("acervo.tamanhos.semMedidas")}</p>}
      <p className="acv-dica">{t("size.nao_altera_avatar")} {t("acervo.tamanhos.semCaimento")}</p>
      <Link href="/try-on" className="btn btn-sm">{t("acervo.tamanhos.provador")}</Link>
    </section>
  );
}
