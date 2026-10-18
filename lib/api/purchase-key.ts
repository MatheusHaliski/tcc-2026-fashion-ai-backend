/*
 * Chave de compra (cabeçalho Idempotency-Key). Nasce na primeira tentativa de comprar um item e vale até a compra dar
 * certo ou o servidor recusar: se a resposta se perder (timeout, rede caiu) e a pessoa tentar de novo, o servidor
 * reconhece o mesmo pedido e devolve a compra já feita em vez de cobrar duas vezes.
 */
import { ApiError } from "@/lib/api/client";

function newKey(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes); else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export class PurchaseKeys {
  private current: { item: string; key: string } | null = null;

  /** A chave desta compra: a mesma em cada nova tentativa do mesmo item. */
  headers(item: string): Record<string, string> {
    if (this.current?.item !== item) this.current = { item, key: newKey() };
    return { "Idempotency-Key": this.current.key };
  }

  /**
   * Depois da resposta: compra feita ou recusada pelo servidor (saldo, estoque, nível) encerra a chave; falha de rede
   * ou erro 5xx mantém a mesma, para a próxima tentativa ser reconhecida como repetição.
   */
  settle(error?: unknown) {
    if (!error || (error instanceof ApiError && error.status < 500)) this.current = null;
  }
}
