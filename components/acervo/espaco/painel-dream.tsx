"use client";
/**
 * ACERVO — Dream Space: o closet imaginado. Mostra o orçamento das peças desejadas (sempre estimado), liga a simulação
 * de cada desejo e deixa o closet crescer com mais um módulo suspenso.
 */
import { Button, Switch } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { acervoApi } from "@/lib/acervo/api";
import { movelPadrao } from "@/lib/acervo/opcoes";
import { useAcervo } from "../acervo-contexto";

export function PainelDream({ ambienteId, modulos }: { ambienteId: string | null; modulos: number }) {
  const { t, fmtPrice } = useI18n();
  const { dados, tela } = useAcervo();
  const f = dados.financeiro;

  function expandir() {
    if (!ambienteId) return;
    const nome = t("acervo.dream.nomeModulo", { n: modulos + 1 });
    void dados.executar(() => acervoApi.criarMovel(ambienteId, movelPadrao("DREAM_SPACE", nome)), t("acervo.dream.moduloCriado"));
  }

  return (
    <section className="acv-cartao acv-dream" aria-label={t("acervo.dream.painel")}>
      <header className="acv-cartao-cabeca">
        <h3 className="acv-cartao-titulo">{t("acervo.modo.dreamSpace")}</h3>
        <span className="acv-selo is-lima">{t("acervo.dream.conceito")}</span>
      </header>
      <p className="acv-dica">{t("acervo.dream.texto")}</p>
      <Button size="sm" disabled={!ambienteId} loading={dados.ocupado} onClick={expandir}>{t("acervo.dream.expandir")}</Button>
      <h4 className="acv-ficha-subtitulo">{t("acervo.dream.orcamento")}</h4>
      {f && (
        <p className="acv-fin-total">
          <span className="acv-fin-numero is-menor" data-testid="acervo-dream-orcamento">{fmtPrice(f.desejos.valor, f.moeda)}</span>
          <span className="acv-selo">{t("acervo.estimado")}</span>
        </p>
      )}
      {dados.desejos.length === 0 && <p className="acv-dica">{t("acervo.dream.semDesejos")}</p>}
      <ul className="acv-dream-desejos">
        {dados.desejos.map((d) => (
          <li key={d.id}>
            <Switch id={`acv-dream-${d.id}`} checked={tela.simulados.includes(d.id)} disabled={!d.compartimentoId}
              onChange={() => tela.alternarSimulado(d.id)} label={d.nome}
              hint={d.compartimentoId
                ? d.precoEstimado === null ? t("acervo.semPreco") : fmtPrice(d.precoEstimado, d.moeda)
                : t("acervo.simulacao.precisaLugar")} />
          </li>
        ))}
      </ul>
      <button type="button" className="acv-link" onClick={() => { tela.setVista("CENTRAL"); tela.setAba("DESEJOS"); }}>
        {t("acervo.dream.abrirDesejos")}
      </button>
    </section>
  );
}
