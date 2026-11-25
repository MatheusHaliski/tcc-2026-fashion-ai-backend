"use client";
/**
 * A barra de tempo do chute e do desarme (lib/flair/esporte/tempo.ts): a marca corre de uma ponta à outra e a pessoa
 * aperta "Agora!" (ou Enter / A, pelos comandos da mão) quando ela passa pelo meio. Sem apertar em LIMITE_MS, conta
 * como errado. Com "reduzir movimento" a marca anda mais devagar. A tela só mede: o servidor dá o efeito no duelo.
 */
import { useEffect, useRef, type CSSProperties } from "react";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { faixaDoTempo, LIMITE_MS, PERIODO_MS, posicaoNaBarra, type FaixaDoTempo } from "@/lib/flair/esporte/tempo";

interface Props {
  /** o nome da ação (chute, desarme) */
  acao: string;
  reduzido: boolean;
  onFim: (faixa: FaixaDoTempo) => void;
  /** a tela guarda aqui como apertar a barra, para os comandos da mão (Enter / A) */
  apertar: React.MutableRefObject<(() => void) | null>;
}

export function BarraDeTempo({ acao, reduzido, onFim, apertar }: Props) {
  const tx = useNucleoText();
  const periodo = reduzido ? 2 * PERIODO_MS : PERIODO_MS;
  const inicio = useRef(performance.now());
  const fim = useRef(onFim);
  fim.current = onFim;
  const feito = useRef(false);
  const agora = () => {
    if (feito.current) return;
    feito.current = true;
    fim.current(faixaDoTempo(posicaoNaBarra(performance.now() - inicio.current, periodo)));
  };
  apertar.current = agora;
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!feito.current) {
        feito.current = true;
        fim.current(0);
      }
    }, LIMITE_MS);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="fsp-tempo" role="group" aria-label={tx.t("flair3d.esporte.tempo.titulo", { acao })} data-testid="esporte-tempo">
      <p className="n3d-hint">{tx.t("flair3d.esporte.tempo.dica", { acao })}</p>
      <div className="fsp-tempo-barra" aria-hidden>
        <span className="fsp-tempo-alvo" />
        <span className="fsp-tempo-marca" style={{ "--fsp-tempo-periodo": `${periodo}ms` } as CSSProperties} />
      </div>
      <button type="button" className="btn btn-sm btn-primary" onClick={agora}>{tx.t("flair3d.esporte.tempo.agora")}</button>
    </div>
  );
}
