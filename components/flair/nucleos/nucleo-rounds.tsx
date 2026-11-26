"use client";
/**
 * Escolha da rodada, antes do deck: uma lista com o nome, o objetivo em uma linha e as regras de cada rodada do jogo
 * (as que o servidor oferece). Nas rodadas em etapas, a lista diz quantos looks a rodada pede. Com a campanha do
 * servidor (lib/flair/nucleos/progresso.ts), cada rodada mostra se já foi vencida, as estrelas ganhas nela e, quando
 * ainda está fechada, qual rodada a abre; a fechada não se escolhe. Sem a campanha, nada fica marcado nem travado.
 * Setas ou Tab andam pela lista; Enter ou Espaço escolhem, como em qualquer botão.
 */
import { cn } from "@/components/ui";
import { EstrelasDaRodada } from "@/components/flair/nucleos/nucleo-campanha";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { useI18n } from "@/lib/i18n/i18n";
import { etapaDe, type EtapaDaCampanha, type NucleoProgresso } from "@/lib/flair/nucleos/progresso";
import { rodadasDe } from "@/lib/flair/nucleos/rodadas";
import type { NucleoDefinicao, NucleoRodada } from "@/lib/flair/nucleos/types";

interface Props {
  definicao: NucleoDefinicao;
  onEscolher: (rodada: string) => void;
  /** a campanha da pessoa neste jogo; nula enquanto o servidor não responde */
  progresso?: NucleoProgresso | null;
}

export function NucleoRounds({ definicao, onEscolher, progresso = null }: Props) {
  const tx = useNucleoText();
  const { locale } = useI18n();
  const codigo = definicao.codigo;
  const rodadas = rodadasDe(definicao);
  /** a rodada que recebe o foco: a próxima da campanha ou, sem campanha, a primeira */
  const proxima = progresso?.enredo?.proxima ?? rodadas[0]?.codigo;

  const andar = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const passo = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!passo) return;
    const botoes = Array.from(e.currentTarget.closest("ol")?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const proximo = botoes[(botoes.indexOf(e.currentTarget) + passo + botoes.length) % botoes.length];
    proximo?.focus();
    e.preventDefault();
  };

  const regras = (r: NucleoRodada) => r.objetivo.regras.filter((x) => x.pontos !== 0).slice(0, 5);
  const dia = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(new Date(iso));

  /** a situação da rodada na campanha, em uma linha */
  const situacao = (e: EtapaDaCampanha) => {
    if (!e.aberta) return tx.t("flair3d.ui.rounds.fechada", { rodada: e.abreCom ? tx.rodadaNome(codigo, e.abreCom) : "" });
    if (e.vencida) {
      const quando = e.vencidaEm && !Number.isNaN(new Date(e.vencidaEm).getTime()) ? ` · ${tx.t("flair3d.ui.rounds.vencidaEm", { quando: dia(e.vencidaEm) })}` : "";
      return `${tx.t("flair3d.ui.rounds.vencida")} · ${tx.t("flair3d.ui.rounds.melhor", { pontos: tx.pontosTotal(e.pontos) })}${quando}`;
    }
    if (e.partidas > 0) return `${tx.t("flair3d.ui.rounds.semVitoria", { n: e.partidas })} · ${tx.t("flair3d.ui.rounds.melhor", { pontos: tx.pontosTotal(e.pontos) })}`;
    return e.codigo === progresso?.enredo?.proxima ? tx.t("flair3d.ui.rounds.proxima") : null;
  };

  return (
    <section className="n3d-rounds" aria-labelledby="n3d-rounds-title" data-testid="nucleo-rounds">
      <h2 id="n3d-rounds-title" className="type-h3">{tx.t("flair3d.ui.rounds.title")}</h2>
      <p className="text-muted">{tx.t("flair3d.ui.rounds.lead")}</p>
      <ol className="n3d-rounds-list">
        {rodadas.map((r) => {
          const etapa = etapaDe(progresso, r.codigo);
          const fechada = !!etapa && !etapa.aberta;
          const linha = etapa ? situacao(etapa) : null;
          return (
            <li key={r.codigo}>
              <button type="button" className={cn("n3d-round", etapa?.vencida && "is-vencida", fechada && "is-fechada")} data-rodada={r.codigo}
                data-estado={!etapa ? undefined : fechada ? "fechada" : etapa.vencida ? "vencida" : "aberta"} aria-disabled={fechada || undefined}
                autoFocus={r.codigo === proxima} onKeyDown={andar} onClick={() => !fechada && onEscolher(r.codigo)}>
                <span className="n3d-round-name">{tx.rodadaNome(codigo, r.codigo)}</span>
                {etapa && !fechada && <EstrelasDaRodada n={etapa.estrelas} rotulo={tx.t("flair3d.ui.rounds.estrelas", { n: etapa.estrelas })} />}
                {linha && <span className="n3d-round-estado" data-testid="nucleo-round-estado">{linha}</span>}
                <span className="n3d-round-goal">{tx.rodadaObjetivo(codigo, r.codigo)}</span>
                {(r.etapas ?? 1) > 1 && <span className="n3d-round-steps">{tx.t("flair3d.ui.rounds.steps", { n: r.etapas ?? 1 })}</span>}
                {regras(r).length > 0 && (
                  <span className="n3d-round-rules">
                    {regras(r).map((x) => tx.regra(codigo, x.codigo)).join(" · ")}
                  </span>
                )}
                {!fechada && <span className="n3d-round-go" aria-hidden>{tx.t("flair3d.ui.rounds.play")}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
