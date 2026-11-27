"use client";
/**
 * ACERVO — mapa do closet: esquema pequeno dos móveis de um ambiente. Clicar num compartimento abre a view "Meu espaço"
 * naquele lugar. Com mais de um ambiente, os pontos embaixo trocam de ambiente.
 */
import { useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { marcadoresPorCompartimento } from "@/lib/acervo/arvore";
import { useAcervo } from "./acervo-contexto";
import { AcervoIcone } from "./acervo-icone";
import { EsquemaMoveis } from "./esquema-moveis";
import { useParados } from "./use-acervo-destaques";

export function MapaCloset() {
  const { t } = useI18n();
  const { dados, tela, busca } = useAcervo();
  const [pagina, setPagina] = useState(0);
  const parados = useParados();
  const arvore = dados.arvore;
  if (!arvore) return null;
  const ambientes = arvore.ambientes.filter((a) => a.moveis.length > 0);
  if (ambientes.length === 0) return null;
  const atual = ambientes[Math.min(pagina, ambientes.length - 1)];
  const selecionado = tela.local.tipo === "COMPARTIMENTO" ? tela.local.id : null;

  return (
    <section className="acv-cartao acv-mapa" aria-label={t("acervo.mapa.titulo")}>
      <header className="acv-cartao-cabeca">
        <h3 className="acv-cartao-titulo">{t("acervo.mapa.titulo")}</h3>
        <button type="button" className="acv-botao-icone" onClick={() => tela.setVista("ESPACO")} aria-label={t("acervo.mapa.abrirEspaco")}>
          <AcervoIcone nome="expandir" tamanho={16} />
        </button>
      </header>
      <p className="acv-mapa-ambiente">{atual.nome}</p>
      <EsquemaMoveis moveis={atual.moveis} selecionado={selecionado} acesos={busca.acesos} parados={parados}
        marcadores={marcadoresPorCompartimento(arvore, tela.selecao)} onEscolher={tela.abrirNoEspaco}
        onSoltar={(ids, id) => { void dados.mover(ids, id, t("acervo.mover.feito")); }} />
      <ul className="acv-mapa-legenda">
        {atual.moveis.map((m) => <li key={m.id}>{m.nome}</li>)}
      </ul>
      {ambientes.length > 1 && (
        <div className="acv-mapa-pontos" role="group" aria-label={t("acervo.mapa.ambientes")}>
          {ambientes.map((a, i) => (
            <button key={a.id} type="button" className="acv-ponto" aria-pressed={a.id === atual.id} aria-label={a.nome} onClick={() => setPagina(i)} />
          ))}
        </div>
      )}
      <p className="acv-dica">{t("acervo.mapa.dica")}</p>
    </section>
  );
}
