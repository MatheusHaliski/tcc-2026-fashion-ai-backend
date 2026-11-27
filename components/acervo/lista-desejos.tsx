"use client";
/**
 * ACERVO — lista de desejos, separada do acervo comprado. Cada item mostra o preço como estimativa e pode entrar na
 * simulação de compra: aparece como peça-fantasma no compartimento escolhido e o painel financeiro mostra o impacto.
 */
import { useState } from "react";
import { Button, EmptyState, Switch } from "@/components/ui";
import { label } from "@/lib/api/taxonomy";
import { useI18n } from "@/lib/i18n/i18n";
import { acervoApi } from "@/lib/acervo/api";
import type { AcervoDesejo } from "@/lib/acervo/types";
import { useAcervo } from "./acervo-contexto";
import { DesejoFormDialog } from "./desejo-form";

export function ListaDesejos() {
  const { t, fmtPrice } = useI18n();
  const { dados, tela } = useAcervo();
  const [form, setForm] = useState<{ aberto: boolean; desejo: AcervoDesejo | null }>({ aberto: false, desejo: null });
  const novo = <Button variant="primary" onClick={() => setForm({ aberto: true, desejo: null })}>{t("acervo.desejos.novo")}</Button>;

  return (
    <section className="acv-desejos" aria-label={t("acervo.desejos.titulo")}>
      <header className="acv-lista-cabeca">
        <h2 className="acv-lista-titulo type-h3">{t("acervo.desejos.titulo")}</h2>
        <span className="acv-lista-conta">{t("acervo.desejos.itens", { count: dados.desejos.length })}</span>
        {dados.desejos.length > 0 && novo}
      </header>
      <p className="acv-dica"><span className="acv-selo">{t("acervo.estimado")}</span> {t("acervo.desejos.aviso")}</p>
      {dados.desejos.length === 0 && <EmptyState title={t("acervo.desejos.vazio")} hint={t("acervo.desejos.vazioDica")} action={novo} />}
      <ul className="acv-desejos-lista">
        {dados.desejos.map((d) => {
          const detalhes = [label(d.categoria), d.cor, d.tamanho, d.marca].filter(Boolean).join(" · ");
          return (
            <li key={d.id} className="acv-cartao acv-desejo">
              <div className="acv-desejo-texto">
                <p className="acv-desejo-nome">{d.nome}</p>
                <p className="acv-dica">{detalhes}</p>
                <p className="acv-dica">{d.caminho ? t("acervo.desejos.entraria", { lugar: d.caminho }) : t("acervo.desejos.semLugarDefinido")}</p>
              </div>
              <p className="acv-desejo-preco">
                {d.precoEstimado === null ? t("acervo.semPreco") : fmtPrice(d.precoEstimado, d.moeda)}
                {d.precoEstimado !== null && <span className="acv-selo">{t("acervo.estimado")}</span>}
              </p>
              <Switch id={`acv-sim-${d.id}`} checked={tela.simulados.includes(d.id)} disabled={!d.compartimentoId}
                onChange={() => tela.alternarSimulado(d.id)} label={t("acervo.simulacao.simular")}
                hint={d.compartimentoId ? undefined : t("acervo.simulacao.precisaLugar")} />
              <div className="acv-desejo-acoes">
                <Button size="sm" onClick={() => setForm({ aberto: true, desejo: d })} aria-label={t("acervo.desejos.editarItem", { nome: d.nome })}>
                  {t("common.edit")}
                </Button>
                <Button size="sm" variant="ghost" aria-label={t("acervo.desejos.apagarItem", { nome: d.nome })}
                  onClick={() => { void dados.executar(() => acervoApi.apagarDesejo(d.id), t("acervo.desejos.apagado")); }}>
                  {t("common.delete")}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <DesejoFormDialog aberto={form.aberto} desejo={form.desejo} onClose={() => setForm({ aberto: false, desejo: null })} />
    </section>
  );
}
