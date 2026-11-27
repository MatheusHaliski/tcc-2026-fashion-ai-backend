"use client";
/**
 * ACERVO — gaveta expandida: o conteúdo do compartimento escolhido se projeta para fora do móvel, num painel ampliado
 * com as peças em fotos. Dá para abrir a ficha de cada peça, arrastar a peça para outro compartimento ou usar
 * "Mover para…" na ficha.
 */
import { useI18n } from "@/lib/i18n/i18n";
import { iniciarArrasto } from "@/lib/acervo/arrasto";
import { acharCompartimento, marcadores, pecasDoCompartimento } from "@/lib/acervo/arvore";
import { useAcervo } from "../acervo-contexto";
import { AcervoIcone, type AcervoIconeNome } from "../acervo-icone";
import { PecaFoto } from "../peca-card";
import { useFantasmas, usePecasParadas } from "../use-acervo-destaques";

const ICONE: Record<string, AcervoIconeNome> = { CABIDEIRO: "cabide", PRATELEIRA: "prateleira", GAVETA: "gaveta" };

export function GavetaExpandida({ compartimentoId, onFechar }: { compartimentoId: string; onFechar: () => void }) {
  const { t } = useI18n();
  const { dados, tela, busca } = useAcervo();
  const fantasmasDe = useFantasmas();
  const paradas = usePecasParadas();
  const arvore = dados.arvore;
  const achado = arvore ? acharCompartimento(arvore, compartimentoId) : null;
  if (!arvore || !achado) return null;
  const pecas = pecasDoCompartimento(arvore, compartimentoId);
  const fantasmas = fantasmasDe(compartimentoId);
  const numeros = marcadores(tela.selecao);
  const c = achado.compartimento;

  return (
    <section className={`acv-expandida is-${c.tipo.toLowerCase()}`} aria-label={t("acervo.expandida.titulo", { nome: c.nome })} data-testid="acervo-expandida">
      <header className="acv-expandida-cabeca">
        <AcervoIcone nome={ICONE[c.tipo]} tamanho={16} />
        <h3>{c.nome}</h3>
        <span className="acv-lista-conta">{t("acervo.pecas", { count: pecas.length })}</span>
        <button type="button" className="acv-link" onClick={onFechar}>{t("common.close")}</button>
      </header>
      {pecas.length === 0 && fantasmas.length === 0 && <p className="acv-dica">{t("acervo.expandida.vazia")}</p>}
      <ul className="acv-expandida-pecas">
        {pecas.map((p) => {
          const classes = ["acv-expandida-peca", busca.achadas.has(p.id) && "is-achada", paradas.has(p.id) && "is-parada"];
          return (
            <li key={p.id} draggable onDragStart={(e) => iniciarArrasto(e, [p.id])}>
              <button type="button" className={classes.filter(Boolean).join(" ")} onClick={() => tela.abrirPeca(p.id)}
                aria-label={t("acervo.peca.abrir", { nome: p.name })}>
                <PecaFoto peca={p} />
                <span className="acv-expandida-nome">{p.name}</span>
                {numeros.has(p.id) && <span className="acv-marcador">{numeros.get(p.id)}</span>}
              </button>
            </li>
          );
        })}
        {fantasmas.map((d) => (
          <li key={d.id} className="acv-expandida-peca is-fantasma">
            <span className="acv-foto" aria-hidden />
            <span className="acv-expandida-nome">{d.nome}</span>
            <span className="acv-selo">{t("acervo.simulacao.selo")}</span>
          </li>
        ))}
      </ul>
      {pecas.length > 0 && <p className="acv-dica">{t("acervo.expandida.dica")}</p>}
    </section>
  );
}
