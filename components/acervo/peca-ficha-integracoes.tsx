"use client";
/**
 * ACERVO — entradas da ficha para o que o app já tem sobre a peça: Passaporte, Editor 3D e Tamanhos. O ACERVO não
 * duplica essas telas: abre as da própria peça.
 */
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import type { AcervoPeca } from "@/lib/acervo/types";

export function PecaFichaIntegracoes({ peca }: { peca: AcervoPeca }) {
  const { t } = useI18n();
  const base = `/pieces/${encodeURIComponent(peca.id)}`;
  return (
    <nav className="acv-ficha-integracoes" aria-label={t("acervo.integracoes.titulo")}>
      <Link href={`${base}/passport`} className="acv-integracao">
        <span className="acv-integracao-nome">{t("acervo.integracoes.passaporte")}</span>
        <span className="acv-dica">{t("acervo.integracoes.passaporteDica")}</span>
      </Link>
      <Link href={`${base}/editor-3d`} className="acv-integracao">
        <span className="acv-integracao-nome">{t("acervo.integracoes.editor3d")}</span>
        <span className="acv-dica">{t("acervo.integracoes.editor3dDica")}</span>
      </Link>
      <Link href={`${base}/sizes`} className="acv-integracao">
        <span className="acv-integracao-nome">{t("acervo.integracoes.tamanhos")}</span>
        <span className="acv-dica">{t("acervo.integracoes.tamanhosDica")}</span>
      </Link>
    </nav>
  );
}
