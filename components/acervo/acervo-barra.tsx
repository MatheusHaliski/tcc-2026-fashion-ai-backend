"use client";
/**
 * ACERVO — barra comum às duas views: busca espacial ("camisa branca M" acende os compartimentos certos), mapa de uso
 * (peças paradas e combinações pouco exploradas) e modo arrumação.
 */
import { useState } from "react";
import { UiIcon } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { useAcervo } from "./acervo-contexto";
import { AcervoIcone } from "./acervo-icone";
import { ArrumacaoDialogo } from "./arrumacao-dialogo";
import { UsoCombinacoes } from "./uso-combinacoes";

export function AcervoBarra() {
  const { t } = useI18n();
  const { tela, busca, uso } = useAcervo();
  const [arrumando, setArrumando] = useState(false);
  const paradas = uso ? uso.pecas.filter((p) => p.esquecida || p.nuncaUsada).length : 0;

  return (
    <div className="acv-barra">
      <label className="acv-busca">
        <UiIcon name="search" size={16} />
        <span className="sr-only">{t("acervo.busca.rotulo")}</span>
        <input type="search" value={busca.texto} placeholder={t("acervo.busca.dica")} onChange={(e) => busca.setTexto(e.target.value)} />
      </label>
      <button type="button" className="acv-pilula" aria-pressed={tela.usoLigado} onClick={() => tela.setUsoLigado(!tela.usoLigado)}>
        <AcervoIcone nome="barras" tamanho={14} />
        {t("acervo.uso.titulo")}
      </button>
      <button type="button" className="acv-pilula" onClick={() => setArrumando(true)}>
        <AcervoIcone nome="vassoura" tamanho={14} />
        {t("acervo.arrumacao.titulo")}
      </button>
      {busca.texto.trim() && (
        <p className="acv-barra-status" role="status">
          {busca.buscando ? t("acervo.busca.buscando") : t("acervo.busca.acesos", { count: busca.acesos.size })}
        </p>
      )}
      {tela.usoLigado && uso && (
        <p className="acv-barra-status" role="status">{t("acervo.uso.resumo", { count: paradas, dias: uso.dias })}</p>
      )}
      {tela.usoLigado && <UsoCombinacoes />}
      <ArrumacaoDialogo aberto={arrumando} onClose={() => setArrumando(false)} />
    </div>
  );
}
