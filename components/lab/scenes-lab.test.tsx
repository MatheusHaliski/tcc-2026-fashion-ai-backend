// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

// as três cenas 3D chegam por next/dynamic, nesta ordem: provador, rua de lojas, palco
const scenes = vi.hoisted(() => ({ order: ["fitting", "store", "stage"], n: 0, props: {} as Record<string, Record<string, unknown>> }));
vi.mock("next/dynamic", () => ({
  default: () => {
    const name = scenes.order[scenes.n++ % 3];
    return function Scene(props: Record<string, unknown>): ReactNode { scenes.props[name] = props; return <div data-testid={name} />; };
  },
}));
const fit = vi.hoisted(() => ({ setFitMode: vi.fn() }));
vi.mock("@/lib/avatar3d/human/garment-fit", () => fit);
const three = vi.hoisted(() => ({ loadTexture: vi.fn() }));
vi.mock("@/components/three/common", () => three);
const garments = vi.hoisted(() => ({
  photoInfo: vi.fn(() => ({ collarRow: 4, neckDrop: 0.2 })), fabricColor: vi.fn(() => "#ff0000"),
  garmentTexture: vi.fn(() => ({ image: { toDataURL: () => "data:tex" } })), ribColor: vi.fn(() => "#00ff00"), trimColors: vi.fn(() => ["#0000ff"]),
}));
vi.mock("@/lib/avatar3d/human/garments", () => garments);
const photo = vi.hoisted(() => ({ prepareOutfitPhoto: vi.fn(), fabricTile: vi.fn(() => ({ w: 8 })), prepareGarmentPhoto: vi.fn(), canUseOutfitPhoto: vi.fn(() => true) }));
vi.mock("@/lib/avatar3d/human/garment-photo", () => photo);
const person = vi.hoisted(() => ({ stripPerson: vi.fn() }));
vi.mock("@/lib/pieces/person-filter", () => person);
const body = vi.hoisted(() => ({ detectBody: vi.fn() }));
vi.mock("@/lib/avatar3d/body-detect", () => body);
const pipeline = vi.hoisted(() => ({ loadOriented: vi.fn(async () => ({})) }));
vi.mock("@/lib/avatar3d/pipeline", () => pipeline);

import ScenesLab, { LAB_LOOK } from "./scenes-lab";
import { I18nProvider } from "@/lib/i18n/i18n";

// o laboratório usa o i18n desde a tradução das legendas (sem o provedor, useI18n lança)
const Lang = ({ children }: { children: ReactNode }) => <I18nProvider initial="pt-BR">{children}</I18nProvider>;

type Lab = { set: (p: Record<string, unknown>) => void; canvas: () => string | undefined; texture: (u: string, p?: string) => Promise<unknown>; probe: (u: string, p: string) => Promise<unknown> };
const lab = () => (window as unknown as { __lab: Lab }).__lab;
const fitting = () => scenes.props.fitting as Record<string, unknown>;
const at = (q: string) => window.history.replaceState({}, "", `/lab/scenes${q}`);
const fakeImg = { width: 4, height: 2 } as unknown as HTMLImageElement;

beforeEach(() => { scenes.props = {}; fit.setFitMode.mockReset(); });
afterEach(() => { cleanup(); at(""); vi.restoreAllMocks(); });

describe("ScenesLab", () => {
  it("sem parâmetros abre o provador com a marca, o look de exemplo e a luz de loja", () => {
    at("");
    render(<ScenesLab />, { wrapper: Lang });
    expect(screen.getByRole("button", { name: "fitting-brand" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("fitting")).toBeTruthy();
    expect(fit.setFitMode).toHaveBeenCalledWith("depois");
    expect(fitting()).toMatchObject({ sex: "FEMININO", body: null, pieces: LAB_LOOK, view: "front", light: "store", closeUp: false, debug: null, cameraYaw: undefined, scene: null });
    expect((fitting().environment as { kind: string }).kind).not.toBe("neutral");
  });

  it("lê cenário, vista, corpo, peças, luz, depuração e ajustes de caimento da URL", () => {
    at("?s=fitting-sneakers&view=back&fit=antes&body=M-slim&pieces=cor-vermelha,camisa-xadrez,molde-jeans,camiseta_referencia,nada&light=night&debug=wire&yaw=30&close=1&variation=SLIM&neckline=V_NECK");
    render(<ScenesLab />, { wrapper: Lang });
    expect(fit.setFitMode).toHaveBeenCalledWith("antes");
    const p = fitting();
    expect(p).toMatchObject({ sex: "MASCULINO", view: "back", light: "night", closeUp: true, cameraYaw: 30, debug: { view: "wire", pose: null } });
    expect((p.body as { stature: number }).stature).toBe(1.82);
    const pieces = p.pieces as { id: string; imageUrl: string; variation?: string; attributes?: Record<string, string[]> }[];
    expect(pieces.map((x) => x.id)).toEqual(["lab-cor-vermelha", "lab-camisa-xadrez", expect.stringContaining("jeans"), "01_parte_superior_01_camiseta_referencia"]);
    expect(pieces[0].imageUrl).toBe("/lab/cores/camiseta-vermelha.webp");
    expect(pieces[1].imageUrl).toBe("/lab/cores/camisa-xadrez.webp");
    expect(pieces.every((x) => x.variation === "SLIM" && x.attributes?.NECKLINE?.[0] === "V_NECK")).toBe(true);
    expect(p.scene).not.toBeNull();
  });

  it("corpo plus, pose sem depuração, luz do dia e vista inválida ignorada", () => {
    at("?body=F-plus&pose=caminhada&light=daylight&view=cima&pieces=,");
    render(<ScenesLab />, { wrapper: Lang });
    expect(fitting()).toMatchObject({ sex: "FEMININO", light: "daylight", view: "front", debug: { view: "normal", pose: "caminhada" }, pieces: LAB_LOOK });
    expect((fitting().body as { build: number }).build).toBe(1.4);
  });

  it("botões trocam entre provador neutro, rua de lojas e palcos", () => {
    at("");
    render(<ScenesLab />, { wrapper: Lang });
    fireEvent.click(screen.getByRole("button", { name: "fitting-neutral" }));
    expect((fitting().environment as { kind: string }).kind).toBe("neutral");
    fireEvent.click(screen.getByRole("button", { name: "ministores" }));
    expect(screen.queryByTestId("fitting")).toBeNull();
    const store = scenes.props.store as { stores: unknown[]; selectedId: string; onPick: () => void };
    expect(store.stores).toHaveLength(4);
    expect(store.selectedId).toBe("c1");
    expect(() => store.onPick()).not.toThrow();
    fireEvent.click(screen.getByRole("button", { name: "ministage" }));
    expect(scenes.props.stage).toMatchObject({ name: "Luma Vale", era: "Era Neon" });
    expect(String(scenes.props.stage.logoUrl)).toMatch(/^data:image\/png/);
    fireEvent.click(screen.getByRole("button", { name: "ministage-sem-logo" }));
    expect(scenes.props.stage).toMatchObject({ name: "Rio Aurora", mannequin: { sex: "MASCULINO", head: "PADRAO" } });
    expect(scenes.props.stage.logoUrl).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "fitting-bruma" }));
    expect((fitting().scene as object | null)).not.toBeNull();
  });

  it("onProfile publica o inventário do estúdio para o script de capturas", () => {
    at("");
    render(<ScenesLab />, { wrapper: Lang });
    const onProfile = fitting().onProfile as (p: unknown) => void;
    onProfile({ interpretation: "x", brand: { key: "norte" }, palette: ["#000"], objects: [{ id: "o" }], photographs: [{ id: "f1" }, { id: "f2" }] });
    expect((window as unknown as { __sceneInventory: unknown }).__sceneInventory).toEqual({ interpretation: "x", brand: "norte", palette: ["#000"], objects: [{ id: "o" }], photographs: ["f1", "f2"] });
  });

  it("__lab.set muda ângulo, luz e peças sem recarregar; canvas devolve nada sem cena", () => {
    at("");
    render(<ScenesLab />, { wrapper: Lang });
    act(() => lab().set({ yaw: 90, light: "night", look: "cor-preta" }));
    expect(fitting()).toMatchObject({ cameraYaw: 90, light: "night" });
    expect((fitting().pieces as { id: string }[])[0].id).toBe("lab-cor-preta");
    act(() => lab().set({ close: true }));
    expect(fitting()).toMatchObject({ closeUp: true });
    expect((fitting().pieces as { id: string }[])[0].id).toBe("lab-cor-preta");
    expect(lab().canvas()).toBeUndefined();
    const c = document.createElement("canvas");
    screen.getByTestId("fitting").parentElement!.appendChild(c);
    expect(lab().canvas()).toMatch(/^data:image\/png/);
  });

  it("__lab.texture monta a textura pelo mesmo caminho do provador", async () => {
    at("");
    render(<ScenesLab />, { wrapper: Lang });
    three.loadTexture.mockResolvedValueOnce(null);
    expect(await lab().texture("/x.webp")).toBeNull();
    three.loadTexture.mockResolvedValue({ image: fakeImg });
    photo.prepareOutfitPhoto.mockResolvedValueOnce(null);
    const raw = await lab().texture("/x.webp") as Record<string, unknown>;
    expect(photo.prepareOutfitPhoto).toHaveBeenCalledWith(fakeImg, "upper");
    expect(raw).toMatchObject({ prepared: false, size: [4, 2], fabric: "#ff0000", rib: "#00ff00", trims: ["#0000ff"], collarRow: 4, neckDrop: 0.2, png: "data:tex", tile: { w: 8 } });
    const prepared = { width: 2, height: 2 };
    photo.prepareOutfitPhoto.mockResolvedValueOnce(prepared);
    garments.photoInfo.mockReturnValueOnce(null as never);
    const out = await lab().texture("/y.webp", "lower") as Record<string, unknown>;
    expect(out).toMatchObject({ prepared: true, size: [2, 2], collarRow: null, neckDrop: null });
  });

  it("__lab.probe explica o recorte, a pessoa e o que vira textura", async () => {
    at("");
    render(<ScenesLab />, { wrapper: Lang });
    three.loadTexture.mockResolvedValueOnce({});
    expect(await lab().probe("/x", "upper")).toEqual({ loaded: false });
    three.loadTexture.mockResolvedValue({ image: fakeImg });
    const cut = { toBlob: (cb: BlobCallback) => cb(new Blob(["a"])) };
    photo.prepareGarmentPhoto.mockReturnValue(cut);
    person.stripPerson.mockResolvedValue({ personFound: true, file: new File(["abc"], "p.png", { type: "image/png" }), segmentationAvailable: true, people: 1, garments: ["top"] });
    body.detectBody.mockResolvedValue({ mask: { data: [0, 2, 2] } });
    photo.prepareOutfitPhoto.mockResolvedValue({ toDataURL: () => "data:final" });
    const r = await lab().probe("/x", "upper") as Record<string, unknown>;
    expect(person.stripPerson).toHaveBeenCalledWith(expect.any(File), { keep: "upper" });
    expect(r).toMatchObject({ loaded: true, cutout: true, usable: true, segmentation: true, people: 1, personFound: true, garments: ["top"], classes: { 0: 1, 2: 2 }, final: "data:final" });
    expect(String(r.stripped)).toMatch(/^data:image\/png;base64,/);
  });

  it("__lab.probe sem recorte usa a foto inteira; sem pessoa e sem máscara", async () => {
    at("");
    render(<ScenesLab />, { wrapper: Lang });
    three.loadTexture.mockResolvedValue({ image: fakeImg });
    photo.prepareGarmentPhoto.mockReturnValue(null);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (this: HTMLCanvasElement, cb: BlobCallback) { cb(new Blob(["b"])); });
    person.stripPerson.mockResolvedValue({ personFound: false, file: null, segmentationAvailable: false, people: 0 });
    body.detectBody.mockResolvedValue({ mask: null });
    photo.prepareOutfitPhoto.mockResolvedValue(null);
    const r = await lab().probe("/x", "feet") as Record<string, unknown>;
    expect(r).toMatchObject({ loaded: true, cutout: false, personFound: false, garments: null, classes: {}, final: null, stripped: null });
  });
});
