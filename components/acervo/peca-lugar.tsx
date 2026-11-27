"use client";
/**
 * Onde a peça está guardada no ACERVO, lido fora do acervo (detalhe da peça). O que identifica o lugar é o id do
 * compartimento (`data-endereco`), que não muda quando a gaveta, o armário ou o ambiente são renomeados; o texto é
 * sempre o nome atual, vindo da API (exercício 08 de docs/banco-de-dados). Só a dona da peça lê.
 */
import Link from "next/link";
import { Button } from "@/components/ui";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { acervoApi } from "@/lib/acervo/api";

export function PecaLugarNoAcervo({ pieceId }: { pieceId: string }) {
  const { t } = useI18n();
  const { data, loading, error, reload } = useApi((signal) => acervoApi.lugar(pieceId, signal), [pieceId]);
  if (error) {
    return (
      <span role="alert" className="inline-flex flex-wrap items-center gap-2" data-acervo-lugar="erro">
        <span className="error-text">{t("acervo.lugar.erro")}</span>
        <Button type="button" size="sm" onClick={reload}>{t("common.retry")}</Button>
      </span>
    );
  }
  if (loading || !data) return <span role="status" data-acervo-lugar="carregando">{t("common.loading")}</span>;
  if (!data.guardada) {
    return (
      <span data-acervo-lugar="sem-lugar">
        {t("acervo.lugar.semLugar")} · <Link href="/acervo" className="underline">{t("acervo.lugar.organizar")}</Link>
      </span>
    );
  }
  return (
    <span data-acervo-lugar="guardada" data-endereco={data.compartimentoId ?? undefined}>
      <b>{data.compartimento}</b>
      <span className="text-muted"> · {t("acervo.lugar.em", { movel: data.movel ?? "", ambiente: data.ambiente ?? "" })}</span>
      {" · "}<Link href="/acervo" className="underline">{t("acervo.lugar.ver")}</Link>
    </span>
  );
}
