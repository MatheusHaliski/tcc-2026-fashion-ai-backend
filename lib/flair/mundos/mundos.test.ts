import { describe, expect, it } from "vitest";
import { conferirMundo, distanciaDoPrincipal, type Mundo } from "@/lib/flair/mundos/mundo";
import { JARDIM_DOS_ESPELHOS, MUNDOS, ORLA_DO_MIRANTE } from "@/lib/flair/mundos/mundos";

describe("mundos exploráveis (MUNDOS.md): marcos, luz guia, laços, camadas e recompensa fora do caminho", () => {
  it("a Orla do Mirante e o Jardim dos Espelhos seguem os princípios", () => {
    expect(conferirMundo(ORLA_DO_MIRANTE)).toEqual([]);
    expect(conferirMundo(JARDIM_DOS_ESPELHOS)).toEqual([]);
    expect(Object.keys(MUNDOS)).toEqual(["AROUND_THE_WORLD", "LABIRINTO"]);
    expect(distanciaDoPrincipal(ORLA_DO_MIRANTE, "atelie_do_beco")).toBe(2);
    expect(distanciaDoPrincipal(JARDIM_DOS_ESPELHOS, "banco_esquecido")).toBe(4);
  });

  it("a conferência acusa o que quebra cada princípio", () => {
    const linha: Mundo = {
      id: "LINHA",
      pontos: [{ id: "a", x: 0, z: 0, camada: 0 }, { id: "b", x: 1, z: 0, camada: 1, tipo: "recompensa" }],
      ligacoes: [["a", "b"]],
      principal: ["a", "b"],
    };
    expect(conferirMundo(linha)).toEqual(expect.arrayContaining(["sem laço: todo caminho é ida e volta", "recompensa no caminho principal: b", "sem marco", "camadas sem escada: a-b", "sem luz guia: a"]));
  });
});
