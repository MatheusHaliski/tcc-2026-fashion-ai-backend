/**
 * Uma só batida de animação para todas as cenas da página: quem está visível se inscreve e recebe o mesmo instante do
 * relógio compartilhado a cada quadro. Sem inscritos, ou com a aba escondida, nada roda.
 */
import { agora } from "@/lib/flair/cenas/relogio";

type Ouvinte = (relogio: number) => void;

const ouvintes = new Set<Ouvinte>();
let pedido = 0;

function escondida(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function bater(): void {
  pedido = 0;
  if (!ouvintes.size || escondida()) return;
  const relogio = agora();
  for (const o of [...ouvintes]) o(relogio);
  marcar();
}

function marcar(): void {
  if (pedido || !ouvintes.size || escondida() || typeof requestAnimationFrame === "undefined") return;
  pedido = requestAnimationFrame(bater);
}

let ouvindoAba = false;

function ouvirAba(): void {
  if (ouvindoAba || typeof document === "undefined") return;
  ouvindoAba = true;
  document.addEventListener("visibilitychange", marcar);
}

/** Inscreve o ouvinte na batida; devolve a função que o tira. */
export function naBatida(ouvinte: Ouvinte): () => void {
  ouvirAba();
  ouvintes.add(ouvinte);
  marcar();
  return () => {
    ouvintes.delete(ouvinte);
    if (!ouvintes.size && pedido && typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(pedido);
      pedido = 0;
    }
  };
}

/** Quantas cenas estão animando agora (para os testes e a medição). */
export function inscritos(): number {
  return ouvintes.size;
}
