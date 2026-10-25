// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as THREE from "three";

// Canvas vira uma <div> que repassa os filhos; a câmera é de verdade para conferir onde cada vista posiciona
const r3f = vi.hoisted(() => ({ camera: null as unknown as THREE.PerspectiveCamera, gl: {} as Record<string, unknown> }));
vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children, onCreated }: { children: React.ReactNode; onCreated?: (s: { gl: unknown }) => void }) => { onCreated?.({ gl: r3f.gl }); return <div data-testid="canvas">{children}</div>; },
  useThree: () => ({ camera: r3f.camera, scene: { name: "cena" } }),
}));
const human = vi.hoisted(() => ({ last: null as Record<string, unknown> | null, parts: null as unknown }));
vi.mock("@/components/three/human-avatar", () => ({ HumanAvatar: (props: Record<string, unknown> & { onReady?: (p: unknown) => void }) => {
  human.last = props;
  return <button type="button" data-testid="humano" data-sex={(props.body as { sex: string }).sex} onClick={() => props.onReady?.(human.parts)}>pronto</button>;
} }));
vi.mock("@/components/three/avatar-lighting", () => ({ AvatarLighting: () => null }));
vi.mock("@/components/three/avatar-still", () => ({ default: ({ onStill, alt }: { onStill: (u: string | null) => void; alt: string }) => <button type="button" onClick={() => onStill("data:abc")}>{alt}</button> }));
const glb = vi.hoisted(() => ({ exportAvatarGlb: vi.fn() }));
vi.mock("@/lib/avatar3d/human/export-glb", () => glb);
const pipe = vi.hoisted(() => ({ analyzePhoto: vi.fn(), buildAvatar: vi.fn() }));
vi.mock("@/lib/avatar3d/pipeline", () => pipe);

import HumanLab from "./human-lab";

type Lab = Record<string, (...a: unknown[]) => unknown>;
const lab = () => (window as unknown as { __humanLab: Lab }).__humanLab;
const canvas = () => { const c = document.createElement("canvas"); c.width = 40; c.height = 40; return c; };
const PX = Array.from({ length: 468 }, (_, i) => [10 + (i % 20), 10 + (i % 15)]);
const analyzed = (glasses: unknown = null) => ({ canvas: canvas(), px: PX, skin: "#c08a6a", issues: [{ code: "FACE_SMALL", severity: "warn" }], glasses });
const MODEL = { sex: "MASCULINO", shape: [1, 2, 3], skin: "#aa7755", hair: { present: true, color: "#222222" }, warnings: ["DEPTH_ESTIMATED"], eyes: { cls: "BLUE" }, brows: { shape: "STRAIGHT" } };
const BUILT = { model: MODEL, atlas: canvas(), sexGuess: { sex: "MASCULINO", p: 0.9 }, hairProfile: { length: "short" } };
function parts() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(9), 3));
  geometry.setIndex([0, 1, 2]); geometry.addGroup(0, 3, 0);
  const hair = new THREE.Mesh(geometry); hair.userData.hairLod = 2;
  return { human: { root: { userData: { skinReport: { seams: 0 } } } }, pose: {}, hair, exportHair: () => null, identity: { reprojectionMm: 1 }, hairLod: 2, composed: { body: [0, 0.1, 0, 0, 1.7, 0] } };
}

beforeEach(() => {
  r3f.camera = new THREE.PerspectiveCamera(); r3f.gl = {};
  human.parts = parts(); human.last = null;
  pipe.analyzePhoto.mockReset().mockResolvedValue(analyzed());
  pipe.buildAvatar.mockReset().mockReturnValue(BUILT);
  glb.exportAvatarGlb.mockReset().mockResolvedValue(new Blob([new Uint8Array([71, 76, 66])]));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const photo = () => fireEvent.change(document.getElementById("human-photo")!, { target: { files: [new File(["x"], "f.jpg", { type: "image/jpeg" })] } });

describe("laboratório do corpo humano", () => {
  it("configura o renderizador, troca o sexo e expõe o estado ainda vazio", () => {
    render(<HumanLab />);
    expect(r3f.gl.toneMappingExposure).toBe(0.95);
    expect(screen.getByTestId("humano").getAttribute("data-sex")).toBe("FEMININO");
    fireEvent.click(screen.getByRole("button", { name: "FEMININO" }));
    expect(screen.getByTestId("humano").getAttribute("data-sex")).toBe("MASCULINO");
    expect(human.last?.skin).toBe("#a97c50");
    const l = lab();
    expect(l.identity()).toBeNull(); expect(l.skinReport()).toBeNull(); expect(l.warnings()).toEqual([]); expect(l.eyes()).toBeNull();
    expect(l.twin()).toBeNull(); expect(l.bodyMeasures()).toBeNull(); expect(l.atlas()).toBeNull(); expect(l.photo()).toBeNull();
    expect(l.glasses()).toBeNull(); expect(l.issues()).toEqual([]); expect(l.hairLod()).toBeNull(); expect(l.hairStats()).toBeNull();
    expect(l.sex()).toEqual({ body: null, guess: null }); expect(l.ready()).toBe(0); expect(l.status()).toBe("idle");
    expect(l.hair()).toBeNull(); expect(l.skin()).toBeNull(); expect(l.profile()).toBeNull(); expect(l.stillBytes()).toBe(0);
    expect(screen.getByText("idle · loading")).toBeTruthy();
  });

  it("vistas posicionam a câmera: corpo, rosto, nuca, olhos, pés e tronco", () => {
    render(<HumanLab />);
    const z = () => r3f.camera.position.z;
    expect(z()).toBeGreaterThan(2);
    fireEvent.click(screen.getByRole("button", { name: "face" })); expect(z()).toBeCloseTo(0.8);
    fireEvent.click(screen.getByRole("button", { name: "faceback" })); expect(z()).toBeCloseTo(-1.05);
    fireEvent.click(screen.getByRole("button", { name: "eyes" })); expect(z()).toBeCloseTo(0.42);
    fireEvent.click(screen.getByRole("button", { name: "profile" })); expect(r3f.camera.position.x).toBeGreaterThan(2);
    act(() => { lab().setView("feet"); }); expect(r3f.camera.position.y).toBeCloseTo(0.32);
    act(() => { lab().setView("torso34"); }); expect(Math.hypot(r3f.camera.position.x, z())).toBeCloseTo(1.5);
    expect((window as unknown as { __labScene: { name: string } }).__labScene.name).toBe("cena");
  });

  it("controles: movimento, vento, roupa, cabelo, nível de detalhe e prévia 2D", () => {
    render(<HumanLab />);
    fireEvent.click(screen.getByRole("button", { name: "motion false" })); expect(human.last?.motion).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "vento 0.15" })); expect(human.last?.wind).toBe(0.9);
    fireEvent.click(screen.getByRole("button", { name: "vento 0.9" })); expect(human.last?.wind).toBe(0.15);
    fireEvent.click(screen.getByRole("button", { name: "vestido" })); expect((human.last?.pieces as unknown[]).length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "cacheado" })); expect((human.last?.hair as { texture: string }).texture).toBe("curly");
    fireEvent.click(screen.getByRole("button", { name: "LOD 3" })); expect(human.last?.hairLod).toBe(3);
    act(() => { lab().setCut(2); lab().setGlassesOn(0); });
    expect(human.last?.adjust).toEqual({ hairCut: 2, glasses: 0 });
    act(() => { lab().setOutfit("inexistente"); }); expect(human.last?.pieces).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "prévia 2D false" }));
    fireEvent.click(screen.getByRole("button", { name: "Prévia 2D" }));
    expect(lab().stillBytes()).toBe(8);
    act(() => { (lab().setStill as (v: boolean) => void)(false); });
    expect(screen.queryByRole("button", { name: "Prévia 2D" })).toBeNull();
  });

  it("medidas escolhidas montam o corpo com origem 'user' e a altura delas", () => {
    render(<HumanLab />);
    act(() => { lab().setBodyParams({ stature: 1.9, chest: 1 }); });
    const body = human.last?.body as { params: { stature: number }; sources: Record<string, string> };
    expect(body.params.stature).toBe(1.9);
    expect(body.sources).toEqual({ stature: "user", chest: "user" });
    expect(human.last?.stature).toBe(1.9);
  });

  it("foto: monta o avatar com o pipeline, expõe as métricas e exporta o GLB", async () => {
    render(<HumanLab />);
    photo();
    await waitFor(() => expect(lab().status()).toBe("built"));
    expect(pipe.buildAvatar).toHaveBeenCalledWith([expect.anything()], { profileSex: "FEMININO" });
    expect(screen.getByTestId("humano").getAttribute("data-sex")).toBe("MASCULINO");
    expect(human.last?.skin).toBe("#aa7755");
    fireEvent.click(screen.getByTestId("humano"));
    const l = lab();
    expect(l.ready()).toBe(1);
    expect(screen.getByText("built · ready")).toBeTruthy();
    expect(l.identity()).toEqual({ reprojectionMm: 1 });
    expect(l.skinReport()).toEqual({ seams: 0 });
    expect(l.warnings()).toEqual(["DEPTH_ESTIMATED"]);
    expect(l.eyes()).toEqual({ cls: "BLUE" });
    expect(l.twin()).toMatchObject({ shape: [1, 2, 3], sex: "MASCULINO", brows: { shape: "STRAIGHT" } });
    expect((l.bodyMeasures() as { stature: number }).stature).toBeCloseTo(1.6);
    expect(l.atlas()).toMatch(/^data:image\/png/);
    expect(l.photo()).toMatchObject({ skin: "#c08a6a" });
    expect(l.issues()).toEqual(["FACE_SMALL:warn"]);
    expect(l.hairLod()).toBe(2);
    expect(l.hairStats()).toEqual({ lod: 2, vertices: 3, triangles: 1, groups: [1] });
    expect(l.sex()).toEqual({ body: "MASCULINO", guess: { sex: "MASCULINO", p: 0.9 } });
    expect(l.hair()).toEqual(MODEL.hair); expect(l.skin()).toBe("#aa7755"); expect(l.profile()).toEqual({ length: "short" });
    l.hairVisible(false);
    expect((human.parts as { hair: THREE.Mesh }).hair.visible).toBe(false);
    expect(await l.glb()).toBe(btoa("GLB"));
    expect(glb.exportAvatarGlb).toHaveBeenCalled();
  });

  it("óculos sintéticos: reanalisa a foto com a armação desenhada; foto recusada e erro aparecem no status", async () => {
    render(<HumanLab />);
    act(() => { lab().setSynth("sun"); });
    pipe.buildAvatar.mockReturnValueOnce(null);
    photo();
    await waitFor(() => expect(lab().status()).toBe("rejected"));
    expect(pipe.analyzePhoto).toHaveBeenCalledTimes(2);
    expect(pipe.analyzePhoto.mock.calls[1][0]).toBeInstanceOf(HTMLCanvasElement);
    act(() => { lab().setSynth("frame"); });
    pipe.analyzePhoto.mockRejectedValueOnce(new Error("sem modelo"));
    photo();
    await waitFor(() => expect(lab().status()).toBe("error: sem modelo"));
  });

  it("análise avulsa por URL, com e sem óculos sintéticos", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("img")));
    pipe.analyzePhoto.mockResolvedValue(analyzed({ kind: "PRESCRIPTION" }));
    render(<HumanLab />);
    const plain = await lab().analyze("/foto.jpg", "none") as { issues: string[]; glasses: unknown };
    expect(plain.issues).toEqual(["FACE_SMALL:warn"]);
    expect(pipe.analyzePhoto).toHaveBeenCalledTimes(1);
    const framed = await lab().analyze("/foto.jpg", "frame") as { png: string };
    expect(framed.png).toMatch(/^data:image\/png/);
    expect(pipe.analyzePhoto).toHaveBeenCalledTimes(3);
  });

  it("sem humano montado, GLB e visibilidade do cabelo não fazem nada", async () => {
    render(<HumanLab />);
    expect(await lab().glb()).toBeNull();
    expect(() => lab().hairVisible(true)).not.toThrow();
    expect(glb.exportAvatarGlb).not.toHaveBeenCalled();
  });
});
