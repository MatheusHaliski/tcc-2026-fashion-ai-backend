import { describe, expect, it } from "vitest";
import { DESFILE_INICIO, marcasDoDesfile, noDesfile } from "@/lib/flair/nucleos/movimento/desfile";
import { areaDeAndar, RAIO_DO_CORPO } from "@/lib/flair/nucleos/movimento/andar";
import { obstaculosDaSala } from "@/lib/flair/nucleos/camera/enquadramento";
import { SALAS } from "@/lib/flair/nucleos/scene/registry";

describe("desfile jogável", () => {
  it("três marcas até a ponta, dentro do palco de cada jogo", () => {
    for (const codigo of ["PASSARELA", "DRESS_THE_STAR", "BATALHA_LOOKS"] as const) {
      const marcas = marcasDoDesfile(codigo, SALAS[codigo]);
      expect(marcas).toHaveLength(3);
      expect(marcas[2].ponta).toBe(true);
      expect(marcas[2].z).toBeLessThanOrEqual(SALAS[codigo].zonas.avatar.z[1]);
      expect(marcas[0].z).toBeLessThan(marcas[1].z);
    }
  });

  it("as marcas contam na ordem; pular a do meio não vale; na ponta a pose fica liberada", () => {
    const marcas = marcasDoDesfile("PASSARELA", SALAS.PASSARELA);
    let e = noDesfile(DESFILE_INICIO, { x: 0, z: marcas[2].z, giro: 0 }, marcas);
    expect(e.alcancadas).toBe(0);
    for (const m of marcas) e = noDesfile(e, { x: 0, z: m.z, giro: 0 }, marcas);
    expect(e).toEqual({ alcancadas: 3, naPonta: true });
    expect(noDesfile(e, { x: 0, z: 0, giro: 0 }, marcas)).toEqual({ alcancadas: 3, naPonta: false });
  });

  it("set, loja e caminho também têm percurso, dentro da área de andar de cada sala", () => {
    for (const codigo of ["LABIRINTO", "BOUTIQUE_3D", "PERSONAGEM_FILME", "AROUND_THE_WORLD", "ROAD_TO_GLORY"] as const) {
      const sala = SALAS[codigo];
      const area = areaDeAndar(sala, obstaculosDaSala(sala, 0));
      const marcas = marcasDoDesfile(codigo, sala);
      expect(marcas.length, codigo).toBeGreaterThan(1);
      for (const m of marcas) {
        expect(m.x >= area.x[0] && m.x <= area.x[1] && m.z >= area.z[0] && m.z <= area.z[1], `${codigo} ${m.x},${m.z}`).toBe(true);
        // o ponto não fica dentro de um móvel (com a folga do corpo)
        const dentroDeMovel = area.caixas.some((c) => m.x > c.x[0] - RAIO_DO_CORPO && m.x < c.x[1] + RAIO_DO_CORPO && m.z > c.z[0] - RAIO_DO_CORPO && m.z < c.z[1] + RAIO_DO_CORPO);
        expect(dentroDeMovel, `${codigo} ${m.x},${m.z}`).toBe(false);
      }
    }
  });

  it("no palco do Dress the Star a personagem não desce do palco", () => {
    const area = areaDeAndar(SALAS.DRESS_THE_STAR, []);
    expect(area.x).toEqual(SALAS.DRESS_THE_STAR.zonas.avatar.x);
  });
});
