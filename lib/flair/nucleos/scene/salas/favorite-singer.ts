/** Sala 9, My Favorite Singer: o ateliê com o palco do cantor ao fundo, cortina roxa e a luz de palco da era. */
import { laca, luz, veludo } from "@/lib/flair/nucleos/scene/materials";
import { palcoPequeno } from "@/lib/flair/nucleos/scene/moveis/atelie";
import { atelie } from "@/lib/flair/nucleos/scene/salas/atelie-base";

export const SALA_FAVORITE_SINGER = atelie("FAVORITE_SINGER", {
  materiais: {
    palco: laca("#141018"),
    luzEra: luz("#FF4FD8", 2.6),
    cortinaEra: veludo("#3A1466", "#160628"),
  },
  parede: "cortinaEra",
  moveis: [palcoPequeno({ pos: [0, 0, -4.6] }, "palco", "metal", "luzEra", 5.4)],
  luzes: [
    { id: "era", tipo: "ponto", cor: "#FF4FD8", intensidade: 30, pos: [0, 2.9, -3.8] },
    { id: "era2", tipo: "ponto", cor: "#7A5CFF", intensidade: 16, pos: [-2.2, 2.4, -4.2] },
  ],
  ambiente: { ceu: "#E9D8FF", chao: "#6B4A7A", intensidade: 0.55 },
});
