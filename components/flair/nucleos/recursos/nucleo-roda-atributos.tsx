"use client";
/**
 * A roda de atributos do look (regra peça-recurso), no canto do palco: um radar de cinco eixos que muda na hora em que
 * a peça é vestida. Junto, o que a troca fez — "+20 Agilidade · −15 Furtividade" —, as ações que a peça destravou
 * (Correr, Esconder...) e um brilho atrás do avatar na cor do atributo que subiu. Nada passa na frente da zona da
 * roupa; com "reduzir movimento" ou efeitos desligados, nada pisca nem se move. Para o leitor de tela, uma frase.
 */
import type { CSSProperties } from "react";
import { cn } from "@/components/ui";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { LookDosRecursos } from "@/components/flair/nucleos/recursos/use-look-dos-recursos";
import { ATRIBUTOS, COR_DO_ATRIBUTO, type Atributo } from "@/lib/flair/recursos/types";

const RAIO = 40;
const CENTRO = 50;

/** O ponto de um eixo da roda (o primeiro aponta para cima, sentido horário). */
function ponto(i: number, valor: number): [number, number] {
  const a = -Math.PI / 2 + (2 * Math.PI * i) / ATRIBUTOS.length;
  const r = (RAIO * Math.max(0, Math.min(100, valor))) / 100;
  return [CENTRO + r * Math.cos(a), CENTRO + r * Math.sin(a)];
}

const contorno = (valores: number[]) => valores.map((v, i) => ponto(i, v).map((n) => n.toFixed(1)).join(",")).join(" ");

interface Props {
  recursos: LookDosRecursos;
  reduzido: boolean;
  efeitos: boolean;
}

export function NucleoRodaAtributos({ recursos, reduzido, efeitos }: Props) {
  const tx = useNucleoText();
  const { look, ultima } = recursos;
  if (look.pecas === 0) return null;
  const nome = (a: Atributo) => tx.t(`flair3d.ui.atributo.${a}`);
  const valores = ATRIBUTOS.map((a) => look.atributos[a]);
  const subiu = new Set(ultima?.mudancas.filter((m) => m.delta > 0).map((m) => m.atributo));
  const desceu = new Set(ultima?.mudancas.filter((m) => m.delta < 0).map((m) => m.atributo));
  const calmo = reduzido || !efeitos;
  const brilho = ultima?.emAlta ? ({ "--n3d-roda-cor": COR_DO_ATRIBUTO[ultima.emAlta] } as CSSProperties) : undefined;
  const frase = ATRIBUTOS.map((a) => `${nome(a)} ${look.atributos[a]}`).join(", ");
  return (
    <div className={cn("n3d-roda", calmo && "is-calm")} data-testid="nucleo-roda-atributos">
      {ultima?.emAlta && <span key={`brilho-${ultima.chave}`} className="n3d-roda-brilho" style={brilho} aria-hidden data-testid="nucleo-roda-brilho" />}
      <figure className="n3d-roda-quadro" aria-hidden>
        <svg viewBox="0 0 100 100" className="n3d-roda-svg">
          {[25, 50, 75, 100].map((n) => <polygon key={n} points={contorno(ATRIBUTOS.map(() => n))} className="n3d-roda-grade" />)}
          <polygon points={contorno(ATRIBUTOS.map(() => 50))} className="n3d-roda-neutro" />
          <polygon points={contorno(valores)} className="n3d-roda-look" />
          {ATRIBUTOS.map((a, i) => {
            const [x, y] = ponto(i, 118);
            return (
              <text key={a} x={x} y={y} className={cn("n3d-roda-eixo", subiu.has(a) && "is-up", desceu.has(a) && "is-down")}
                style={{ "--n3d-roda-cor": COR_DO_ATRIBUTO[a] } as CSSProperties} textAnchor="middle" dominantBaseline="middle" fontSize={9} data-atributo={a}>
                {tx.t(`flair3d.ui.atributo.curto.${a}`)}
              </text>
            );
          })}
        </svg>
        <figcaption className="n3d-roda-titulo">{tx.t("flair3d.ui.roda.titulo")}</figcaption>
      </figure>
      {ultima && ultima.mudancas.length > 0 && (
        <span key={`texto-${ultima.chave}`} className="n3d-roda-mudanca" aria-hidden data-testid="nucleo-roda-mudanca">
          {ultima.mudancas.map((m) => `${m.delta > 0 ? "+" : "−"}${Math.abs(m.delta)} ${nome(m.atributo)}`).join(" · ")}
        </span>
      )}
      {look.acoes.length > 0 && (
        <ul className="n3d-roda-acoes" aria-label={tx.t("flair3d.ui.roda.acoes")} data-testid="nucleo-roda-acoes">
          {look.acoes.map((a) => (
            <li key={a} className={cn("n3d-roda-acao", ultima?.acoes.includes(a) && "is-new")} data-acao={a}>{tx.t(`flair3d.ui.destrava.${a}`)}</li>
          ))}
        </ul>
      )}
      <p className="sr-only" role="status">
        {ultima ? tx.t("flair3d.ui.roda.status", { mudanca: ultima.mudancas.map((m) => `${m.delta > 0 ? "+" : "-"}${Math.abs(m.delta)} ${nome(m.atributo)}`).join(", "), look: frase }) : ""}
      </p>
    </div>
  );
}
