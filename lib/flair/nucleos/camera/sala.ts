/**
 * A câmera do jogo dentro da sala (lib/flair/nucleos/scene): os limites que as paredes dão à câmera, o zoom da tela
 * aplicado a qualquer câmera (aproxima e sobe a mira até o rosto) e o momento da partida visto pela câmera. Puro.
 */
import type { MomentoDaCamera } from "@/lib/flair/nucleos/camera/jogos";
import type { Assunto, Camera } from "@/lib/flair/nucleos/camera/rigs";
import type { Momento } from "@/lib/flair/nucleos/moments";
import type { Sala } from "@/lib/flair/nucleos/scene/types";
import { limiteDaCamera } from "@/lib/flair/nucleos/scene/zones";

/** Altura da mira com o zoom todo aproximado: o rosto. */
export const MIRA_NO_ROSTO = 1.58;
/** Distância mínima da câmera ao avatar com o zoom todo aproximado. */
export const DIST_MINIMA = 0.55;

/** As paredes e o teto da sala como limites da câmera; na frente vale também a distância máxima da sala. */
export function limitesDaSala(sala: Sala): NonNullable<Assunto["limites"]> {
  const meia = sala.dim.largura / 2;
  const frente = Math.min(sala.dim.frente, limiteDaCamera(sala) + 0.25);
  return { x: [-meia, meia], z: [-sala.dim.fundo, frente], teto: sala.cobertura === "ceu" ? Math.max(sala.dim.altura, 9) : sala.dim.altura };
}

/**
 * A câmera com o zoom da tela: cada passo aproxima um quinto da distância (até 0,55 m) e sobe a mira 12 cm (até o
 * rosto); a lente sobe junto, para o ângulo não mudar. Zoom negativo afasta.
 */
export function comZoom(c: Camera, zoom: number): Camera {
  if (!zoom) return c;
  const dist = Math.max(DIST_MINIMA, c.dist * (1 - 0.19 * zoom));
  const mira = c.mira ?? 1.1;
  const sobe = Math.max(0, Math.min(MIRA_NO_ROSTO, mira + Math.max(0, zoom) * 0.12) - mira);
  // de perto a lente desce até a altura da mira: a câmera alta (grua, diagonal) não fica olhando o topo da cabeça
  const perto = Math.max(0, Math.min(1, (c.dist - dist) / Math.max(0.01, c.dist - DIST_MINIMA)));
  const altura = c.altura + sobe + (mira + sobe - (c.altura + sobe)) * perto * 0.8;
  return { ...c, dist, mira: mira + sobe, altura, ate: c.ate != null && c.rig === "GRUA" ? c.ate + sobe : c.ate };
}

/** O momento da tela de jogo visto pela câmera: o deck e a preparação são o preparo. */
export function momentoDaCamera(momento: Momento): MomentoDaCamera {
  return momento === "ACAO" ? "ACAO" : momento === "RESULTADO" ? "RESULTADO" : "PREPARO";
}
