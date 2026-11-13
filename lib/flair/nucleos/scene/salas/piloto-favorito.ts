/**
 * Sala 11, Meu Piloto Favorito: o ateliê com o box de corrida ao fundo — faixa quadriculada, pilhas de pneus,
 * armário de ferramentas e o capacete da equipe no suporte.
 */
import { borracha, espelhado, laca, ladrilho } from "@/lib/flair/nucleos/scene/materials";
import { faixaDeParede } from "@/lib/flair/nucleos/scene/moveis/set";
import { armarioFerramentas, capaceteNoSuporte, pilhaDePneus } from "@/lib/flair/nucleos/scene/moveis/urbano";
import { atelie } from "@/lib/flair/nucleos/scene/salas/atelie-base";

export const SALA_PILOTO_FAVORITO = atelie("PILOTO_FAVORITO", {
  materiais: {
    quadriculado: { ...ladrilho("#F4F4F4", "#111114"), repete: 0.5 },
    pneu: borracha("#17171A"),
    lacaAmarela: laca("#F2C230"),
    viseira: espelhado("#2E6B4A"),
  },
  moveis: [
    faixaDeParede({ pos: [0, 2.7, -5.97] }, "quadriculado", "metal", 8, 0.5),
    armarioFerramentas({ pos: [-1.6, 0, -5.5] }, "lacaAmarela", "metal", 1.6),
    armarioFerramentas({ pos: [0.2, 0, -5.5] }, "lacaAmarela", "metal", 1.6),
    pilhaDePneus({ pos: [2.4, 0, -5.3] }, "pneu", 4),
    pilhaDePneus({ pos: [3.1, 0, -5.0] }, "pneu", 3),
    pilhaDePneus({ pos: [3.5, 0, -4.2] }, "pneu", 2),
    capaceteNoSuporte({ pos: [3.0, 0, -1.4], giro: -40 }, "lacaAmarela", "viseira", "metal"),
  ],
  luzes: [{ id: "box", tipo: "ponto", cor: "#F2F6FF", intensidade: 24, pos: [0.5, 3.1, -4.4] }],
});
