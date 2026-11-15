/**
 * Palco de uma cena numa tela: junta o pintor, o recorte em peças, a mola de cada peça e o floreio da arte completa.
 * A tela (components/flair/cenas) só diz o estado das peças e pede o quadro; o palco decide o que pintar.
 */
import { FORMAS } from "@/lib/flair/cenas/catalogo-formas";
import { preparar } from "@/lib/flair/cenas/motor";
import { alvoDaCelula, aproximar, assentada, comporPecas, PARADA, prepararRecortes, type EstadoDaCelula, type FolgaViva, type Recortes } from "@/lib/flair/cenas/pecas";
import { criarPintor } from "@/lib/flair/cenas/pintura";
import { brilhoDoFloreio, FLOREIO_S, tempoDaCena } from "@/lib/flair/cenas/relogio";
import type { CriarTela } from "@/lib/flair/cenas/sprites";
import type { Cena, Ctx } from "@/lib/flair/cenas/tipos";
import type { PecaEstado } from "@/lib/flair/elencos/board";

export interface Palco {
  largura: number;
  altura: number;
  /**
   * Estado das peças (null = a cena inteira, sem quebra-cabeça) e se a arte está completa. `parado` (movimento
   * reduzido) encaixa as peças sem animação e não dispara o floreio.
   */
  definir(pecas: PecaEstado[] | null, completa: boolean, relogio: number, parado: boolean): void;
  /** Pinta o quadro do instante do relógio (ou o quadro parado da cena). */
  pintar(ctx: Ctx, relogio: number, parado: boolean): void;
  /** Há peça em movimento ou floreio em curso (com a cena parada, ainda é preciso pintar até assentar)? */
  emMovimento(relogio: number): boolean;
}

/** De onde a peça nova entra: mais longe que a folga de "chegando", na mesma direção. */
function entrada(i: number): FolgaViva {
  const f = alvoDaCelula(i, "chegando");
  return { ...PARADA, dx: f.dx * 1.7, dy: f.dy * 1.7 - 6, giro: f.giro * 1.4 };
}

export function criarPalco(cena: Cena, criar: CriarTela, largura: number, aoCarregar: () => void = () => {}): Palco | null {
  const pintor = criarPintor(preparar(cena), FORMAS, criar, largura, aoCarregar);
  const quadro = pintor ? criar(pintor.largura, pintor.altura) : null;
  if (!pintor || !quadro) return null;
  let estados: EstadoDaCelula[] | null = null;
  let recortes: Recortes | null = null;
  let numero = -1;
  let folgas: FolgaViva[] = [];
  let completa = false;
  let floreio: number | null = null;
  let corte = 1;
  let ultimo = 0;

  function definir(pecas: PecaEstado[] | null, agoraCompleta: boolean, relogio: number, parado: boolean): void {
    let novos: EstadoDaCelula[] | null = null;
    if (pecas) {
      if (!recortes || !estados || numero !== pecas.length) {
        recortes = prepararRecortes(pecas.length);
        numero = pecas.length;
        estados = null;
      }
      novos = recortes.recortes.map((_, i) => (agoraCompleta ? "verde" : i < pecas.length ? pecas[i] : "moldura"));
      const antes = estados;
      folgas = novos.map((e, i) => {
        if (!antes || parado) return { ...PARADA, ...alvoDaCelula(i, e) };
        return antes[i] === "coberta" && e !== "coberta" ? entrada(i) : folgas[i];
      });
    }
    if (agoraCompleta && !completa && !parado) floreio = relogio;
    if (!agoraCompleta) floreio = null;
    if (parado || !agoraCompleta) corte = agoraCompleta ? 0 : 1;
    estados = novos;
    completa = agoraCompleta;
  }

  const soltas = () => !!estados && folgas.some((f, i) => !assentada(f, alvoDaCelula(i, estados![i])));

  function emMovimento(relogio: number): boolean {
    if (floreio != null && relogio - floreio < FLOREIO_S) return true;
    if (completa && corte > 0.01) return true;
    return soltas();
  }

  function pintar(ctx: Ctx, relogio: number, parado: boolean): void {
    const dt = Math.max(0, relogio - ultimo);
    ultimo = relogio;
    const t = parado ? cena.quadro : tempoDaCena(relogio, floreio);
    const brilho = parado || floreio == null ? 0 : brilhoDoFloreio(relogio - floreio);
    // a arte completa, com as linhas de corte apagadas e todas as peças no lugar, é a cena inteira: sem recorte
    if (!estados || !recortes || (completa && corte <= 0.01 && !soltas())) {
      pintor!.quadro(ctx, t, brilho);
      return;
    }
    pintor!.quadro(quadro!.ctx, t, brilho);
    folgas = folgas.map((f, i) => aproximar(f, alvoDaCelula(i, estados![i]), dt));
    if (completa) corte = Math.max(0, corte - dt / 0.9);
    comporPecas(ctx, quadro!.canvas, recortes, { estados, folgas, corte }, pintor!.largura);
  }

  return { largura: pintor.largura, altura: pintor.altura, definir, pintar, emMovimento };
}
