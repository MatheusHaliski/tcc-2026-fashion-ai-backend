"use client";
/**
 * A roda radial de recursos e armas (padrão de console): ícones grandes em volta de um círculo e, no meio, só o nome do
 * item em foco e os usos dele. O foco anda pelo mouse (a fatia sob o ponteiro), pelas setas ou pelo analógico (o
 * vetor de estado-do-console, lido a cada quadro) e o clique escolhe. Quem usa decide o que "escolher" faz (equipar,
 * usar) e quando a roda fecha (soltar X, P, Esc). Com "reduzir movimento", sem animação de abertura. Reutilizável.
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { estadoDoConsole } from "@/lib/flair/nucleos/controle/estado-do-console";
import { fatiaDoVetor, posicaoNaRoda } from "@/lib/flair/nucleos/controle/roda-radial";

export interface ItemDaRoda {
  id: string;
  nome: string;
  icone: ReactNode;
  /** os usos que sobram ("8 / 24", "×2"); vazio = sem contagem */
  usos?: string;
  habilitado: boolean;
  /** o item que está equipado agora */
  equipado?: boolean;
}

interface Props {
  itens: ItemDaRoda[];
  foco: number;
  onFoco: (i: number) => void;
  onEscolher: (i: number) => void;
  rotulo: string;
  reduzido: boolean;
  /** raio em px (a roda inteira tem 2 × raio + o tamanho do item) */
  raio?: number;
}

export function RodaRadial({ itens, foco, onFoco, onEscolher, rotulo, reduzido, raio = typeof window !== "undefined" && window.innerWidth < 480 ? 104 : 132 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const focoRef = useRef(foco);
  focoRef.current = foco;
  const onFocoRef = useRef(onFoco);
  onFocoRef.current = onFoco;
  const n = itens.length;
  // setas e analógico: o vetor de andar aponta a fatia (para cima = o item do alto)
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return;
    let frame = 0;
    const ler = () => {
      const { mover } = estadoDoConsole();
      const i = fatiaDoVetor(mover.x, -mover.y, n);
      if (i !== null && i !== focoRef.current) onFocoRef.current(i);
      frame = window.requestAnimationFrame(ler);
    };
    frame = window.requestAnimationFrame(ler);
    return () => window.cancelAnimationFrame(frame);
  }, [n]);
  const noPonteiro = (x: number, y: number) => {
    const caixa = ref.current?.getBoundingClientRect();
    if (!caixa) return;
    const i = fatiaDoVetor(x - (caixa.left + caixa.width / 2), y - (caixa.top + caixa.height / 2), n, raio, 0.3);
    if (i !== null && i !== foco) onFoco(i);
  };
  const atual = itens[foco];
  return (
    <div className="cst-roda-fundo" data-testid="roda-radial">
      <div ref={ref} className={`cst-roda${reduzido ? " is-calma" : ""}`} role="menu" aria-label={rotulo} style={{ "--cst-roda-raio": `${raio}px` } as CSSProperties}
        onPointerMove={(e) => noPonteiro(e.clientX, e.clientY)}>
        {itens.map((it, i) => {
          const p = posicaoNaRoda(i, n, raio);
          return (
            <button key={it.id} type="button" role="menuitem" className={`cst-roda-item${i === foco ? " is-foco" : ""}${it.habilitado ? "" : " is-vazio"}${it.equipado ? " is-equipado" : ""}`}
              style={{ transform: `translate(${p.x}px, ${p.y}px)` }} aria-label={it.usos ? `${it.nome} ${it.usos}` : it.nome} aria-disabled={!it.habilitado || undefined}
              data-item={it.id} onClick={() => onEscolher(i)} onFocus={() => onFoco(i)}>
              {it.icone}
              {it.usos && <span className="cst-roda-usos" aria-hidden>{it.usos}</span>}
            </button>
          );
        })}
        {atual && (
          <p className="cst-roda-nome" aria-live="polite" data-testid="roda-nome">
            {atual.nome}
          </p>
        )}
      </div>
    </div>
  );
}
