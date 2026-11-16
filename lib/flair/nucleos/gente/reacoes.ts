/**
 * As pessoas de cena seguem o diretor de cena (lib/flair/nucleos/scene/director.ts): o clipe de figurante que a
 * sequência do momento dá a um papel ("fig:PLATEIA:*" aplaude, "fig:CLIENTE:0" prova e gira, "fig:OPONENTE:0" dá a
 * guarda) vira um movimento do corpo humano (lib/avatar3d/human/locomotion.ts) e, quando a locomoção não tem o
 * gesto, um gesto por cima (gestos.ts). Fora das sequências, cada um volta ao movimento do papel (sentada, torcendo,
 * fotografando). Puro.
 */
import type { Motion } from "@/lib/avatar3d/human/locomotion-model";
import type { AtorDeCena } from "@/lib/flair/nucleos/gente/ator";
import type { Gesto } from "@/lib/flair/nucleos/gente/gestos";

export interface Reacao {
  /** o movimento do corpo; "base" = o movimento do papel (sentada continua sentada) */
  anim: Motion | "base";
  gesto?: Gesto;
  velocidade?: number;
  /** a perna do chute (0–1) */
  chute?: number;
}

export const REACAO_DO_CLIPE: Record<string, Reacao> = {
  F_APLAUSO: { anim: "base", gesto: "aplaudir" },
  F_COMEMORA: { anim: "cheer" },
  F_ACENA: { anim: "wave" },
  F_LAMENTA: { anim: "base", gesto: "lamentar" },
  F_GUARDA: { anim: "idle", gesto: "guarda" },
  F_SOCO: { anim: "melee" },
  F_DEFESA: { anim: "idle", gesto: "defender" },
  F_RECUO: { anim: "idle", gesto: "recuar" },
  F_ESQUIVA: { anim: "idle", gesto: "recuar" },
  F_QUEDA: { anim: "knockedOut" },
  F_CHUTAR: { anim: "idle", chute: 1 },
  F_CORRER: { anim: "run", velocidade: 3.2 },
  F_PROVA_E_GIRA: { anim: "change" },
  F_DEVOLVE: { anim: "interact" },
  F_BARRA: { anim: "guard" },
  F_POSE: { anim: "idle", gesto: "pensar" },
  F_LEVANTA_O_BRACO: { anim: "cheer" },
  F_REVELA: { anim: "wave" },
};

/** Quanto o ator precisa andar entre dois quadros para os pés andarem (m/s); abaixo disso, fica no lugar. */
const ANDANDO = 0.15;

export interface NoMomento {
  clip: string | null;
  /** quando o clipe começou (relógio da cena) */
  desde: number;
  x: number;
  z: number;
  /** giro do diretor, em graus */
  giro: number;
  /** quanto o ator andou desde o quadro anterior (m/s) */
  velocidade: number;
}

/** O ator de base (lugar e movimento do papel) no momento da cena: o clipe da sequência e o lugar do diretor. */
export function atorNoMomento(base: AtorDeCena, m: NoMomento): AtorDeCena {
  const r = m.clip ? REACAO_DO_CLIPE[m.clip] : undefined;
  // quem o diretor leva de um lugar a outro anda (ou corre), com o gesto do momento por cima: os pés não deslizam
  const corre = r?.anim === "run";
  const anda = !corre && m.velocidade > ANDANDO;
  const anim: Motion = corre ? "run" : anda ? "walk" : !r || r.anim === "base" ? base.anim : r.anim;
  return {
    ...base,
    x: m.x,
    z: m.z,
    giro: (m.giro * Math.PI) / 180,
    anim,
    velocidade: corre ? Math.max(m.velocidade, r?.velocidade ?? 0) : anda ? m.velocidade : r?.velocidade ?? base.velocidade,
    chute: anda ? undefined : r?.chute,
    naJogada: base.naJogada || !!r,
    gesto: r?.gesto,
    gestoDesde: m.desde,
  };
}
