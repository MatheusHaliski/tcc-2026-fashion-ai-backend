import { describe, expect, it } from "vitest";
import { obstaculosDaSala } from "@/lib/flair/nucleos/camera/enquadramento";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import { areaDeAndar, RAIO_DO_CORPO } from "@/lib/flair/nucleos/movimento/andar";
import { ALCANCE, marcasDoDesfile } from "@/lib/flair/nucleos/movimento/desfile";
import { FASES_DE_USO, SALA_DE_USO, salaDaFaseDeUso } from "@/lib/flair/nucleos/movimento/fase-de-uso";
import { estourosDoOrcamento, figurantesDaCena, orcamentoDaSala, partesDaSala } from "@/lib/flair/nucleos/scene/budget";
import { SALAS, salaDe } from "@/lib/flair/nucleos/scene/registry";
import { SALAS_DE_USO } from "@/lib/flair/nucleos/scene/salas/fase-de-uso";
import { limiteDaCamera, movelNaZona, partesQueCobremRoupa, personagemNaZona, zonaContem, zonaInvadeRoupa } from "@/lib/flair/nucleos/scene/zones";
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";

const JOGOS = Object.keys(FASES_DE_USO) as NucleoCodigo[];
const res = (status: string, eventos: { codigo: string; valor: unknown }[]) => ({ status, eventos, pontos: 0, estrelas: 0, resultado: status, regras: [], cartas: [] }) as unknown as NucleoResultado;
const PEDIDO = { codigo: "EXECUCAO_PEDIDA", valor: { botoes: ["VESTIR"], janelaMs: 1000, recurso: "ENERGIA", reserva: 50, dreno: 15 } };
const NOTA = { codigo: "EXECUCAO", valor: { marcas: ["PERFEITO"], pontos: 2, restante: 50 } };

describe("fase de uso dos jogos de zonas", () => {
  it("os quatro jogos de zonas têm o lugar de uso, que não é o ateliê", () => {
    expect(JOGOS.sort()).toEqual(["CLUBE_CORACAO", "FAVORITE_SINGER", "PILOTO_FAVORITO", "SUPER_HEROI"]);
    for (const codigo of JOGOS) {
      const sala = salaDe(codigo, SALA_DE_USO);
      expect(sala, codigo).toBe(SALAS_DE_USO[codigo]);
      expect(sala).not.toBe(SALAS[codigo]);
      expect(sala.codigo).toBe(codigo);
      // o piso inteiro é da personagem (no ateliê ela fica presa ao tablado)
      expect(sala.zonas.avatar.altura).toBe(0);
      expect(sala.zonas.avatar.x[1] - sala.zonas.avatar.x[0]).toBeGreaterThan(8);
      // o manequim com a peça ficou no ateliê
      expect(figurantesDaCena(sala, NUCLEOS[codigo].personagens).some((p) => p.papel === "MANEQUIM")).toBe(false);
    }
    expect(salaDe("PASSARELA", SALA_DE_USO)).toBe(SALAS.PASSARELA);
  });

  it("cada lugar segue as regras das salas: zonas, móveis no lugar, materiais com uso, orçamento e as luzes do ateliê", () => {
    for (const codigo of JOGOS) {
      const sala = salaDe(codigo, SALA_DE_USO);
      const ate = limiteDaCamera(sala);
      expect(sala.dim.frente).toBeGreaterThan(ate);
      expect(zonaContem(sala.zonas.avatar, 0, 0)).toBe(true);
      for (const z of [...sala.zonas.personagens, ...sala.zonas.decoracao]) expect(zonaInvadeRoupa(z, ate), `${codigo} ${JSON.stringify(z)}`).toBe(false);
      expect(sala.moveis.some((m) => m.zona === "avatar"), codigo).toBe(true);
      for (const m of sala.moveis) {
        expect(movelNaZona(sala, m), `${codigo}: ${m.tipo} em ${m.pos}`).toBe(true);
        if (m.zona !== "avatar") expect(partesQueCobremRoupa(m, ate), `${codigo}: ${m.tipo}`).toBe(0);
      }
      for (const p of figurantesDaCena(sala, NUCLEOS[codigo].personagens)) expect(personagemNaZona(sala, p), `${codigo}: ${p.papel} em ${p.pos}`).toBe(true);
      const usados = new Set(partesDaSala(sala).map((p) => p.mat));
      for (const id of usados) expect(sala.materiais[id], `${codigo}: material ${id}`).toBeDefined();
      for (const id of Object.keys(sala.materiais)) expect(usados.has(id), `${codigo}: ${id} sem uso`).toBe(true);
      expect(sala.materiais[sala.casca.piso].px).toBeGreaterThan(0);
      expect(estourosDoOrcamento(orcamentoDaSala(sala, NUCLEOS[codigo].personagens)), codigo).toEqual([]);
      // as sequências do resultado acendem as luzes pelo id: as do ateliê do jogo continuam no lugar de uso
      expect(sala.luzes.proprias.map((l) => l.id)).toEqual(SALAS[codigo].luzes.proprias.map((l) => l.id));
    }
  });

  it("cinco marcas espalhadas pelo lugar, todas alcançáveis e longe umas das outras", () => {
    for (const codigo of JOGOS) {
      const sala = salaDe(codigo, SALA_DE_USO);
      const area = areaDeAndar(sala, obstaculosDaSala(sala, 0));
      const marcas = marcasDoDesfile(codigo, sala);
      expect(marcas, codigo).toHaveLength(5);
      expect(marcas[4].ponta).toBe(true);
      let anterior = { x: 0, z: 0 };
      let caminho = 0;
      for (const m of marcas) {
        expect(m.x >= area.x[0] && m.x <= area.x[1] && m.z >= area.z[0] && m.z <= area.z[1], `${codigo} ${m.x},${m.z}`).toBe(true);
        const dentroDeMovel = area.caixas.some((c) => m.x > c.x[0] - RAIO_DO_CORPO && m.x < c.x[1] + RAIO_DO_CORPO && m.z > c.z[0] - RAIO_DO_CORPO && m.z < c.z[1] + RAIO_DO_CORPO);
        expect(dentroDeMovel, `${codigo} ${m.x},${m.z}`).toBe(false);
        // nenhuma marca conta parada na anterior: é preciso andar
        const trecho = Math.hypot(m.x - anterior.x, m.z - anterior.z);
        expect(trecho, `${codigo} ${m.x},${m.z}`).toBeGreaterThan(2 * ALCANCE);
        caminho += trecho;
        anterior = m;
      }
      // o percurso atravessa o lugar: mais de 10 m (no ateliê eram menos de 2)
      expect(caminho, codigo).toBeGreaterThan(10);
    }
  });

  it("no ateliê (a peça que não saiu de lá) continuam as três marcas do tablado", () => {
    for (const codigo of JOGOS) expect(marcasDoDesfile(codigo, SALAS[codigo]), codigo).toHaveLength(3);
  });

  it("a cena vai ao lugar de uso quando a execução é pedida e fica lá no resultado só se a fase foi jogada", () => {
    expect(salaDaFaseDeUso("PILOTO_FAVORITO", "PREPARACAO", null)).toBeNull();
    expect(salaDaFaseDeUso("PILOTO_FAVORITO", "ACAO", res("EM_ACAO", [PEDIDO]))).toBe(SALA_DE_USO);
    expect(salaDaFaseDeUso("PILOTO_FAVORITO", "ACAO", res("ENTREGUE", [PEDIDO, NOTA]))).toBe(SALA_DE_USO);
    expect(salaDaFaseDeUso("PILOTO_FAVORITO", "RESULTADO", res("ENTREGUE", [PEDIDO, NOTA]))).toBe(SALA_DE_USO);
    // sem tinta, a peça não saiu do ateliê
    expect(salaDaFaseDeUso("PILOTO_FAVORITO", "ACAO", res("ENTREGUE", []))).toBeNull();
    expect(salaDaFaseDeUso("PILOTO_FAVORITO", "RESULTADO", res("ENTREGUE", []))).toBeNull();
    expect(salaDaFaseDeUso("PASSARELA", "ACAO", res("EM_ACAO", [PEDIDO]))).toBeNull();
  });
});
