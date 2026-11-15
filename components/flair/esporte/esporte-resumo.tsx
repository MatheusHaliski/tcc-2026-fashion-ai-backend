"use client";
/**
 * O resumo final da partida do Fashion Sports, dentro do resultado: posse, finalizações, defesas, desarmes, passes e
 * quantas jogadas tiveram carta; depois, que carta disparou que lance (a peça que jogou). Tudo como o servidor mandou.
 */
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { linhasDoResumo, narracao } from "@/components/flair/esporte/esporte-texto";
import type { EsporteNaTela } from "@/components/flair/esporte/use-esporte";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

/** Eventos que só carregam dados da partida: o resultado não os lista um a um (o resumo conta a história). */
const SO_DADOS = new Set(["JOGADA", "SITUACAO", "RESUMO"]);

/** O resultado sem os eventos de dados (os lances aparecem no resumo, não na lista "O que aconteceu"). */
export function resultadoSemLances(r: NucleoResultado): NucleoResultado {
  return { ...r, eventos: r.eventos.filter((e) => !SO_DADOS.has(e.codigo)) };
}

export function EsporteResumo({ esporte, cartas }: { esporte: EsporteNaTela; cartas: FlairCollectionCard[] }) {
  const tx = useNucleoText();
  if (!esporte.resumo) return null;
  const nome = (id?: string) => cartas.find((c) => c.id === id)?.name ?? tx.t("flair3d.ui.briefing.alvoUnknown");
  return (
    <div className="fsp-resumo" data-testid="esporte-resumo">
      <h3 className="type-label">{tx.t("flair3d.esporte.resumo.titulo")}</h3>
      <ul className="n3d-events">
        {linhasDoResumo(tx, esporte.resumo).map((linha) => (
          <li key={linha}>{linha}</li>
        ))}
      </ul>
      {esporte.comCarta.length > 0 && (
        <>
          <h3 className="type-label">{tx.t("flair3d.esporte.resumo.pecas")}</h3>
          <ol className="n3d-events" data-testid="esporte-pecas">
            {esporte.comCarta.map((j) => (
              <li key={j.n}>{tx.t("flair3d.esporte.resumo.peca", { nome: nome(j.carta), lance: narracao(tx, esporte.modalidade, j) })}</li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
