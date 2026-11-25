/**
 * Controle (Gamepad API, layout padrão: https://w3c.github.io/gamepad/#remapping) para a entrada de console. Botões
 * lidos por borda (só o instante em que foram apertados), analógicos com zona morta e direcional somado ao analógico
 * esquerdo. Puro.
 */
import { limitar, type AcaoEntrada, type FamiliaControle, type Vetor } from "@/lib/flair/entrada/acoes";

/** Botões do layout padrão: 0 cruz/A, 1 círculo/B, 2 quadrado/X, 3 triângulo/Y, 9 Start/Options. */
export const BOTOES: Partial<Record<number, AcaoEntrada>> = { 0: "INTERAGIR", 1: "CANCELAR", 2: "ACAO", 3: "INVENTARIO", 9: "PAUSAR" };
export const ZONA_MORTA = 0.2;

export interface PadLike {
  id?: string;
  mapping?: string;
  buttons: ReadonlyArray<{ pressed: boolean; value?: number }>;
  axes: ReadonlyArray<number>;
}

export interface LeituraDoControle {
  acoes: AcaoEntrada[];
  mover: Vetor;
  camera: Vetor;
  botoes: boolean[];
}

/** Um eixo sem a zona morta, reescalado para ir de 0 a 1 depois dela (sem salto na borda). */
export function semZonaMorta(v: number): number {
  const a = Math.abs(v);
  if (!Number.isFinite(v) || a <= ZONA_MORTA) return 0;
  return Math.sign(v) * Math.min(1, (a - ZONA_MORTA) / (1 - ZONA_MORTA));
}

/** O eixo y do analógico aponta para baixo; aqui y positivo é para a frente, como no teclado. */
function analogico(pad: PadLike, ix: number, iy: number): Vetor {
  return limitar({ x: semZonaMorta(pad.axes[ix] ?? 0), y: -semZonaMorta(pad.axes[iy] ?? 0) });
}

const apertado = (b?: { pressed: boolean; value?: number }) => !!b && (b.pressed || (b.value ?? 0) > 0.5);

export function lerControle(pad: PadLike, antes: readonly boolean[]): LeituraDoControle {
  const botoes = pad.buttons.map((b) => apertado(b));
  const acoes: AcaoEntrada[] = [];
  botoes.forEach((agora, i) => {
    const acao = BOTOES[i];
    if (acao && agora && !antes[i]) acoes.push(acao);
  });
  const esquerdo = analogico(pad, 0, 1);
  const direcional = { x: (botoes[15] ? 1 : 0) - (botoes[14] ? 1 : 0), y: (botoes[12] ? 1 : 0) - (botoes[13] ? 1 : 0) };
  const mover = limitar({ x: esquerdo.x + direcional.x, y: esquerdo.y + direcional.y });
  return { acoes, mover, camera: analogico(pad, 2, 3), botoes };
}

/**
 * A família do controle pelo id que o navegador informa: Sony (054c, DualShock, DualSense) mostra cruz, círculo,
 * quadrado e triângulo; Microsoft (045e, Xbox, XInput) mostra A, B, X e Y. Fora do layout padrão, genérico.
 */
export function familiaDoControle(pad: Pick<PadLike, "id" | "mapping">): FamiliaControle {
  const id = (pad.id ?? "").toLowerCase();
  if (pad.mapping !== undefined && pad.mapping !== "standard") return "GENERICO";
  if (/054c|dualshock|dualsense|playstation|wireless controller/.test(id)) return "PLAYSTATION";
  if (/045e|xbox|xinput/.test(id)) return "XBOX";
  return "GENERICO";
}
