"use client";
/**
 * ACERVO — view 1, "Central do acervo": filtros, busca espacial, as peças do lugar escolhido no diretório, o mapa do
 * closet e a separação entre acervo comprado e lista de desejos.
 */
import { useMemo, useState } from "react";
import { EmptyState, Select, Tabs } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { acharCompartimento, filtrar, marcadores, ordenar, pecasDoLocal, type AcervoFiltro, type AcervoOrdem } from "@/lib/acervo/arvore";
import type { AcervoAba } from "@/lib/acervo/use-acervo-tela";
import { AcervoBarra } from "./acervo-barra";
import { useAcervo } from "./acervo-contexto";
import { AcervoIcone } from "./acervo-icone";
import { ListaDesejos } from "./lista-desejos";
import { MapaCloset } from "./mapa-closet";
import { PecaCard } from "./peca-card";
import { usePecasParadas } from "./use-acervo-destaques";

const FILTROS: AcervoFiltro[] = ["TODAS", "FAVORITAS", "EM_USO"];
const ORDENS: AcervoOrdem[] = ["RECENTES", "NOME", "PRECO"];

export function AcervoCentral() {
  const { t, locale } = useI18n();
  const { dados, tela, busca } = useAcervo();
  const [filtro, setFiltro] = useState<AcervoFiltro>("TODAS");
  const [ordem, setOrdem] = useState<AcervoOrdem>("RECENTES");
  const [emLista, setEmLista] = useState(false);
  const paradas = usePecasParadas();
  const arvore = dados.arvore;
  const numeros = useMemo(() => marcadores(tela.selecao), [tela.selecao]);
  if (!arvore) return null;

  const buscando = busca.texto.trim().length > 0;
  const doLocal = buscando ? arvore.pecas.filter((p) => busca.achadas.has(p.id)) : pecasDoLocal(arvore, tela.local);
  const visiveis = ordenar(filtrar(doLocal, filtro), ordem, locale);
  const achado = tela.local.tipo === "COMPARTIMENTO" ? acharCompartimento(arvore, tela.local.id) : null;
  const titulo = buscando
    ? t("acervo.busca.resultado")
    : achado ? achado.compartimento.nome : t(tela.local.tipo === "SEM_LUGAR" ? "acervo.dir.semLugar" : "acervo.dir.todas");
  const contagem = (f: AcervoFiltro) => filtrar(doLocal, f).length;

  return (
    <div className="acv-central">
      <Tabs<AcervoAba> label={t("acervo.abas.titulo")} value={tela.aba} onChange={tela.setAba} tabs={[
        { id: "COMPRADO", label: t("acervo.abas.comprado"), count: arvore.total },
        { id: "DESEJOS", label: t("acervo.desejos.titulo"), count: dados.desejos.length },
      ]} />
      {tela.aba === "DESEJOS" ? <ListaDesejos /> : (
        <>
          <div className="acv-filtros" role="group" aria-label={t("acervo.filtro.titulo")}>
            {FILTROS.map((f) => (
              <button key={f} type="button" className="acv-pilula" aria-pressed={filtro === f} onClick={() => setFiltro(f)}>
                {f === "FAVORITAS" && <AcervoIcone nome="estrela" tamanho={14} />}
                {f === "EM_USO" && <AcervoIcone nome="calendario" tamanho={14} />}
                {t(`acervo.filtro.${f.toLowerCase()}`, { count: contagem(f) })}
              </button>
            ))}
          </div>
          <AcervoBarra />
          <div className="acv-central-corpo">
            <section className="acv-lista" aria-label={titulo}>
              <header className="acv-lista-cabeca">
                <h2 className="acv-lista-titulo">{titulo}</h2>
                <span className="acv-lista-conta" data-testid="acervo-contagem">{t("acervo.pecas", { count: visiveis.length })}</span>
                <label className="acv-ordem">
                  <span>{t("acervo.ordem.titulo")}</span>
                  <Select value={ordem} onChange={(e) => setOrdem(e.target.value as AcervoOrdem)}>
                    {ORDENS.map((o) => <option key={o} value={o}>{t(`acervo.ordem.${o.toLowerCase()}`)}</option>)}
                  </Select>
                </label>
                <div className="acv-modo-lista" role="group" aria-label={t("acervo.exibicao.titulo")}>
                  <button type="button" aria-pressed={!emLista} aria-label={t("acervo.exibicao.grade")} onClick={() => setEmLista(false)}><AcervoIcone nome="grade" tamanho={16} /></button>
                  <button type="button" aria-pressed={emLista} aria-label={t("acervo.exibicao.lista")} onClick={() => setEmLista(true)}><AcervoIcone nome="lista" tamanho={16} /></button>
                </div>
              </header>
              {buscando && busca.resultado && (
                <p className="acv-dica" role="status">
                  {t("acervo.busca.resumo", { pecas: busca.resultado.pecas.length, lugares: busca.resultado.compartimentos.length })}
                  {busca.resultado.semLugar > 0 && ` ${t("acervo.busca.semLugar", { count: busca.resultado.semLugar })}`}
                </p>
              )}
              {!buscando && tela.local.tipo === "SEM_LUGAR" && visiveis.length > 0 && <p className="acv-dica">{t("acervo.semLugar.dica")}</p>}
              {visiveis.length === 0 && (
                <EmptyState title={t(buscando ? "acervo.busca.nada" : "acervo.lista.vazia")}
                  hint={t(buscando ? "acervo.busca.nadaDica" : arvore.total === 0 ? "acervo.lista.semPecas" : "acervo.lista.vaziaDica")} />
              )}
              <ul className={`acv-grade${emLista ? " is-lista" : ""}`}>
                {visiveis.map((p) => (
                  <PecaCard key={p.id} peca={p} lista={emLista} marcador={numeros.get(p.id)} achada={buscando} parada={paradas.has(p.id)}
                    onAbrir={(peca) => tela.abrirPeca(peca.id)} onMarcar={(peca) => tela.alternarSelecao(peca.id)} />
                ))}
              </ul>
            </section>
            <MapaCloset />
          </div>
        </>
      )}
    </div>
  );
}
