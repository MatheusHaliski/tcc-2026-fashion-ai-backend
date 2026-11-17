import { describe, expect, it } from "vitest";
import { corpoDoAcionamento } from "./acionamento";

describe("FLAIR 3D — corpo do acionamento na janela da ação", () => {
  it("sem nada escolhido, a pessoa só segue (corpo vazio)", () => {
    expect(corpoDoAcionamento({})).toEqual({});
  });

  it("só a carta Especial vira { carta }", () => {
    expect(corpoDoAcionamento({ cardId: "c1" })).toEqual({ carta: "c1" });
  });

  it("carta com vaga vira a troca, mesmo com alvo", () => {
    expect(corpoDoAcionamento({ cardId: "c1", vaga: "TOP" })).toEqual({ troca: { vaga: "TOP", carta: "c1" } });
    expect(corpoDoAcionamento({ cardId: "c1", vaga: "TOP", alvo: "suspeito-2" })).toEqual({ troca: { vaga: "TOP", carta: "c1" } });
  });

  it("vaga sem carta não é troca: vale a ação seguinte", () => {
    expect(corpoDoAcionamento({ vaga: "TOP" })).toEqual({});
    expect(corpoDoAcionamento({ vaga: "TOP", alvo: "suspeito-1" })).toEqual({ alvo: "suspeito-1" });
  });

  it("Fashion Detective: o alvo do passo vai sozinho ou com a carta", () => {
    expect(corpoDoAcionamento({ alvo: "suspeito-1" })).toEqual({ alvo: "suspeito-1" });
    expect(corpoDoAcionamento({ cardId: "c9", alvo: "suspeito-1" })).toEqual({ carta: "c9", alvo: "suspeito-1" });
  });

  it("textos vazios contam como não escolhidos", () => {
    expect(corpoDoAcionamento({ cardId: "", vaga: "", alvo: "" })).toEqual({});
  });
});
