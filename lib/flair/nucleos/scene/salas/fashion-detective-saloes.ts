/**
 * Fashion Detective: os salões 2 a 6 do caso (docs/flair/flair-3d/CORES_E_ACOES.md, 2.2). Todos dividem a planta do
 * salão 1 (passadeira até a porta dupla do fundo, as mesmas zonas e os mesmos convidados) e mudam os materiais, os
 * móveis das laterais e a luz, para cada salão ter o próprio lugar: salão principal, camarim, clube underground,
 * ateliê e arquivo.
 */
import { amostras, concreto, ladrilho, led, luz, madeira, madeiraEncerada, marmore, metalEscovado, metalPintado, reboco, tecido, tijolo, veludo } from "@/lib/flair/nucleos/scene/materials";
import { bancoEstofado, cadeira } from "@/lib/flair/nucleos/scene/moveis/assentos";
import { bancada, rolosDeTecido } from "@/lib/flair/nucleos/scene/moveis/atelie";
import { arara, vasoAlto } from "@/lib/flair/nucleos/scene/moveis/loja";
import { lustre, neon } from "@/lib/flair/nucleos/scene/moveis/palco";
import { luminariaDeTeto } from "@/lib/flair/nucleos/scene/moveis/set";
import { armarioFerramentas, caixote, tambor } from "@/lib/flair/nucleos/scene/moveis/urbano";
import { SALA_FASHION_DETECTIVE as ENTRADA } from "@/lib/flair/nucleos/scene/salas/fashion-detective";
import type { MaterialDesc, Movel, Sala } from "@/lib/flair/nucleos/scene/types";

/** O que todo salão tem: a passadeira, o portal, as duas folhas da porta do fundo e o cordão diante dela. */
const PLANTA = ENTRADA.moveis.filter((m) => m.tipo === "tapete" || m.tipo === "portal" || m.tipo === "folhaPorta" || m.id === "cordao");

interface Lugar {
  materiais: Record<string, MaterialDesc>;
  moveis: Movel[];
  /** cor da luz do lugar e do fundo */
  luz: string;
  fundo: string;
  ambiente: number;
}

function salao({ materiais, moveis, luz: cor, fundo, ambiente }: Lugar): Sala {
  return {
    ...ENTRADA,
    materiais,
    moveis: [...PLANTA, ...moveis],
    luzes: {
      ...ENTRADA.luzes,
      ambiente: { ...ENTRADA.luzes.ambiente, intensidade: ambiente },
      proprias: ENTRADA.luzes.proprias.map((l) => (l.id === "lustre" ? { ...l, cor } : l)),
    },
    fundo,
  };
}

const SALAO_PRINCIPAL = salao({
  materiais: {
    marmore: marmore("#C9B48A", "#7A6238"),
    parede: reboco("#B9A27C"),
    latao: metalEscovado("#D4AF5A", 0.22),
    veludo: veludo("#1E2A55", "#0C1230"),
    porta: madeiraEncerada("#3A2216", "#1E0F08"),
    luz: luz("#FFF0C8", 2.6),
    vaso: metalPintado("#2A2118"),
    folhas: tecido("#2F6B45", "#1E4A2E"),
  },
  moveis: [
    bancoEstofado({ pos: [-3.6, 0, -5.6], giro: 90 }, "veludo", "latao", 1.6),
    bancoEstofado({ pos: [3.6, 0, -5.6], giro: -90 }, "veludo", "latao", 1.6),
    vasoAlto({ pos: [-2.7, 0, -6.4] }, "vaso", "folhas"),
    vasoAlto({ pos: [2.7, 0, -6.4] }, "vaso", "folhas"),
    lustre({ pos: [-3, 4.2, -3] }, "latao", "luz", 0.6),
    lustre({ pos: [3, 4.2, -3] }, "latao", "luz", 0.6),
  ],
  luz: "#FFF0C8",
  fundo: "#D9C9A6",
  ambiente: 0.5,
});

const CAMARIM = salao({
  materiais: {
    marmore: madeira("#9A7450", "#5E4228"),
    parede: reboco("#E6DCD0"),
    latao: metalEscovado("#B9B4AA", 0.3),
    veludo: veludo("#7A2E4A", "#3A1022"),
    porta: madeiraEncerada("#5A3A26", "#2E1A0E"),
    luz: luz("#FFF4DE", 2.4),
    roupas: amostras(),
    estofado: tecido("#C9B7A2", "#8E7B66"),
  },
  moveis: [
    arara({ pos: [-3.4, 0, -5.8] }, "latao", "roupas", 1.6, 7),
    arara({ pos: [3.4, 0, -5.8] }, "latao", "roupas", 1.6, 5),
    cadeira({ pos: [-3.6, 0, -0.6], giro: 90 }, "estofado", "latao"),
    cadeira({ pos: [3.6, 0, -0.4], giro: -90 }, "estofado", "latao"),
    luminariaDeTeto({ pos: [-3, 5.2, -3] }, "latao", "luz", 2.4),
    luminariaDeTeto({ pos: [3, 5.2, -3] }, "latao", "luz", 2.4),
  ],
  luz: "#FFF4DE",
  fundo: "#EDE4D8",
  ambiente: 0.6,
});

const CLUBE_UNDERGROUND = salao({
  materiais: {
    marmore: concreto("#3A3A40", 0.6),
    parede: tijolo("#4A2E2A", "#1E1412"),
    latao: metalPintado("#17181C"),
    veludo: veludo("#2A0F3A", "#12061C"),
    porta: metalPintado("#2A2C33"),
    tubo: luz("#FF4FA3", 3),
    placa: led("#0B0F14", "#19C3E6", 0.9),
    madeira: madeira("#5A4636", "#33261C"),
  },
  moveis: [
    neon({ pos: [-3.2, 2.4, -6.8] }, "tubo", "latao", 1.8, 0.8, 3),
    neon({ pos: [3.2, 2.4, -6.8] }, "tubo", "placa", 1.8, 0.8, 4),
    caixote({ pos: [-3.8, 0, -5.6] }, "madeira", 0.8),
    caixote({ pos: [-3.1, 0, -6.2] }, "madeira", 0.6),
    tambor({ pos: [3.6, 0, -5.8] }, "latao"),
    tambor({ pos: [4.2, 0, -5.2] }, "latao"),
  ],
  luz: "#FF4FA3",
  fundo: "#15121A",
  ambiente: 0.28,
});

const ATELIE = salao({
  materiais: {
    marmore: madeira("#B8956A", "#7E6040"),
    parede: reboco("#F0EBE2"),
    latao: metalEscovado("#8E9097", 0.35),
    veludo: tecido("#C6275E", "#8E1A42"),
    porta: madeiraEncerada("#6A4A30", "#3A2616"),
    luz: luz("#FFFFFF", 2.4),
    amostras: amostras(),
    tecidoB: tecido("#1F7A76", "#145450"),
  },
  moveis: [
    bancada({ pos: [-3.5, 0, -3.4], giro: 90 }, "porta", "latao", "amostras", 2.4),
    rolosDeTecido({ pos: [-3.6, 0, -6.2] }, "veludo", "tecidoB", "latao"),
    arara({ pos: [3.5, 0, -5.8] }, "latao", "amostras", 1.6, 6),
    rolosDeTecido({ pos: [3.7, 0, -1] }, "tecidoB", "veludo", "latao"),
    luminariaDeTeto({ pos: [-3, 5.2, -3] }, "latao", "luz", 2.6),
    luminariaDeTeto({ pos: [3, 5.2, -3] }, "latao", "luz", 2.6),
  ],
  luz: "#FFFFFF",
  fundo: "#F2EEE6",
  ambiente: 0.65,
});

const ARQUIVO = salao({
  materiais: {
    marmore: ladrilho("#6E7468", "#4A4F47"),
    parede: reboco("#A8A698"),
    latao: metalEscovado("#7A7F86", 0.4),
    veludo: veludo("#2F4A3A", "#16261C"),
    porta: madeira("#4A3A2A", "#2A1F16"),
    luz: luz("#E8F0D8", 2),
    gaveteiro: metalPintado("#5E6B5A"),
    amostras: amostras(),
  },
  moveis: [
    armarioFerramentas({ pos: [-4.2, 0, -5.4], giro: 90 }, "gaveteiro", "latao", 1.6),
    armarioFerramentas({ pos: [-4.2, 0, -3.4], giro: 90 }, "gaveteiro", "latao", 1.6),
    armarioFerramentas({ pos: [4.2, 0, -5.4], giro: -90 }, "gaveteiro", "latao", 1.6),
    armarioFerramentas({ pos: [4.2, 0, -3.4], giro: -90 }, "gaveteiro", "latao", 1.6),
    bancada({ pos: [3.4, 0, -0.6], giro: -90 }, "porta", "latao", "amostras", 2),
    luminariaDeTeto({ pos: [0, 5.2, -4.4] }, "latao", "luz", 3),
  ],
  luz: "#E8F0D8",
  fundo: "#8E9086",
  ambiente: 0.4,
});

/** Os salões do caso pelo código que o servidor manda (o salão 1 é a sala do registro). */
export const SALOES_DO_DETETIVE: Record<string, Sala> = {
  ENTRADA_DA_GALA: ENTRADA,
  SALAO_PRINCIPAL,
  CAMARIM,
  CLUBE_UNDERGROUND,
  ATELIE,
  ARQUIVO,
};
