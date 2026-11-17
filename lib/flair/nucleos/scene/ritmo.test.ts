import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

// a duração da sequência da cena é controlada pelo teste: aqui importa só a divisão pelos passos e os limites
const h = vi.hoisted(() => ({ segundos: 0 }));
vi.mock("@/lib/flair/nucleos/scene/sequences-auto", () => ({ sequenciaDoResultado: vi.fn(() => ({ id: "fake" })) }));
vi.mock("@/lib/flair/nucleos/scene/director", () => ({ duracaoDaSequencia: vi.fn(() => h.segundos) }));

import { PASSO_MS } from "@/lib/flair/nucleos/action-fx";
import { duracaoDaSequencia } from "@/lib/flair/nucleos/scene/director";
import { sequenciaDoResultado } from "@/lib/flair/nucleos/scene/sequences-auto";
import { PASSO_MAXIMO_MS, passoDaCena } from "./ritmo";

const RESULTADO = {} as NucleoResultado;

beforeEach(() => { h.segundos = 0; vi.mocked(duracaoDaSequencia).mockClear(); vi.mocked(sequenciaDoResultado).mockClear(); });

describe("FLAIR 3D — ritmo de cada passo da ação", () => {
  it("divide a duração da cena pelos passos, para a cena terminar junto com a ação", () => {
    h.segundos = 9;
    expect(passoDaCena("DRESS_FIGHTER" as never, RESULTADO, 3)).toBe(3000);
    expect(sequenciaDoResultado).toHaveBeenCalledWith("DRESS_FIGHTER", RESULTADO);
  });

  it("nunca fica abaixo do passo mínimo", () => {
    h.segundos = 1;
    expect(passoDaCena("DRESS_FIGHTER" as never, RESULTADO, 10)).toBe(PASSO_MS);
  });

  it("nunca passa de 4 segundos por passo", () => {
    h.segundos = 30;
    expect(passoDaCena("DRESS_FIGHTER" as never, RESULTADO, 2)).toBe(PASSO_MAXIMO_MS);
    expect(PASSO_MAXIMO_MS).toBe(4000);
  });

  it("arredonda para milissegundos inteiros", () => {
    h.segundos = 10;
    expect(passoDaCena("DRESS_FIGHTER" as never, RESULTADO, 3)).toBe(3333);
  });

  it("sem passos não há ritmo e a cena nem é consultada", () => {
    h.segundos = 9;
    expect(passoDaCena("DRESS_FIGHTER" as never, RESULTADO, 0)).toBeUndefined();
    expect(passoDaCena("DRESS_FIGHTER" as never, RESULTADO, -1)).toBeUndefined();
    expect(duracaoDaSequencia).not.toHaveBeenCalled();
  });
});
