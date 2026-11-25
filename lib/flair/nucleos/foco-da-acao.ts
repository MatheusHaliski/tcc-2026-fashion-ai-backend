/**
 * A ação da partida no controle (padrão de console): fora da preparação, o direcional e as setas passam o foco pelos
 * botões da faixa de baixo (jogar uma carta, seguir sem carta, ver o resultado), ✕ aperta o botão em foco e ○ aperta o
 * botão de seguir. Assim toda ação que antes só existia como clique tem comando. Opera no DOM que já está na tela.
 */
import type { Comando } from "@/lib/flair/nucleos/controls";

/** Os botões da ação, na ordem da tela; marcados com data-n3d-seguir os que seguem sem carta. */
const SELETOR = ".n3d-lower button:not(:disabled)";

function botoes(raiz: ParentNode): HTMLButtonElement[] {
  return Array.from(raiz.querySelectorAll<HTMLButtonElement>(SELETOR)).filter((b) => !b.closest("details:not([open])"));
}

/** Trata o comando na ação; devolve se ele foi usado. */
export function comandoNaAcao(c: Comando, raiz: ParentNode | null = typeof document === "undefined" ? null : document): boolean {
  if (!raiz) return false;
  const lista = botoes(raiz);
  if (lista.length === 0) return false;
  const atual = lista.indexOf(document.activeElement as HTMLButtonElement);
  if (c.acao === "NAVEGAR") {
    const passo = c.dir ?? 1;
    const proximo = atual < 0 ? (passo > 0 ? 0 : lista.length - 1) : (atual + passo + lista.length) % lista.length;
    lista[proximo].focus();
    return true;
  }
  if (c.acao === "VESTIR" || c.acao === "ENTREGAR") {
    (atual >= 0 ? lista[atual] : lista[0]).click();
    return true;
  }
  if (c.acao === "TIRAR") {
    const seguir = lista.find((b) => b.dataset.n3dSeguir !== undefined) ?? null;
    seguir?.click();
    return !!seguir;
  }
  return false;
}
