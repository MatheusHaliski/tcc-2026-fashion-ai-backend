import { describe, expect, it } from "vitest";
import { areaDeAndar, passo, velocidadeDaAgilidade, type Area } from "@/lib/flair/nucleos/movimento/andar";
import { obstaculosDaSala } from "@/lib/flair/nucleos/camera/enquadramento";
import { SALAS } from "@/lib/flair/nucleos/scene/registry";

const AREA: Area = { x: [-2, 2], z: [-3, 2], caixas: [{ x: [0.5, 1.5], y: [0, 1], z: [-0.5, 0.5] }] };
const ORIGEM = { x: 0, z: 0, giro: 0 };

describe("andar livre pela sala", () => {
  it("a agilidade do look muda a velocidade: neutro anda 2,2 m/s, tênis corre, salto anda devagar", () => {
    expect(velocidadeDaAgilidade(50)).toBeCloseTo(2.2, 6);
    expect(velocidadeDaAgilidade(90)).toBeGreaterThan(velocidadeDaAgilidade(50));
    expect(velocidadeDaAgilidade(20)).toBeLessThan(velocidadeDaAgilidade(50));
    expect(velocidadeDaAgilidade(500)).toBe(velocidadeDaAgilidade(100));
  });

  it("W vai para o fundo e vira de costas; sem eixo, fica parada", () => {
    const p = passo(ORIGEM, { x: 0, y: 1 }, 0.1, 2, AREA);
    expect(p.z).toBeCloseTo(-0.2, 6);
    expect(Math.abs(p.giro)).toBeCloseTo(180, 6);
    expect(passo(ORIGEM, { x: 0, y: 0 }, 0.1, 2, AREA)).toBe(ORIGEM);
  });

  it("não atravessa móvel nem sai da área; bate e escorrega no outro eixo", () => {
    let p = ORIGEM;
    for (let i = 0; i < 40; i++) p = passo(p, { x: 1, y: 0 }, 0.05, 2, AREA);
    expect(p.x).toBeLessThan(0.5 - 0.2);
    let q = { x: 0, z: 1, giro: 0 };
    for (let i = 0; i < 40; i++) q = passo(q, { x: 0.7, y: -0.7 }, 0.05, 2, AREA);
    expect(q.x).toBeLessThanOrEqual(2);
    expect(q.z).toBeLessThanOrEqual(2);
  });

  it("na passarela anda só em cima dela; o lustre do teto não barra", () => {
    const sala = SALAS.PASSARELA;
    const area = areaDeAndar(sala, obstaculosDaSala(sala, 0));
    expect(area.x).toEqual(sala.zonas.avatar.x);
    expect(area.caixas.every((c) => c.y[0] < sala.zonas.avatar.altura + 1.6)).toBe(true);
  });

  it("na luta de rua anda só dentro do círculo, sem entrar no público", () => {
    const sala = SALAS.DRESS_FIGHTER;
    const area = areaDeAndar(sala, obstaculosDaSala(sala, 0));
    expect(area.x).toEqual([-0.9, 0.9]);
    expect(area.z).toEqual([-2.1, 2.1]);
  });
});
