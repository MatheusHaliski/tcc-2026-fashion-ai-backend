/**
 * Qualidade da cena 3D (auditoria dos jogos, mudança 7): a cena mede os próprios quadros e, quando a máquina não dá
 * conta (sem placa de vídeo a Passarela rodou a 0,2 quadro por segundo), desce de nível sozinha — menos pontos na tela,
 * sem sombra e menos corpos inteiros —, em vez de travar. Três níveis:
 *
 * - ALTA: tudo ligado (sombra de todos, os corpos inteiros do orçamento da cena, até 2 pontos por pixel).
 * - MEDIA: só a avatar e quem está na jogada fazem sombra, um corpo inteiro de figurante, 1 ponto por pixel.
 * - BAIXA: sem sombra, nenhum corpo inteiro de figurante (todos de corpo leve, que ainda reagem), 0,75 ponto por pixel.
 *
 * A cena só desce depois que a carga inicial passou e, na mesma partida, não volta a subir (não fica oscilando entre
 * dois níveis); a partida seguinte começa de novo no nível alto.
 * Puro: o tempo de cada quadro vem de quem chama.
 */
export type Qualidade = "ALTA" | "MEDIA" | "BAIXA";
export const QUALIDADES: readonly Qualidade[] = ["ALTA", "MEDIA", "BAIXA"];

export interface AjusteDaQualidade {
  /** teto de pontos de tela por pixel (o aparelho pode ter menos) */
  pontosPorPixel: number;
  /** a luz principal faz sombra */
  sombra: boolean;
  /** até que distância da câmera um figurante de corpo inteiro faz sombra (metros; 0 = nenhum) */
  sombraDeFiguranteAte: number;
  /** quantos corpos inteiros de figurante, no máximo, dos que o orçamento da cena permite */
  corposCheios: number;
}

export const AJUSTES: Record<Qualidade, AjusteDaQualidade> = {
  ALTA: { pontosPorPixel: 2, sombra: true, sombraDeFiguranteAte: 7, corposCheios: Infinity },
  MEDIA: { pontosPorPixel: 1, sombra: true, sombraDeFiguranteAte: 0, corposCheios: 1 },
  BAIXA: { pontosPorPixel: 0.75, sombra: false, sombraDeFiguranteAte: 0, corposCheios: 0 },
};

/** Abaixo disto (quadros por segundo) a cena desce um nível; abaixo de MUITO_LENTA, vai direto ao mais baixo. */
export const LENTA = 24;
export const MUITO_LENTA = 10;
/** A carga inicial (texturas, corpos montando) não conta: os primeiros segundos são ignorados. */
export const CARENCIA_S = 3;
/** Cada medida junta pelo menos este tempo e este número de quadros. */
export const JANELA_S = 1.5;
export const JANELA_QUADROS = 3;
/** Um quadro sozinho mais longo que isto já é uma medida (a máquina de 0,2 quadro por segundo não espera três). */
export const QUADRO_PERDIDO_S = 1;

export interface EstadoDaQualidade {
  nivel: Qualidade;
  /** tempo de cena já visto (segundos) */
  visto: number;
  /** a janela de medida em curso */
  tempo: number;
  quadros: number;
}

export const qualidadeInicial = (nivel: Qualidade = "ALTA"): EstadoDaQualidade => ({ nivel, visto: 0, tempo: 0, quadros: 0 });

const abaixo = (q: Qualidade): Qualidade => QUALIDADES[Math.min(QUALIDADES.length - 1, QUALIDADES.indexOf(q) + 1)];

/** O nível para onde a cena vai com esta medida de quadros por segundo. */
export function nivelPelaMedida(nivel: Qualidade, quadrosPorSegundo: number): Qualidade {
  if (quadrosPorSegundo < MUITO_LENTA) return "BAIXA";
  return quadrosPorSegundo < LENTA ? abaixo(nivel) : nivel;
}

/**
 * Um quadro que durou `dt` segundos: devolve o estado novo (o mesmo objeto, atualizado). Com a aba em segundo plano
 * o navegador para de pedir quadros; um `dt` de mais de 10 s é isso, não lentidão, e não conta.
 */
export function quadroMedido(e: EstadoDaQualidade, dt: number): EstadoDaQualidade {
  if (!(dt > 0) || dt > 10) return e;
  // o quadro que começou dentro da carência não conta, por mais longo que seja (a travada da carga inicial)
  const comecou = e.visto;
  e.visto += dt;
  if (comecou < CARENCIA_S) return e;
  e.tempo += dt;
  e.quadros += 1;
  const cheia = (e.tempo >= JANELA_S && e.quadros >= JANELA_QUADROS) || dt >= QUADRO_PERDIDO_S;
  if (!cheia) return e;
  e.nivel = nivelPelaMedida(e.nivel, e.quadros / e.tempo);
  e.tempo = 0;
  e.quadros = 0;
  return e;
}

/**
 * O nível de largada pelo nome do renderizador que o navegador informa: sem placa de vídeo (o desenho é feito pelo
 * processador: SwiftShader, llvmpipe) a cena já começa no nível baixo, sem montar corpo inteiro nenhum de figurante.
 */
export function qualidadeDeLargada(renderizador: string | null | undefined): Qualidade {
  return renderizador && /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderizador) ? "BAIXA" : "ALTA";
}

/** Os pontos de tela por pixel que a cena usa: o do aparelho, até o teto do nível. */
export function pontosPorPixel(nivel: Qualidade, doAparelho: number): number {
  return Math.min(Math.max(0.5, doAparelho || 1), AJUSTES[nivel].pontosPorPixel);
}
