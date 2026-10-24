/**
 * Configurações do Meu Quarto: o que vem do navegador é conferido campo a campo (inválido volta ao padrão), salvar e ler
 * dão o mesmo, armazenamento bloqueado não quebra; movimento reduzido e conforto contra enjoo viram corte seco e câmera
 * parada; qualidade e reflexo do espelho dão densidade de pixels, sombras e a textura do vidro.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM_SETTINGS, cameraOptionsOf, graphicsOf, loadRoomSettings, mirrorTextureOf, reducedMotionOf, sanitizeRoomSettings, saveRoomSettings } from "./room-settings";

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe("configurações do quarto", () => {
  it("lixo ou versão antiga: cada campo inválido volta ao padrão, os válidos ficam", () => {
    const s = sanitizeRoomSettings({ view: "teto-cama", fov: 300, sensitivity: "alta", walls: "baixas", kelvin: 3100, hud: "x", favorites: [{ position: [1, 2, 3], target: [0, 1, 0] }, { position: [1, 2] }], favorite: 2 });
    expect(s.view).toBe("teto-cama"); expect(s.walls).toBe("baixas");
    expect(s.fov).toBe(90);                                               // fora do intervalo: preso ao limite
    expect(s.sensitivity).toBe(DEFAULT_ROOM_SETTINGS.sensitivity); expect(s.kelvin).toBeNull(); expect(s.hud).toBe("completo");
    expect(s.favorites[0]).toEqual({ position: [1, 2, 3], target: [0, 1, 0] }); expect(s.favorites[1]).toBeNull();
    expect(s.favorite).toBeNull();                                        // a vista 2 está vazia: não fica em uso
    expect(sanitizeRoomSettings(null)).toEqual(DEFAULT_ROOM_SETTINGS);
    expect(sanitizeRoomSettings({ fov: null }).fov).toBeNull();          // automático
  });

  it("salvar e ler devolvem o mesmo; armazenamento que falha não quebra a página", () => {
    const store = memory(); const s = { ...DEFAULT_ROOM_SETTINGS, view: "planta" as const, period: "night" as const, comfort: true };
    saveRoomSettings(s, store);
    expect(loadRoomSettings(store)).toEqual(s);
    const broken = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("bloqueado"); } };
    expect(loadRoomSettings(broken)).toEqual(DEFAULT_ROOM_SETTINGS);
    expect(() => saveRoomSettings(s, broken)).not.toThrow();
  });

  it("movimento: a escolha vence; 'do sistema' segue o aparelho e o perfil", () => {
    expect(reducedMotionOf({ ...DEFAULT_ROOM_SETTINGS, motion: "sistema" }, false, true)).toBe(true);
    expect(reducedMotionOf({ ...DEFAULT_ROOM_SETTINGS, motion: "normal" }, true, true)).toBe(false);
    expect(reducedMotionOf({ ...DEFAULT_ROOM_SETTINGS, motion: "reduzido" }, false, false)).toBe(true);
  });

  it("câmera: sensibilidade 50% é a de sempre; reduzido ou conforto dão corte seco e câmera parada; conforto abre a lente", () => {
    const base = cameraOptionsOf(DEFAULT_ROOM_SETTINGS, false);
    expect(base).toMatchObject({ view: "livre", saved: null, fov: null, speed: 1, cut: false, still: false });
    expect(cameraOptionsOf({ ...DEFAULT_ROOM_SETTINGS, sensitivity: 100 }, false).speed).toBe(2);
    expect(cameraOptionsOf(DEFAULT_ROOM_SETTINGS, true)).toMatchObject({ cut: true, still: true });
    expect(cameraOptionsOf({ ...DEFAULT_ROOM_SETTINGS, comfort: true, fov: 55 }, false)).toMatchObject({ cut: true, still: true, fov: 70 });
    expect(cameraOptionsOf({ ...DEFAULT_ROOM_SETTINGS, transition: "corte" }, false).cut).toBe(true);
    const fav = { position: [1, 2, 3] as [number, number, number], target: [0, 1, 0] as [number, number, number] };
    const favorites = [null, fav, null, null, null];
    expect(cameraOptionsOf({ ...DEFAULT_ROOM_SETTINGS, favorites, favorite: 2 }, false).saved).toEqual(fav);
  });

  it("gráficos e espelho: leve tira as sombras; o reflexo automático é médio no toque; desligado não cria textura", () => {
    expect(graphicsOf("leve", false)).toMatchObject({ dpr: [1, 1], shadows: false });
    expect(graphicsOf("auto", true).dpr).toEqual([1, 1.5]); expect(graphicsOf("auto", false).dpr).toEqual([1, 2]);
    expect(mirrorTextureOf("auto", false)).toEqual({ width: 512, height: 1024 });
    expect(mirrorTextureOf("auto", true)).toEqual({ width: 256, height: 512 });
    expect(mirrorTextureOf("desligado", false)).toBeNull();
  });
});
