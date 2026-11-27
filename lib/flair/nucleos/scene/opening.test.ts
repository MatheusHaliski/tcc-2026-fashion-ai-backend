import { describe, expect, it } from "vitest";
import { NUCLEO_CODIGOS } from "@/lib/flair/nucleos/types";
import { Diretor, duracaoDaSequencia } from "@/lib/flair/nucleos/scene/director";
import { ABERTURA_S, ENTRADA_Z, cameraDaAbertura, sequenciaDeAbertura, temAbertura, tomadasDaAbertura, type Tomada } from "@/lib/flair/nucleos/scene/opening";
import { salaDe, VARIANTES } from "@/lib/flair/nucleos/scene/registry";
import { limiteDaCamera } from "@/lib/flair/nucleos/scene/zones";

/** Abertura animada de cada salão do Fashion Detective: o travelling da câmera e a entrada dos personagens. */
describe("abertura do salão", () => {
  const saloes = Object.values(VARIANTES.FASHION_DETECTIVE ?? {});
  const fim: Tomada = { pos: [0, 1.12, 4.2], alvo: [0, 1, 0] };

  it("todo jogo tem abertura: o avatar entra até a marca e cada papel recebe quem chega (critério da dona: o começo)", () => {
    for (const codigo of NUCLEO_CODIGOS) {
      expect(temAbertura(codigo), codigo).toBe(true);
      const seq = sequenciaDeAbertura(codigo)!;
      const entrada = seq.passos.find((p) => p.ator === "avatar" && p.clip === "CAMINHAR")!;
      expect(entrada.mover, codigo).toEqual({ z: 0 });
      expect(entrada.de!.z!, codigo).toBeLessThanOrEqual(salaDe(codigo).zonas.avatar.z[1]);
    }
    const passarela = sequenciaDeAbertura("PASSARELA")!;
    expect(passarela.passos.find((p) => p.ator === "fig:PLATEIA:*")?.clip).toBe("F_APLAUSO");
    expect(sequenciaDeAbertura("DRESS_FIGHTER")!.passos.find((p) => p.ator === "fig:OPONENTE:*")?.clip).toBe("F_GUARDA");
  });

  it("câmera: começa no plano aberto, passa pela lateral e termina exatamente no enquadramento do avatar", () => {
    expect(saloes).toHaveLength(6);
    for (const sala of saloes) {
      const [aberto, lateral] = tomadasDaAbertura(sala);
      expect(cameraDaAbertura(0, fim, sala)).toEqual(aberto);
      expect(cameraDaAbertura(ABERTURA_S * 0.55, fim, sala).pos[0]).toBeCloseTo(lateral.pos[0]);
      expect(cameraDaAbertura(ABERTURA_S, fim, sala)).toEqual(fim);
      expect(cameraDaAbertura(ABERTURA_S + 5, fim, sala)).toEqual(fim);
      // a câmera nunca sai da sala nem desce ao piso, e o plano aberto olha para a porta do fundo
      for (let t = 0; t <= ABERTURA_S; t += 0.25) {
        const { pos } = cameraDaAbertura(t, fim, sala);
        expect(pos[2]).toBeLessThanOrEqual(limiteDaCamera(sala) + 1e-9);
        expect(Math.abs(pos[0])).toBeLessThan(sala.dim.largura / 2);
        expect(pos[1]).toBeGreaterThan(1);
        expect(pos[1]).toBeLessThan(sala.dim.altura);
      }
      expect(aberto.alvo[2]).toBeLessThan(-5);
    }
  });

  it("personagens: o detetive entra andando de costas para a câmera, vira e posa; os outros reagem", () => {
    const seq = sequenciaDeAbertura("FASHION_DETECTIVE");
    if (!seq) throw new Error("sem abertura");
    expect(seq.passos.map((p) => `${p.ator}:${p.clip}`)).toEqual([
      "luz:lustre:L_ACENDE", "fig:CONVIDADO:*:F_ACENA", "fig:SEGURANCA:0:F_BARRA", "avatar:CAMINHAR", "avatar:MEIA_VOLTA", "avatar:POSE_1",
    ]);
    const d = new Diretor();
    d.tocar(seq, 100);
    const origem = { x: 0, z: 0, giro: 0 };
    const comeco = d.lugar("avatar", 100.05, origem);
    expect(comeco.z).toBeGreaterThan(ENTRADA_Z - 0.3);
    expect(comeco.giro).toBeCloseTo(180, 0);
    const final = d.lugar("avatar", 100 + duracaoDaSequencia(seq) + 0.1, origem);
    expect(final.z).toBeCloseTo(0);
    expect(final.giro).toBeCloseTo(0);
    // com "reduzir movimento" não há entrada: o detetive já está no lugar
    const parado = new Diretor();
    parado.tocar(seq, 100, true);
    expect(parado.lugar("avatar", 100.05, origem)).toEqual({ x: 0, z: 0, giro: 0 });
  });
});
