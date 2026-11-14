"use client";
/**
 * Escolha da rodada, antes do deck: uma lista com o nome, o objetivo em uma linha e as regras de cada rodada do jogo
 * (as que o servidor oferece). A primeira é a padrão. Nas rodadas em etapas, a lista diz quantos looks a rodada pede.
 * Setas ou Tab andam pela lista; Enter ou Espaço escolhem, como em qualquer botão.
 */
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { rodadasDe } from "@/lib/flair/nucleos/rodadas";
import type { NucleoDefinicao, NucleoRodada } from "@/lib/flair/nucleos/types";

interface Props {
  definicao: NucleoDefinicao;
  onEscolher: (rodada: string) => void;
}

export function NucleoRounds({ definicao, onEscolher }: Props) {
  const tx = useNucleoText();
  const codigo = definicao.codigo;
  const rodadas = rodadasDe(definicao);

  const andar = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const passo = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!passo) return;
    const botoes = Array.from(e.currentTarget.closest("ol")?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const proximo = botoes[(botoes.indexOf(e.currentTarget) + passo + botoes.length) % botoes.length];
    proximo?.focus();
    e.preventDefault();
  };

  const regras = (r: NucleoRodada) => r.objetivo.regras.filter((x) => x.pontos !== 0).slice(0, 5);

  return (
    <section className="n3d-rounds" aria-labelledby="n3d-rounds-title" data-testid="nucleo-rounds">
      <h2 id="n3d-rounds-title" className="type-h3">{tx.t("flair3d.ui.rounds.title")}</h2>
      <p className="text-muted">{tx.t("flair3d.ui.rounds.lead")}</p>
      <ol className="n3d-rounds-list">
        {rodadas.map((r, i) => (
          <li key={r.codigo}>
            <button type="button" className="n3d-round" data-rodada={r.codigo} autoFocus={i === 0} onKeyDown={andar} onClick={() => onEscolher(r.codigo)}>
              <span className="n3d-round-name">{tx.rodadaNome(codigo, r.codigo)}</span>
              <span className="n3d-round-goal">{tx.rodadaObjetivo(codigo, r.codigo)}</span>
              {(r.etapas ?? 1) > 1 && <span className="n3d-round-steps">{tx.t("flair3d.ui.rounds.steps", { n: r.etapas ?? 1 })}</span>}
              {regras(r).length > 0 && (
                <span className="n3d-round-rules">
                  {regras(r).map((x) => tx.regra(codigo, x.codigo)).join(" · ")}
                </span>
              )}
              <span className="n3d-round-go" aria-hidden>{tx.t("flair3d.ui.rounds.play")}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
