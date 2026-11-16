/**
 * Gestos das pessoas de cena que a locomoção do avatar não tem (aplaudir, lamentar de cabeça baixa, a guarda e a defesa da luta,
 * recuar e pensar), desenhados depois do movimento do corpo com a mesma cinemática dele
 * (lib/avatar3d/human/locomotion-kinematics.ts): só os braços, o tronco e a cabeça mudam; as pernas seguem o movimento
 * de base (sentada, de pé, andando). Com "reduzir movimento" o gesto fica parado no meio (t fixo). Sem violência: a
 * guarda e a defesa são posturas de dança-luta, sem arma.
 */
import * as THREE from "three";
import type { Rig } from "@/lib/avatar3d/human/locomotion-model";
import { arm, chest, curl, handTo, headPt, lean, twist } from "@/lib/avatar3d/human/locomotion-kinematics";
import { D } from "@/lib/avatar3d/human/locomotion-math";

export type Gesto = "aplaudir" | "lamentar" | "guarda" | "defender" | "recuar" | "pensar";

const A = new THREE.Vector3();
const B = new THREE.Vector3();

/** As duas mãos fechadas à frente do rosto, cotovelos para baixo. */
function guarda(r: Rig, alta: number) {
  headPt(r, 0.09, -0.14 + alta, 0.3, A);
  arm(r, 0, A, 0.7, -1, -0.2);
  handTo(r, 0, -0.2, 1, 0.2, 0, 0, -1);
  curl(r, 0, 0.9);
  headPt(r, -0.09, -0.14 + alta, 0.3, B);
  arm(r, 1, B, -0.7, -1, -0.2);
  handTo(r, 1, 0.2, 1, 0.2, 0, 0, -1);
  curl(r, 1, 0.9);
}

/** Aplica o gesto no esqueleto já animado. `t`: segundos desde o começo do gesto; `semente`: desencontra a plateia. */
export function aplicarGesto(r: Rig, gesto: Gesto, t: number, semente: number): void {
  switch (gesto) {
    case "aplaudir": {
      // as palmas se encontram à frente do peito umas duas vezes por segundo
      const abre = 0.5 + 0.5 * Math.sin((t + semente * 0.37) * 13);
      const x = 0.015 + 0.075 * abre;
      chest(r, x, -0.1, 0.3, A);
      arm(r, 0, A, 0.6, -1, -0.5);
      handTo(r, 0, -0.15, 0.6, 0.8, -1, 0, 0);
      chest(r, -x, -0.1, 0.3, B);
      arm(r, 1, B, -0.6, -1, -0.5);
      handTo(r, 1, 0.15, 0.6, 0.8, 1, 0, 0);
      lean(r, r.k.Head, -4 * D);
      return;
    }
    case "lamentar": {
      // a cabeça cai e balança devagar, os ombros vêm para a frente; os braços ficam soltos (sem levantar o paletó)
      lean(r, r.k.Spine2, 12 * D);
      lean(r, r.k.Neck, 18 * D);
      lean(r, r.k.Head, 22 * D);
      twist(r, r.k.Head, 9 * D * Math.sin((t + semente * 0.21) * 2.2));
      return;
    }
    case "guarda":
      guarda(r, 0);
      return;
    case "defender":
      guarda(r, 0.1);
      lean(r, r.k.Spine2, 8 * D);
      lean(r, r.k.Head, 10 * D);
      return;
    case "recuar":
      guarda(r, -0.04);
      lean(r, r.k.Spine, -12 * D);
      lean(r, r.k.Head, -8 * D);
      return;
    case "pensar": {
      // a mão no queixo, a outra cruzada sob o cotovelo
      headPt(r, -0.02, -0.08, 0.12, A);
      arm(r, 1, A, -0.6, -1, -0.2);
      handTo(r, 1, 0.3, 0.9, 0.1, 0, 0, -1);
      curl(r, 1, 0.6);
      chest(r, -0.06, -0.24, 0.2, B);
      arm(r, 0, B, 0.6, -1, -0.3);
      handTo(r, 0, -1, 0, 0.2, 0, 1, 0);
      curl(r, 0, 0.3);
      lean(r, r.k.Head, 6 * D);
      return;
    }
  }
}
