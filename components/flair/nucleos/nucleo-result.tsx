"use client";
/**
 * Resultado da entrega: pontos (0 a 100), estrelas (60, 80 e 100), resultado, regras cumpridas ou não, as cartas que
 * pontuaram (com os pontos ou o efeito de cada uma) e os eventos. Tudo como o servidor devolveu.
 */
import type { ReactNode } from "react";
import { cn } from "@/components/ui";
import { BatalhaPlacar } from "@/components/flair/nucleos/batalha-placar";
import { NucleoResultAura } from "@/components/flair/nucleos/nucleo-result-aura";
import { NucleoResultCampanha } from "@/components/flair/nucleos/nucleo-result-campanha";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { desfechoDe } from "@/lib/flair/nucleos/narrativa";
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";

export interface CartaNoResultado {
  cardId: string;
  nome: string;
  /** pontos ou efeito da carta, já em texto */
  texto: string;
  /** a faixa de Hype em que a carta jogou (só leitura: o jogo não escreve Hype) */
  hype?: string;
}

interface Props {
  codigo: string;
  resultado: NucleoResultado;
  onAgain: () => void;
  /** cartas que pontuaram, na ordem em que brilham na régua de vagas */
  cartas?: CartaNoResultado[];
  /** jogo artístico, sem placar (nenhuma regra vale pontos): o resultado não mostra "0 pontos" nem estrelas vazias */
  semPlacar?: boolean;
  /** a rodada jogada: o nome dela abre o resultado */
  rodada?: string | null;
  /** bloco próprio do jogo antes do botão (o resumo da partida do Fashion Sports) */
  children?: ReactNode;
}

/** Eventos que a tabela da Batalha já mostra. */
const NA_TABELA = new Set(["RODADA_DA_BATALHA", "SOMA_DA_BATALHA", "LOOK_DO_ADVERSARIO", "CONTA_DA_BATALHA", "ADVERSARIO"]);

/** Quantas dicas de "o que trocar" cabem no resultado. */
const MAX_DICAS = 4;

export function NucleoResult({ codigo, resultado, onAgain, cartas = [], semPlacar = false, rodada = null, children }: Props) {
  const tx = useNucleoText();
  const estrelas = Math.max(0, Math.min(3, resultado.estrelas));
  /** o final da história do jogo, pelo desfecho (vitória, empate, derrota; aprovado com 3 estrelas, com 1 ou 2, reprovado) */
  const final = desfechoDe(resultado);
  // a rodada pode ter o final dela ("o look-alvo" do Look Relâmpago); senão, o do jogo
  const desfecho = tx.ou(`flair3d.narrativa.${codigo}.final.${rodada ?? "-"}.${final}`, tx.ou(`flair3d.narrativa.${codigo}.final.${final}`, ""));
  /** a conta da nota quando as regras não somam direto em 100 (a Passarela soma até 70) */
  const conta = resultado.eventos.find((e) => e.codigo === "CONTA");
  // a comparação da Batalha tem a tabela dela (batalha-placar.tsx): as linhas de cada rodada não se repetem em texto
  const eventos = resultado.eventos.filter((e) => e.codigo !== "CONTA" && !NA_TABELA.has(e.codigo)).map((e) => tx.evento(e)).filter((texto) => texto.trim() !== "");
  /** o que trocar: uma dica por regra não cumprida, sem repetir */
  /** rodada em etapas: cada etapa entra com 1/n dos pontos dela ("8,33" para uma etapa de 25 em 3) */
  const etapas = resultado.eventos.filter((e) => e.codigo === "ETAPA").length;
  const dicas = Array.from(new Set(resultado.regras.filter((r) => !r.ok).map((r) => tx.dica(codigo, r.codigo, tx.regra(codigo, r.codigo))))).slice(0, MAX_DICAS);
  return (
    <section className="n3d-result" aria-labelledby="n3d-result-title" data-testid="nucleo-result">
      <h2 id="n3d-result-title" className="type-h3">{tx.t("flair3d.ui.result.title")}</h2>
      {rodada && <p className="type-label" data-testid="nucleo-result-round">{tx.rodadaNome(codigo, rodada)}</p>}
      {desfecho && <p className="n3d-desfecho" data-testid="nucleo-desfecho">{desfecho}</p>}
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
      {codigo === "BATALHA_LOOKS" && <BatalhaPlacar resultado={resultado} />}
      <NucleoResultAura codigo={codigo as NucleoCodigo} resultado={resultado} />
      {conta && !semPlacar && <p className="n3d-hint" data-testid="nucleo-result-conta">{tx.evento(conta)}</p>}
      {etapas > 1 && !semPlacar && <p className="n3d-hint" data-testid="nucleo-result-media">{tx.t("flair3d.ui.result.media", { n: etapas })}</p>}
      {dicas.length > 0 && (
        <>
          <h3 className="type-label">{tx.t("flair3d.ui.result.hints")}</h3>
          <ul className="n3d-result-hints" data-testid="nucleo-result-hints">
            {dicas.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </>
      )}
      {dicas.length === 0 && resultado.regras.length > 0 && <p className="n3d-result-hints is-full" data-testid="nucleo-result-full">{tx.t("flair3d.ui.result.allRules")}</p>}
      {cartas.length > 0 && (
        <>
          <h3 className="type-label">{tx.t("flair3d.ui.result.cards")}</h3>
          <ol className="n3d-result-cards">
            {cartas.map((c) => (
              <li key={c.cardId}>
                <span>{c.nome}{c.hype && <small className="n3d-result-hype" data-hype={c.hype}>{tx.t("flair3d.ui.result.hype", { faixa: tx.t(`hype.level.${c.hype}`) })}</small>}</span>
                <em className="tabular">{c.texto}</em>
              </li>
            ))}
          </ol>
        </>
      )}
      {eventos.length > 0 && (
        <>
          <h3 className="type-label">{tx.t("flair3d.ui.result.events")}</h3>
          <ol className="n3d-events">
            {eventos.map((texto, i) => (
              <li key={i}>{texto}</li>
            ))}
          </ol>
        </>
      )}
      {children}
      <NucleoResultCampanha codigo={codigo} fechou={!resultado.status || resultado.status === "ENTREGUE"} />
      <button type="button" className="btn" onClick={onAgain}>{tx.t("flair3d.ui.result.again")}</button>
    </section>
  );
}
