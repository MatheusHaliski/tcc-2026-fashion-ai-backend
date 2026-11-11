"use client";
/** Resultado da entrega: pontos (0 a 100), estrelas (60, 80 e 100), resultado, regras cumpridas ou não e os eventos. */
import { cn } from "@/components/ui";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

/** Evento da cena (luta, partida, rodada): texto pelo código quando houver; senão, o que veio. */
function eventoCodigo(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    return String(o.codigo ?? o.tipo ?? JSON.stringify(o));
  }
  return String(e);
}

export function NucleoResult({ codigo, resultado, onAgain }: { codigo: string; resultado: NucleoResultado; onAgain: () => void }) {
  const tx = useNucleoText();
  const estrelas = Math.max(0, Math.min(3, resultado.estrelas));
  return (
    <section className="n3d-result" aria-labelledby="n3d-result-title" data-testid="nucleo-result">
      <h2 id="n3d-result-title" className="type-h3">{tx.t("flair3d.ui.result.title")}</h2>
      <p className="n3d-result-points tabular">{tx.t("flair3d.ui.result.points", { n: resultado.pontos })}</p>
      <p className="n3d-stars" aria-label={tx.t("flair3d.ui.result.stars", { n: estrelas })}>
        {[1, 2, 3].map((i) => <span key={i} className={cn("n3d-star", i <= estrelas && "is-on")} aria-hidden>★</span>)}
      </p>
      {resultado.resultado && <p className="n3d-result-outcome">{tx.resultado(resultado.resultado)}</p>}
      <ul className="n3d-rules">
        {resultado.regras.map((r) => (
          <li key={r.codigo} className={r.ok ? "is-ok" : "is-miss"}>
            <span>{tx.t(r.ok ? "flair3d.ui.result.ok" : "flair3d.ui.result.notOk")}</span>
            <span>{tx.regra(codigo, r.codigo)}</span>
            <em className="tabular">{tx.t("flair3d.ui.points", { n: r.pontos })}</em>
          </li>
        ))}
      </ul>
      {resultado.eventos.length > 0 && (
        <>
          <h3 className="type-label">{tx.t("flair3d.ui.result.events")}</h3>
          <ol className="n3d-events">
            {resultado.eventos.map((e, i) => {
              const cod = eventoCodigo(e);
              return <li key={i}>{tx.ou(`flair3d.ui.evento.${cod}`, cod)}</li>;
            })}
          </ol>
        </>
      )}
      <button type="button" className="btn" onClick={onAgain}>{tx.t("flair3d.ui.result.again")}</button>
    </section>
  );
}
