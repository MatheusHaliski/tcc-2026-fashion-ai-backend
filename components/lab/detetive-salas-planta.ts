/**
 * A planta das nove salas do Fashion Detective para o laboratório (sem partida): os pontos, esconderijos, armários e
 * saídas de fai-application/.../flair3d/detetive/DetetiveSalas.java, que o servidor manda no retrato. As salas high poly
 * (scripts/blender3d_high/salas/detetive_*.py) põem as peças nos mesmos pontos.
 */
import type { LayoutDaSala, Retrato } from "@/lib/flair/detetive/types";

type P = [id: string, x: number, z: number, esconderijo?: boolean];

const PLANTA: Record<string, { pontos: P[]; armarios: [string, string][]; saidas: [string, string][] }> = {
  ENTRADA: { pontos: [["tapete", 0, 2.4], ["meio", 0, 0], ["recepcao", -3, 1.5], ["casacos", -3, -1.5], ["coluna", 3, 1.5, true], ["rua", 3, -1.5], ["portaSalao", 0, -2.2]],
    armarios: [["MESA_DA_RECEPCAO", "recepcao"], ["ARMARIO_DE_CASACOS", "casacos"]], saidas: [["portaSalao", "SALAO"], ["rua", "CLUBE"]] },
  SALAO: { pontos: [["portaEntrada", 0, 2.4], ["meio", 0, 0], ["mesas", -3, 1, true], ["palco", 3, 1], ["portaCamarim", 3, -1.8], ["portaSeguranca", -3, -1.8], ["portaEscritorio", 0, -2.4]],
    armarios: [], saidas: [["portaEntrada", "ENTRADA"], ["portaCamarim", "CAMARIM"], ["portaSeguranca", "SEGURANCA"], ["portaEscritorio", "ESCRITORIO"]] },
  SEGURANCA: { pontos: [["portaSalao", 0, 2.4], ["meio", 0, 0], ["painel", -3, -1], ["livro", 3, -1], ["arquivoMorto", -3, 1.5, true], ["monitores", 3, 1.5]],
    armarios: [["PAINEL_DE_CHAVES", "painel"], ["LIVRO_DE_PONTO", "livro"]], saidas: [["portaSalao", "SALAO"]] },
  CAMARIM: { pontos: [["portaSalao", 0, 2.4], ["meio", 0, 0], ["araras", -3, 1.5, true], ["penteadeira", 3, 1.5], ["kit", 3, -1.2], ["portaCorredor", -3, -1.5]],
    armarios: [["GAVETA_DA_PENTEADEIRA", "penteadeira"], ["KIT_DE_COSTURA", "kit"]], saidas: [["portaSalao", "SALAO"], ["portaCorredor", "ATELIE"]] },
  CLUBE: { pontos: [["rua", 0, 2.4], ["pista", 0, 0], ["bar", -3, 1.5], ["cabine", 3, 1.5], ["deposito", -3, -1.5, true], ["caixas", 3, -1.5], ["escada", 0, -2.4]],
    armarios: [["ARMARIO_DE_FERRAMENTAS", "caixas"]], saidas: [["rua", "ENTRADA"], ["escada", "ATELIE"]] },
  ATELIE: { pontos: [["escada", -3, 2], ["corredor", 3, 2], ["meio", 0, 0.5], ["mesaCorte", -3, -1, true], ["caixaChapeu", 3, -1], ["portaArquivo", -1.5, -2.5], ["portaPassarela", 1.5, -2.5]],
    armarios: [["CAIXA_DE_CHAPEU", "caixaChapeu"]], saidas: [["escada", "CLUBE"], ["corredor", "CAMARIM"], ["portaArquivo", "ARQUIVO"], ["portaPassarela", "PASSARELA"]] },
  ARQUIVO: { pontos: [["porta", 0, 2.4], ["corredor", 0, 0], ["estanteA", -3, 1, true], ["estanteB", 3, 1, true], ["cofre", -3, -1.5], ["mapoteca", 3, -1.5]],
    armarios: [["REGISTRO_DO_COFRE", "cofre"]], saidas: [["porta", "ATELIE"]] },
  ESCRITORIO: { pontos: [["porta", 0, 2.4], ["meio", 0, 0], ["mesa", 3, -1], ["trofeus", -3, -1, true], ["sofa", -3, 1.5], ["janela", 3, 1.5]],
    armarios: [["GAVETA_DA_MESA", "mesa"]], saidas: [["porta", "SALAO"]] },
  PASSARELA: { pontos: [["bastidor", 0, 2.4], ["passarela", 0, 0], ["palco", 0, -2.4]], armarios: [], saidas: [["bastidor", "ATELIE"]] },
};

export const SALAS_DO_DETETIVE = Object.keys(PLANTA);

export function layoutDoLab(sala: string): LayoutDaSala {
  const p = PLANTA[sala] ?? PLANTA.ENTRADA;
  return {
    pontos: p.pontos.map(([id, x, z, esconderijo]) => ({ id, x, z, esconderijo: !!esconderijo })),
    armarios: p.armarios.map(([id, ponto]) => ({ id, ponto, aberto: false })),
    saidas: p.saidas.map(([ponto, para], i) => ({ ponto, para, chave: null, aberta: i === 0, barrada: false })),
    vigias: [],
    enigma: null,
  };
}

/** Um retrato mínimo da sala (o suficiente para desenhar a sala 3D). */
export function retratoDoLab(sala: string): Retrato {
  const layout = layoutDoLab(sala);
  return {
    sala, ponto: layout.pontos[1]?.id ?? layout.pontos[0].id, escondido: false, vida: 3, tempo: 0, limite: 2700, pistas: [], totalDePistas: 12,
    chaves: [], visitadas: [sala], resolvidas: [], portasAbertas: [], cutscene: null, avisos: [], dica: false, tentativas: 0, final: null,
    mao: [], baralho: 0, alcance: 3.8, meiaAbertura: 30, passoMaximo: 3, layout, mapa: [],
  };
}
