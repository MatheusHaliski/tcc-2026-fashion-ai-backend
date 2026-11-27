/**
 * O que o corpo de cada um faz na demonstração, para a cena de gente (Elenco3D): a detetive anda, corre, mira, dispara,
 * golpeia, recarrega, recua ao levar golpe e cai quando é pega; o vigia anda na ronda, corre atrás, olha em volta,
 * golpeia, recua ferido, se encolhe atordoado pelo laquê e cai abatido (depois some). As animações são as do corpo do
 * avatar (lib/avatar3d/human: aim, shoot, melee, reload, knockedOut) e os gestos das pessoas de cena (recuar). Puro.
 */
import type { AtorDeCena } from "@/lib/flair/nucleos/gente/ator";
import { CORRER, ANDAR } from "@/lib/flair/detetive/demo/mundo";
import type { EstadoDaDemo, Jogador, Vigia } from "@/lib/flair/detetive/demo/tipos";

function corpoDaJogadora(j: Jogador, mirando: boolean, pega: boolean): Pick<AtorDeCena, "anim" | "velocidade" | "gesto"> {
  if (pega) return { anim: "knockedOut", velocidade: 0 };
  const g = j.gesto?.tipo;
  if (g === "RECUO") return { anim: "idle", velocidade: 0, gesto: "recuar" };
  if (g === "GOLPE") return { anim: "melee", velocidade: 0 };
  if ((g === "DISPARO" || g === "SPRAY") && (j.gesto?.t ?? 1) < 0.3) return { anim: "shoot", velocidade: 0 };
  if (g === "CURA") return { anim: "interact", velocidade: 0 };
  if (j.recarregando > 0) return { anim: "reload", velocidade: 0 };
  if (mirando) return { anim: "aim", velocidade: j.andando ? ANDAR * 0.5 : 0 };
  if (j.correndo) return { anim: "run", velocidade: CORRER };
  return j.andando ? { anim: "walk", velocidade: ANDAR } : { anim: "idle", velocidade: 0 };
}

function corpoDoVigia(v: Vigia): Pick<AtorDeCena, "anim" | "velocidade" | "gesto"> {
  switch (v.modo) {
    case "ABATIDO":
      return { anim: "knockedOut", velocidade: 0 };
    case "ATORDOADO":
      return { anim: "cower", velocidade: 0 };
    case "FERIDO":
      return { anim: "idle", velocidade: 0, gesto: "recuar" };
    case "ATACA":
      return { anim: "melee", velocidade: 0 };
    case "PERSEGUE":
      return { anim: "run", velocidade: 3.1 };
    case "PROCURA":
      return { anim: "look", velocidade: 0 };
    default:
      return { anim: "walk", velocidade: 1.2 };
  }
}

export function atoresDaDemo(e: EstadoDaDemo, mirando: boolean): AtorDeCena[] {
  const j = e.jogador;
  const out: AtorDeCena[] = [{ id: "jogadora", x: j.x, z: j.z, giro: j.giro, naJogada: true, gestoDesde: 0, ...corpoDaJogadora(j, mirando, e.fim === "PEGA") }];
  for (const v of e.vigias) {
    out.push({ id: v.id, x: v.x, z: v.z, giro: v.giro, oculto: v.sumiu, naJogada: true, gestoDesde: 0, ...corpoDoVigia(v) });
  }
  return out;
}
