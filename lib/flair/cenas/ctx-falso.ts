/**
 * Contexto 2D de mentira para os testes das cenas (o jsdom não desenha canvas): registra cada chamada de método com
 * os argumentos e aceita qualquer propriedade. Serve de `CriarTela` do pintor e de contexto da tela visível.
 */
import type { CriarTela, Tela } from "@/lib/flair/cenas/sprites";
import type { Ctx } from "@/lib/flair/cenas/tipos";

export interface Chamada {
  metodo: string;
  args: unknown[];
}

export interface CtxFalso {
  ctx: Ctx;
  chamadas: Chamada[];
  /** quantas vezes o método foi chamado */
  conta(metodo: string): number;
  limpar(): void;
}

export function criarCtxFalso(): CtxFalso {
  const chamadas: Chamada[] = [];
  const estado: Record<string, unknown> = {};
  const degrade = { addColorStop: () => {} };
  const ctx = new Proxy(estado, {
    get(alvo, nome: string) {
      if (nome in alvo) return alvo[nome];
      return (...args: unknown[]) => {
        chamadas.push({ metodo: nome, args });
        return nome.startsWith("create") ? degrade : undefined;
      };
    },
    set(alvo, nome: string, valor) {
      alvo[nome] = valor;
      return true;
    },
  }) as unknown as Ctx;
  return {
    ctx,
    chamadas,
    conta: (metodo) => chamadas.filter((c) => c.metodo === metodo).length,
    limpar: () => {
      chamadas.length = 0;
    },
  };
}

/** Fábrica de telas de mentira: cada tela tem o seu registrador; `telas` guarda todas, na ordem em que foram criadas. */
export function fabricaDeTelas(): { criar: CriarTela; telas: (Tela & { falso: CtxFalso })[] } {
  const telas: (Tela & { falso: CtxFalso })[] = [];
  const criar: CriarTela = (largura, altura) => {
    const falso = criarCtxFalso();
    const tela = { canvas: { width: largura, height: altura } as HTMLCanvasElement, ctx: falso.ctx, falso };
    telas.push(tela);
    return tela;
  };
  return { criar, telas };
}
