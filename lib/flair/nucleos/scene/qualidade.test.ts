/**
 * Qualidade da cena (auditoria dos jogos, mudança 7): a cena mede os quadros e desce de nível quando a máquina não dá
 * conta; fora do quadro ninguém monta corpo inteiro; figurante distante não faz sombra.
 */
import { describe, expect, it } from "vitest";
import { corposCheios, fazSombraDeLonge } from "@/lib/flair/nucleos/gente/detalhe";
import { corposCheiosDaCena, CORPOS_CHEIOS_DA_CENA } from "@/lib/flair/nucleos/scene/orcamento-da-cena";
import { AJUSTES, CARENCIA_S, nivelPelaMedida, pontosPorPixel, qualidadeDeLargada, qualidadeInicial, quadroMedido, QUALIDADES } from "@/lib/flair/nucleos/scene/qualidade";

/** Roda `segundos` de cena a `qps` quadros por segundo e devolve o nível em que ela termina. */
function rodar(qps: number, segundos: number, estado = qualidadeInicial()) {
  for (let t = 0; t < segundos; t += 1 / qps) quadroMedido(estado, 1 / qps);
  return estado.nivel;
}

describe("qualidade da cena", () => {
  it("cada nível corta mais: pontos por pixel, sombra e corpos inteiros", () => {
    expect(QUALIDADES).toEqual(["ALTA", "MEDIA", "BAIXA"]);
    expect(AJUSTES.ALTA).toMatchObject({ pontosPorPixel: 2, sombra: true });
    expect(AJUSTES.MEDIA).toMatchObject({ pontosPorPixel: 1, sombra: true, sombraDeFiguranteAte: 0, corposCheios: 1 });
    expect(AJUSTES.BAIXA).toMatchObject({ pontosPorPixel: 0.75, sombra: false, corposCheios: 0 });
    // na tela de 2 pontos por pixel, o nível baixo desenha 7 vezes menos pontos
    expect((pontosPorPixel("ALTA", 2) / pontosPorPixel("BAIXA", 2)) ** 2).toBeGreaterThan(7);
    expect(pontosPorPixel("ALTA", 1)).toBe(1);
    expect(pontosPorPixel("BAIXA", 3)).toBe(0.75);
  });

  it("a 60 quadros por segundo a cena fica no nível alto; abaixo de 24 desce um nível; abaixo de 10 vai ao mais baixo", () => {
    expect(rodar(60, 30)).toBe("ALTA");
    expect(rodar(30, 30)).toBe("ALTA");
    expect(nivelPelaMedida("ALTA", 20)).toBe("MEDIA");
    expect(nivelPelaMedida("MEDIA", 20)).toBe("BAIXA");
    expect(nivelPelaMedida("BAIXA", 20)).toBe("BAIXA");
    expect(nivelPelaMedida("ALTA", 5)).toBe("BAIXA");
    // a 18 quadros por segundo: uma medida leva a MEDIA, a seguinte (ainda lenta) leva a BAIXA
    const estado = qualidadeInicial();
    expect(rodar(18, CARENCIA_S + 1.7, estado)).toBe("MEDIA");
    expect(rodar(18, 2, estado)).toBe("BAIXA");
  });

  it("a carga inicial não conta, e a aba em segundo plano também não", () => {
    const estado = qualidadeInicial();
    // travadas de carga nos primeiros segundos (corpos montando)
    for (const dt of [0.9, 0.8, 0.9]) quadroMedido(estado, dt);
    expect(estado.nivel).toBe("ALTA");
    expect(rodar(60, 5, estado)).toBe("ALTA");
    // a aba voltou depois de um minuto parada
    quadroMedido(estado, 60);
    expect(estado.nivel).toBe("ALTA");
    expect(rodar(60, 3, estado)).toBe("ALTA");
  });

  it("a Passarela sem placa de vídeo (um quadro a cada 5 s): desce ao nível baixo no primeiro quadro depois da carga", () => {
    const estado = qualidadeInicial();
    quadroMedido(estado, 5);
    expect(estado.nivel).toBe("ALTA");
    quadroMedido(estado, 5);
    expect(estado.nivel).toBe("BAIXA");
    // e na mesma partida não sobe de volta, mesmo que os quadros melhorem (não oscila)
    expect(rodar(60, 20, estado)).toBe("BAIXA");
  });

  it("quando o navegador diz que desenha por software, a cena já larga no nível baixo", () => {
    expect(qualidadeDeLargada("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)")).toBe("BAIXA");
    expect(qualidadeDeLargada("llvmpipe (LLVM 15.0.7, 256 bits)")).toBe("BAIXA");
    expect(qualidadeDeLargada("ANGLE (Apple, Apple M2, OpenGL 4.1)")).toBe("ALTA");
    expect(qualidadeDeLargada(null)).toBe("ALTA");
  });

  it("os corpos inteiros de cada cena caem com a qualidade", () => {
    expect(corposCheiosDaCena("PASSARELA", "ALTA")).toBe(2);
    expect(corposCheiosDaCena("PASSARELA", "MEDIA")).toBe(1);
    expect(corposCheiosDaCena("PASSARELA", "BAIXA")).toBe(0);
    expect(corposCheiosDaCena("LABIRINTO", "ALTA")).toBe(0);
    // os jogos fora desta rodada seguem com o limite comum
    expect(CORPOS_CHEIOS_DA_CENA.ROAD_TO_GLORY).toBeUndefined();
    expect(corposCheiosDaCena("ROAD_TO_GLORY", "ALTA")).toBe(5);
  });
});

describe("carregamento adiado e sombra", () => {
  it("quem está fora do quadro não ganha corpo inteiro (não é montado nem carregado), a não ser que esteja na jogada", () => {
    const plateia = [
      { id: "perto-fora", distancia: 2, noQuadro: false },
      { id: "longe-dentro", distancia: 9, noQuadro: true },
      { id: "meio-dentro", distancia: 5, noQuadro: true },
      { id: "cliente", distancia: 12, noQuadro: false, naJogada: true },
    ];
    expect([...corposCheios(plateia, 2)].sort()).toEqual(["cliente", "meio-dentro"]);
    expect([...corposCheios(plateia, 3)].sort()).toEqual(["cliente", "longe-dentro", "meio-dentro"]);
    expect(corposCheios(plateia, 9).has("perto-fora")).toBe(false);
    // sem a informação do quadro, vale só a distância (como antes)
    expect(corposCheios([{ id: "a", distancia: 2 }, { id: "b", distancia: 9 }], 1).has("a")).toBe(true);
  });

  it("figurante distante não faz sombra; quem está na jogada faz; nas qualidades média e baixa, nenhum", () => {
    const ate = AJUSTES.ALTA.sombraDeFiguranteAte;
    expect(fazSombraDeLonge(3, false, ate)).toBe(true);
    expect(fazSombraDeLonge(9, false, ate)).toBe(false);
    expect(fazSombraDeLonge(9, true, ate)).toBe(true);
    expect(fazSombraDeLonge(1, true, AJUSTES.MEDIA.sombraDeFiguranteAte)).toBe(false);
    expect(fazSombraDeLonge(1, true, AJUSTES.BAIXA.sombraDeFiguranteAte)).toBe(false);
  });
});
