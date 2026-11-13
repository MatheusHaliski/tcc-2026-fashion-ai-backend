// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auraHype, cartasVestidas, COR_DO_NIVEL, entradaDaCarta, ENTRADA_MS, materialDoSom, pontua, seloDaCarta } from "@/lib/flair/nucleos/card-fx";
import { FX_PREFS_CHAVE, FX_PREFS_PADRAO, lerFxPrefs, salvarFxPrefs, tocarFx } from "@/lib/flair/nucleos/fx-sound";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";

/** Efeito de entrada da carta: o que pontua e o que não pontua, a Aura Hype, o som e as preferências (som e efeitos). */
const card = (over: Partial<FlairCollectionCard> = {}): FlairCollectionCard => ({
  id: "c1",
  originType: "PIECE",
  originId: "p1",
  season: "SPRING",
  tier: "OURO",
  ovr: 80,
  rare: false,
  position: "SUP",
  name: "Camisa verde",
  priceVerified: true,
  state: "AVAILABLE",
  tradeable: true,
  acquiredVia: "GENERATED",
  ...over,
});

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("efeito de entrada", () => {
  it("carta que pontua: clarão na cor do nível, o selo do efeito e o som do material", () => {
    const fx = entradaDaCarta(card(), "SUP", [{ codigo: "MARCA_BR", valor: 10 }]);
    expect(fx).toEqual({ cardId: "c1", vaga: "SUP", tier: "OURO", cor: "#E0B04D", pontua: true, selo: { codigo: "MARCA_BR", valor: 10 }, aura: false, som: "tecido" });
    expect(COR_DO_NIVEL).toEqual({ BRONZE: "#B07A52", PRATA: "#9DA3AA", OURO: "#E0B04D", ESPECIAL: "#7B4FD6" });
    expect(ENTRADA_MS).toBeLessThanOrEqual(1000);
  });

  it("carta que não pontua: sem selo e com o som abafado; sem resposta do servidor, nada se afirma", () => {
    expect(entradaDaCarta(card(), "SUP", [])).toMatchObject({ pontua: false, selo: null, som: "abafado" });
    expect(entradaDaCarta(card(), "SUP", [{ codigo: "ACESSO", valor: 0 }, { codigo: "DEFESA", valor: 0 }])).toMatchObject({ pontua: false, som: "abafado" });
    expect(entradaDaCarta(card(), "SUP", undefined)).toMatchObject({ pontua: null, selo: null, som: "tecido" });
    expect(pontua(undefined)).toBeNull();
    expect(pontua([{ codigo: "FAMILIA_AZUL", valor: "Azul" }])).toBe(true);
    expect(seloDaCarta([{ codigo: "VELOCIDADE", valor: -2 }, { codigo: "DEFESA", valor: 12 }])).toEqual({ codigo: "DEFESA", valor: 12 });
  });

  it("Aura Hype: carta rara ou com Hype alto; metal para joias e ferragens", () => {
    expect(auraHype(card({ hype: { HYP: 80 } }))).toBe(true);
    expect(auraHype(card({ hype: { HYP: 79 } }))).toBe(false);
    expect(auraHype(card({ rare: true }))).toBe(true);
    expect(entradaDaCarta(card({ rare: true }), "ACE", [{ codigo: "MARCA_BR", valor: 10 }]).aura).toBe(true);
    expect(materialDoSom(card({ name: "Colar de corrente", position: "ACE" }))).toBe("metal");
    expect(materialDoSom(card())).toBe("tecido");
  });

  it("só vestir ou trocar dá efeito de entrada; tirar, não", () => {
    expect(cartasVestidas({}, { SUP: "a" })).toEqual([{ vaga: "SUP", cardId: "a" }]);
    expect(cartasVestidas({ SUP: "a" }, { SUP: "b", INF: "c" })).toEqual([{ vaga: "SUP", cardId: "b" }, { vaga: "INF", cardId: "c" }]);
    expect(cartasVestidas({ SUP: "a", INF: "c" }, { INF: "c" })).toEqual([]);
  });
});

describe("som e preferências", () => {
  it("som desligado por padrão e efeitos ligados; a escolha fica no aparelho", () => {
    expect(lerFxPrefs()).toEqual(FX_PREFS_PADRAO);
    expect(FX_PREFS_PADRAO).toEqual({ som: false, efeitos: true });
    salvarFxPrefs({ som: true, efeitos: false });
    expect(lerFxPrefs()).toEqual({ som: true, efeitos: false });
    localStorage.setItem(FX_PREFS_CHAVE, "{quebrado");
    expect(lerFxPrefs()).toEqual(FX_PREFS_PADRAO);
  });

  it("mudo não abre o áudio; ligado, sintetiza com a Web Audio API (ruído para tecido, notas para metal e especial)", () => {
    const criados: string[] = [];
    const no = () => ({ connect: (x: unknown) => x, start: vi.fn(), stop: vi.fn(), buffer: null, type: "", frequency: { value: 0 }, Q: { value: 0 }, gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } });
    class FalsoAudio {
      state = "running";
      currentTime = 0;
      sampleRate = 8000;
      destination = {};
      createBuffer(_canais: number, tamanho: number) {
        criados.push("ruido");
        return { getChannelData: () => new Float32Array(tamanho) };
      }
      createBufferSource = no;
      createBiquadFilter = no;
      createGain = no;
      createOscillator() {
        criados.push("nota");
        return no();
      }
    }
    vi.stubGlobal("AudioContext", FalsoAudio);
    expect(tocarFx("tecido", false)).toBe(false);
    expect(criados).toEqual([]);
    expect(tocarFx("tecido", true)).toBe(true);
    expect(tocarFx("abafado", true)).toBe(true);
    expect(tocarFx("metal", true)).toBe(true);
    expect(tocarFx("especial", true)).toBe(true);
    expect(criados).toEqual(["ruido", "ruido", "nota", "nota", "nota", "nota", "nota"]);
  });
});
