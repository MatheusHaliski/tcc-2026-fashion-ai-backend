"use client";
/**
 * Resultado da entrega: pontos (0 a 100), estrelas (60, 80 e 100), resultado, regras cumpridas ou não, as cartas que
 * pontuaram (com os pontos ou o efeito de cada uma) e os eventos. Tudo como o servidor devolveu.
 */
import { cn } from "@/components/ui";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

export interface CartaNoResultado {
  cardId: string;
  nome: string;
  /** pontos ou efeito da carta, já em texto */
  texto: string;
}

interface Props {
  codigo: string;
  resultado: NucleoResultado;
  onAgain: () => void;
  /** cartas que pontuaram, na ordem em que brilham na régua de vagas */
  cartas?: CartaNoResultado[];
  /** jogo artístico, sem placar (nenhuma regra vale pontos): o resultado não mostra "0 pontos" nem estrelas vazias */
  semPlacar?: boolean;
}

export function NucleoResult({ codigo, resultado, onAgain, cartas = [], semPlacar = false }: Props) {
  const tx = useNucleoText();
  const estrelas = Math.max(0, Math.min(3, resultado.estrelas));
  return (
    <section className="n3d-result" aria-labelledby="n3d-result-title" data-testid="nucleo-result">
      <h2 id="n3d-result-title" className="type-h3">{tx.t("flair3d.ui.result.title")}</h2>
      {semPlacar ? <p className="n3d-result-outcome" data-no-score>{tx.t("flair3d.ui.result.noScore")}</p> : (
        <>
          <p className="n3d-result-points tabular">{tx.pontosTotal(resultado.pontos)}</p>
          <p className="n3d-stars" aria-label={tx.t("flair3d.ui.result.stars", { n: estrelas })}>
            {[1, 2, 3].map((i) => (
              <span key={i} className={cn("n3d-star", i <= estrelas && "is-on")} aria-hidden>★</span>
            ))}
          </p>
        </>
      )}
      {resultado.resultado && <p className="n3d-result-outcome">{tx.resultado(resultado.resultado)}</p>}
      <ul className="n3d-rules">
        {resultado.regras.map((r) => (
          <li key={r.codigo} className={r.ok ? "is-ok" : "is-miss"}>
            <span>{tx.t(r.ok ? "flair3d.ui.result.ok" : "flair3d.ui.result.notOk")}</span>
            <span>{tx.regra(codigo, r.codigo)}</span>
            {!semPlacar && <em className="tabular">{tx.pontos(r.pontos)}</em>}
          </li>
        ))}
      </ul>
      {cartas.length > 0 && (
        <>
          <h3 className="type-label">{tx.t("flair3d.ui.result.cards")}</h3>
          <ol className="n3d-result-cards">
            {cartas.map((c) => (
              <li key={c.cardId}>
                <span>{c.nome}</span>
                <em className="tabular">{c.texto}</em>
              </li>
            ))}
          </ol>
        </>
      )}
      {resultado.eventos.length > 0 && (
        <>
          <h3 className="type-label">{tx.t("flair3d.ui.result.events")}</h3>
          <ol className="n3d-events">
            {resultado.eventos.map((e, i) => (
              <li key={i}>{tx.evento(e)}</li>
            ))}
          </ol>
        </>
      )}
      <button type="button" className="btn" onClick={onAgain}>{tx.t("flair3d.ui.result.again")}</button>
    </section>
  );
}
