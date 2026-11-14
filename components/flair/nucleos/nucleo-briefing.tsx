"use client";
/**
 * Cartão de apresentação sobre a faixa do deck (nunca sobre o palco: a roupa continua à vista): a etapa da vez de uma
 * rodada em etapas, ou o que o jogo revelou ao entrar (tema, estrela com as pistas, cena, desafio, pedido, oponente).
 * Fecha no botão ou sozinho depois de ABERTURA_MS e reabre quando a etapa muda. O look-alvo do Look Relâmpago fica à
 * vista só pelos segundos que o servidor mandou e não volta: depois disso a pessoa recria de memória.
 */
import { useEffect } from "react";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { Briefing } from "@/lib/flair/nucleos/briefing";

/** Quanto o cartão fica na tela, em ms, se a pessoa não fechar antes. */
export const ABERTURA_MS = 12000;

type Texto = ReturnType<typeof useNucleoText>;

/** O briefing em uma linha, para a dica que fica sob o deck depois que o cartão fecha. */
export function resumoDoBriefing(tx: Texto, b: Briefing): string {
  if (b.tipo === "oponente" && b.oponente) return tx.t("flair3d.ui.briefing.oponenteAttrs", { ...b.oponente });
  if (b.tipo === "alvo") return tx.t("flair3d.ui.briefing.alvoGone");
  const nome = tx.etapaNome(b.codigo);
  const texto = tx.etapaTexto(b.codigo);
  const nota = b.nota ? ` ${tx.t("flair3d.ui.briefing.nota", { nome: tx.etapaNome(b.nota), texto: tx.etapaTexto(b.nota) })}` : "";
  const base = `${texto ? `${nome}: ${texto}` : nome}${nota}`;
  if (!b.etapa) return `${tx.t(`flair3d.ui.briefing.${b.tipo}`)} · ${base}`;
  const passo = tx.t("flair3d.ui.briefing.step", { n: b.etapa.etapa, total: b.etapa.total });
  return b.etapa.tentativa > 1 ? `${passo} · ${base} ${tx.t("flair3d.ui.briefing.retry", { n: b.etapa.tentativa })}` : `${passo} · ${base}`;
}

interface Props {
  briefing: Briefing;
  /** cartas da partida, para dar nome às peças do look-alvo */
  cartas: FlairCollectionCard[];
  aberto: boolean;
  onFechar: () => void;
}

export function NucleoBriefing({ briefing, cartas, aberto, onFechar }: Props) {
  const tx = useNucleoText();
  const prazo = briefing.tipo === "alvo" ? (briefing.segundos ?? 10) * 1000 : ABERTURA_MS;

  useEffect(() => {
    if (!aberto) return;
    const timer = window.setTimeout(onFechar, prazo);
    return () => window.clearTimeout(timer);
  }, [aberto, briefing.chave, prazo, onFechar]);

  if (!aberto) return null;
  const fechar = onFechar;
  const etiqueta = briefing.etapa
    ? tx.t("flair3d.ui.briefing.step", { n: briefing.etapa.etapa, total: briefing.etapa.total })
    : tx.t(`flair3d.ui.briefing.${briefing.tipo}`);
  const nomeDaCarta = (id: string) => cartas.find((c) => c.id === id)?.name ?? tx.t("flair3d.ui.briefing.alvoUnknown");

  return (
    <section className="n3d-cutscene n3d-briefing" role="dialog" aria-label={tx.t("flair3d.ui.briefing.title")} data-testid="nucleo-briefing" data-tipo={briefing.tipo}>
      <p className="type-label">{etiqueta}</p>
      {briefing.codigo && <h3>{tx.etapaNome(briefing.codigo)}</h3>}
      {briefing.codigo && tx.etapaTexto(briefing.codigo) && <p>{tx.etapaTexto(briefing.codigo)}</p>}
      {briefing.etapa && briefing.etapa.tentativa > 1 && <p className="n3d-cutscene-code">{tx.t("flair3d.ui.briefing.retry", { n: briefing.etapa.tentativa })}</p>}
      {briefing.nota && <p className="n3d-cutscene-clue">{tx.t("flair3d.ui.briefing.nota", { nome: tx.etapaNome(briefing.nota), texto: tx.etapaTexto(briefing.nota) })}</p>}
      {briefing.oponente && <p>{tx.t("flair3d.ui.briefing.oponenteAttrs", { ...briefing.oponente })}</p>}
      {briefing.alvo && (
        <>
          <p>{tx.t("flair3d.ui.briefing.alvoLead", { n: briefing.segundos ?? 10 })}</p>
          <ul className="n3d-briefing-alvo">
            {Object.entries(briefing.alvo).map(([vaga, id]) => (
              <li key={vaga}>
                <span>{tx.posicao(vaga)}</span>
                <strong>{nomeDaCarta(id)}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
      <button type="button" className="btn btn-sm btn-primary" onClick={fechar}>
        {tx.t(briefing.alvo ? "flair3d.ui.briefing.alvoGo" : "flair3d.ui.briefing.go")}
      </button>
    </section>
  );
}
