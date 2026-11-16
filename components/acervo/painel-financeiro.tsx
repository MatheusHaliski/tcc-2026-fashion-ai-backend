"use client";
/**
 * ACERVO — painel financeiro: valor das peças compradas (só as que têm preço), por grupo, subtotal das peças marcadas,
 * lista de desejos (sempre estimativa) e o efeito da simulação de compra. Custo por uso só aparece quando há uso
 * registrado. Nada aqui é inventado: o que falta aparece como "sem preço".
 */
import { useI18n } from "@/lib/i18n/i18n";
import type { AcervoFinanceiro } from "@/lib/acervo/types";
import { useAcervo } from "./acervo-contexto";
import { AcervoIcone, type AcervoIconeNome } from "./acervo-icone";

const ICONE_GRUPO: Record<AcervoFinanceiro["grupos"][number]["grupo"], AcervoIconeNome> = {
  ROUPAS: "roupa",
  CALCADOS: "sapato",
  ACESSORIOS: "bolsa",
  OUTROS: "outros",
};

export function PainelFinanceiro() {
  const { t, fmtPrice } = useI18n();
  const { dados, tela } = useAcervo();
  const f = dados.financeiro;
  if (!f) return <aside className="acv-cartao acv-fin" aria-busy="true" aria-label={t("acervo.fin.titulo")} />;
  const preco = (valor: number) => fmtPrice(valor, f.moeda);
  const simulados = dados.desejos.filter((d) => tela.simulados.includes(d.id));
  const simulacao = simulados.reduce((soma, d) => soma + (d.moeda === f.moeda ? d.precoEstimado ?? 0 : 0), 0);
  const abrirDesejos = () => {
    tela.setVista("CENTRAL");
    tela.setAba("DESEJOS");
  };

  return (
    <aside className="acv-fin" aria-label={t("acervo.fin.titulo")}>
      <section className="acv-cartao">
        <h3 className="acv-cartao-titulo">{t("acervo.fin.valor")}</h3>
        <p className="acv-fin-total">
          <span className="acv-fin-numero" data-testid="acervo-total">{preco(f.valor)}</span>
          <span className="acv-fin-conta">{t("acervo.pecas", { count: f.totalPecas })}</span>
        </p>
        {f.pecasSemPreco > 0 && <p className="acv-dica">{t("acervo.fin.semPreco", { count: f.pecasSemPreco })}</p>}
        {f.pecasOutraMoeda > 0 && <p className="acv-dica">{t("acervo.fin.outraMoeda", { count: f.pecasOutraMoeda })}</p>}
        <ul className="acv-fin-grupos">
          {f.grupos.map((g) => (
            <li key={g.grupo}>
              <AcervoIcone nome={ICONE_GRUPO[g.grupo]} tamanho={16} />
              <span>{t(`acervo.fin.grupo.${g.grupo.toLowerCase()}`)}</span>
              <span className="acv-fin-valor">{g.valor > 0 ? preco(g.valor) : t("acervo.semPreco")}</span>
            </li>
          ))}
        </ul>
      </section>

      {tela.selecao.length > 0 && (
        <section className="acv-cartao is-lima" aria-live="polite">
          <h3 className="acv-cartao-titulo">{t("acervo.fin.selecao", { count: f.selecao.totalPecas })}</h3>
          <p className="acv-fin-total">
            <span className="acv-fin-numero" data-testid="acervo-subtotal">{preco(f.selecao.valor)}</span>
            <button type="button" className="acv-link" onClick={tela.limparSelecao}>{t("acervo.fin.limpar")}</button>
          </p>
          {f.selecao.pecasSemPreco > 0 && <p className="acv-dica">{t("acervo.fin.semPreco", { count: f.selecao.pecasSemPreco })}</p>}
        </section>
      )}

      <section className="acv-cartao">
        <button type="button" className="acv-fin-desejos" onClick={abrirDesejos}>
          <AcervoIcone nome="coracao" tamanho={16} />
          <span>{t("acervo.desejos.titulo")}</span>
          <span className="acv-fin-valor" data-testid="acervo-desejos-total">{preco(f.desejos.valor)}</span>
        </button>
        <p className="acv-dica"><span className="acv-selo">{t("acervo.estimado")}</span> {t("acervo.fin.desejosNota", { count: f.desejos.itens })}</p>
        {f.desejos.semPreco > 0 && <p className="acv-dica">{t("acervo.fin.desejosSemPreco", { count: f.desejos.semPreco })}</p>}
        {simulados.length > 0 && (
          <div className="acv-fin-simulacao" data-testid="acervo-simulacao">
            <p>{t("acervo.simulacao.impacto", { count: simulados.length })}</p>
            <p className="acv-fin-linha"><span>{t("acervo.simulacao.gasto")}</span><span className="acv-fin-valor">{preco(simulacao)}</span></p>
            <p className="acv-fin-linha"><span>{t("acervo.simulacao.novoTotal")}</span><span className="acv-fin-valor">{preco(f.valor + simulacao)}</span></p>
            <p className="acv-dica"><span className="acv-selo">{t("acervo.estimado")}</span> {t("acervo.simulacao.nota")}</p>
          </div>
        )}
      </section>

      {f.custoPorUso && (
        <section className="acv-cartao">
          <h3 className="acv-cartao-titulo"><AcervoIcone nome="barras" tamanho={16} />{t("acervo.fin.custoPorUso")}</h3>
          <p className="acv-fin-numero is-menor">{preco(f.custoPorUso.valor)}</p>
          <p className="acv-dica">{t("acervo.fin.custoPorUsoNota", { pecas: f.custoPorUso.pecas, usos: f.custoPorUso.usos })}</p>
        </section>
      )}

      <button type="button" className="acv-botao-grafite" onClick={abrirDesejos}>
        <AcervoIcone nome="brilho" tamanho={18} />
        <span>{t("acervo.fin.completar")}</span>
      </button>
    </aside>
  );
}
