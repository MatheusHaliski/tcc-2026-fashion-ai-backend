// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { loggedAs, renderApp, ME, USER } from "@/test-utils/render";
import { ApiError } from "@/lib/api/client";
import type { AvatarModel } from "@/lib/avatar3d/model";
import MyAvatar from "./my-avatar";

// A cena 3D vira um repasse: mostra o que recebeu e deixa o teste "entregar" o humano montado (onHuman).
const scene = vi.hoisted(() => ({ parts: null as unknown, last: null as Record<string, unknown> | null }));
vi.mock("next/dynamic", () => ({ default: () => function FittingSceneStub(props: Record<string, unknown> & { onHuman?: (p: unknown) => void }) {
  scene.last = props;
  const avatar = props.avatar as { textureUrl?: string; texture?: unknown };
  return <div data-testid="scena" data-sex={String(props.sex)} data-texture-url={avatar.textureUrl ?? ""} data-has-texture={String(!!avatar.texture)}>
    <button type="button" onClick={() => props.onHuman?.(scene.parts)}>entregar humano</button>
  </div>;
} }));
const webgl = vi.hoisted(() => ({ value: true as boolean | null }));
vi.mock("@/components/three/common", async (orig) => ({ ...(await orig<typeof import("@/components/three/common")>()), useWebGL: () => webgl.value }));
const pipe = vi.hoisted(() => ({ analyzePhoto: vi.fn(), buildAvatar: vi.fn(), atlasBlob: vi.fn() }));
vi.mock("@/lib/avatar3d/pipeline", () => pipe);
const gpu = vi.hoisted(() => ({ stylizedPortraitOnGpu: vi.fn() }));
vi.mock("@/lib/avatar3d/portrait-gpu", async (orig) => ({ ...(await orig<typeof import("@/lib/avatar3d/portrait-gpu")>()), stylizedPortraitOnGpu: gpu.stylizedPortraitOnGpu }));

const MODEL = {
  v: 1, shape: [], skin: "#c08a6a", metrics: {}, views: [], warnings: ["DEPTH_ESTIMATED"], sex: "MASCULINO",
  hair: { present: true, color: "#2a1d14", top: 1, side: 1, bottom: null, fringe: 0, cut: false, length: "short", tone: { level: 2, family: "ash" }, volumeLevel: "full" },
  eyes: { color: "#3a6ea5", secondary: "#2a4e75", cls: "BLUE", pattern: "RADIAL", confidence: 0.9, source: "IMAGE_ANALYSIS", glasses: "PRESCRIPTION", right: "#3a6ea5", left: "#6b4b2a" },
  brows: { color: "#2a1d14", thickness: 0.2, arch: 0.1, shape: "SOFT_ARCH", density: 0.7 },
} as unknown as AvatarModel;

const measuredParts = (eyes: unknown = null) => ({
  human: { root: { userData: { skin: "baked", skinReport: { skinColorError: 3.2, seams: 0 } } } },
  identity: { reprojectionMm: 1.1, asymmetry: 0.02, capture: 0.9, shapePreservation: 0.95, proportionErrorPct: 2 },
  eyes,
});
const built = (issues: unknown[] = []) => ({ model: MODEL, atlas: document.createElement("canvas"), set: { issues } });
const photo = (issues: unknown[] = []) => ({ issues });

beforeEach(() => {
  webgl.value = true; scene.parts = measuredParts(); scene.last = null;
  pipe.analyzePhoto.mockReset().mockResolvedValue(photo());
  pipe.buildAvatar.mockReset().mockReturnValue(built());
  pipe.atlasBlob.mockReset().mockResolvedValue(new Blob(["jpg"], { type: "image/jpeg" }));
  gpu.stylizedPortraitOnGpu.mockReset();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 5) as unknown as number);
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  URL.createObjectURL = vi.fn(() => "blob:foto");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

const NONE = { exists: false };
const SAVED = { exists: true, model: MODEL, adjust: { headScale: 1.02 }, textureUrl: "/api/me/avatar3d/texture", photos: 1, warnings: ["FACE_SMALL", "ALGO_NOVO"], publicOnRunway: false, updatedAt: "2026-10-01T12:00:00Z" };

async function mount(saved: unknown, routes: Record<string, unknown> = {}, me = ME) {
  const api = loggedAs(me, { "GET /api/me/avatar3d": saved, ...routes });
  renderApp(<MyAvatar />);
  return api;
}
const chooseFile = () => fireEvent.change(document.getElementById("avatar-photo")!, { target: { files: [new File(["x"], "rosto.jpg", { type: "image/jpeg" })] } });

describe("Meu Avatar 3D (RF40)", () => {
  it("sem avatar e sem foto de perfil: pede a foto, a prévia fica vazia e gerar fica desligado", async () => {
    await mount(NONE);
    expect(await screen.findByText("Você ainda não tem foto de perfil. Envie uma foto do rosto, de frente.")).toBeTruthy();
    expect(screen.getByText("Toque em Gerar prévia para montar o avatar com a sua foto de perfil.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Gerar prévia" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/As fotos são processadas no seu aparelho/)).toBeTruthy();
  });

  it("sem WebGL mostra o aviso no lugar do estúdio; perfil de marca ganha o selo", async () => {
    webgl.value = false;
    await mount(NONE, {}, { ...ME, user: { ...USER, profileType: "MARCA" } });
    expect(await screen.findByText(/Este navegador não tem WebGL/)).toBeTruthy();
    expect(screen.getByText("Perfis de marca usam o manequim padrão: o avatar não aparece na Passarela.")).toBeTruthy();
  });

  it("erro ao carregar o avatar mostra o estado de erro", async () => {
    await mount(new Response(JSON.stringify({ status: 500, code: "ERRO", message: "falhou" }), { status: 500, headers: { "content-type": "application/json" } }));
    expect(await screen.findByRole("button", { name: /tentar/i })).toBeTruthy();
  });

  it("usa a foto de perfil sozinha (sexo masculino do cadastro)", async () => {
    await mount(NONE, { "GET /media/ana.jpg": () => new Response("img", { headers: { "content-type": "image/jpeg" } }) },
      { ...ME, sex: "MASCULINO", user: { ...USER, avatarUrl: "/media/ana.jpg" } });
    const img = await screen.findByRole("img", { name: "Sua foto de perfil" });
    expect(img.getAttribute("src")).toBe("blob:foto");
    expect(screen.getByRole("button", { name: "Usar outra foto" })).toBeTruthy();
    await waitFor(() => expect((screen.getByRole("button", { name: "Gerar prévia" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Gerar prévia" }));
    await waitFor(() => expect(pipe.buildAvatar).toHaveBeenCalledWith([expect.anything()], { sex: null, profileSex: "MASCULINO" }));
  });

  it("foto de perfil que não é imagem vira aviso de indisponível", async () => {
    await mount(NONE, { "GET /media/ana.jpg": () => new Response("<html>", { headers: { "content-type": "text/html" } }) },
      { ...ME, user: { ...USER, avatarUrl: "/media/ana.jpg" } });
    expect(await screen.findByText("Não foi possível abrir a sua foto de perfil. Envie a foto aqui.")).toBeTruthy();
  });

  it("foto de perfil que falha (404) também vira aviso de indisponível", async () => {
    await mount(NONE, {}, { ...ME, user: { ...USER, avatarUrl: "/media/sumiu.jpg" } });
    expect(await screen.findByText("Não foi possível abrir a sua foto de perfil. Envie a foto aqui.")).toBeTruthy();
  });

  async function gerarPrevia(routes: Record<string, unknown> = {}) {
    const api = await mount(NONE, routes);
    await screen.findByText(/Você ainda não tem foto de perfil/);
    chooseFile();
    fireEvent.click(screen.getByRole("button", { name: "Gerar prévia" }));
    await screen.findByRole("button", { name: "Salvar avatar" });
    return api;
  }

  async function previaComAvisos() {
    pipe.analyzePhoto.mockResolvedValue(photo([{ code: "FACE_SMALL", severity: "warn", params: { px: 90 } }]));
    pipe.buildAvatar.mockReturnValue(built([{ code: "CODIGO_DESCONHECIDO", severity: "warn" }]));
    await gerarPrevia();
  }

  it("gera a prévia no aparelho e mostra os avisos da foto e do conjunto", async () => {
    await previaComAvisos();
    expect(screen.getByRole("img", { name: "Foto escolhida" })).toBeTruthy();
    expect(screen.getByText("Foto aprovada", { exact: false })).toBeTruthy();
    expect(screen.getByText(/O rosto está pequeno na foto \(90 px de largura\)/)).toBeTruthy();
    expect(screen.getByText(/Esta foto precisa de ajuste. Tente outra./)).toBeTruthy();
  });

  it("prévia gerada usa o sexo do cadastro, entrega a textura à cena e segura o salvar até medir", async () => {
    await previaComAvisos();
    expect(pipe.buildAvatar).toHaveBeenCalledWith([expect.anything()], { sex: null, profileSex: "FEMININO" });
    expect(screen.getByTestId("scena").getAttribute("data-has-texture")).toBe("true");
    expect(screen.getByTestId("scena").getAttribute("data-sex")).toBe("MASCULINO");
    // ainda não medida: salvar fica desligado e aparece "conferindo"
    expect(screen.getByText("Conferindo a qualidade da prévia…")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox"));
    expect((screen.getByRole("button", { name: "Salvar avatar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("espera a pele assada para liberar o salvar e salva com consentimento e o relatório de qualidade", async () => {
    const posted: unknown[] = [];
    const { calls } = await gerarPrevia({ "POST /api/me/avatar3d": (_u: URL, init: RequestInit) => { posted.push(init.body); return { ok: true }; } });
    fireEvent.click(screen.getByRole("checkbox"));
    const salvar = screen.getByRole("button", { name: "Salvar avatar" }) as HTMLButtonElement;
    // a cena entrega um humano ainda sem a pele assada; depois do bake a espera libera o salvar
    const parts = measuredParts({ ...MODEL.eyes, glasses: "NONE", right: undefined, left: undefined, cls: "GREEN" });
    (parts.human.root.userData as Record<string, unknown>).skin = "raw";
    scene.parts = parts;
    fireEvent.click(screen.getByRole("button", { name: "entregar humano" }));
    expect(salvar.disabled).toBe(true);
    (parts.human.root.userData as Record<string, unknown>).skin = "baked";
    await waitFor(() => expect(salvar.disabled).toBe(false));
    expect(screen.getByTestId("avatar-eyes").textContent).toContain("Verde");
    fireEvent.click(salvar);
    expect(await screen.findByText("Avatar salvo.")).toBeTruthy();
    expect(calls.some((c) => c.method === "POST" && c.path === "/api/me/avatar3d")).toBe(true);
    const meta = JSON.parse(String((posted[0] as FormData).get("meta")));
    expect(meta).toMatchObject({ consent: true, publicOnRunway: true, photos: 1, quality: { reprojectionMm: 1.1, skinColorError: 3.2, seams: 0 } });
    expect(pipe.atlasBlob).toHaveBeenCalled();
  });

  it("prévia bloqueada pela foto mostra o motivo e que não deu para montar", async () => {
    pipe.analyzePhoto.mockResolvedValue(photo([{ code: "FACE_SMALL", severity: "block", params: { px: 40 } }]));
    pipe.buildAvatar.mockReturnValue(null);
    await mount(NONE);
    await screen.findByText(/Você ainda não tem foto de perfil/);
    chooseFile();
    fireEvent.click(screen.getByRole("button", { name: "Gerar prévia" }));
    expect(await screen.findByText(/Não deu para montar o avatar com essas fotos/)).toBeTruthy();
    expect(screen.getAllByRole("alert").some((a) => /40 px/.test(a.textContent ?? ""))).toBe(true);
    expect(screen.queryByText(/Foto aprovada/)).toBeNull();
  });

  it("falha ao processar a foto avisa com toast", async () => {
    pipe.analyzePhoto.mockRejectedValue(new Error("onnx"));
    await mount(NONE);
    await screen.findByText(/Você ainda não tem foto de perfil/);
    chooseFile();
    fireEvent.click(screen.getByRole("button", { name: "Gerar prévia" }));
    expect(await screen.findByText(/Não foi possível processar as fotos neste aparelho/)).toBeTruthy();
  });

  it("com a GPU: desenha o retrato, mostra a semelhança e bloqueia o salvar quando ficou pouco parecido", async () => {
    gpu.stylizedPortraitOnGpu.mockResolvedValue({ image: "data:image/jpeg;base64,AAA", identitySimilarity: 0.2 });
    const { fetchMock } = await mount(NONE, { "GET /data:image/jpeg;base64,AAA": () => new Response(new Blob(["g"], { type: "image/jpeg" })) });
    await screen.findByText(/Você ainda não tem foto de perfil/);
    chooseFile();
    fireEvent.click(screen.getByRole("switch", { name: "Gerar o avatar com a GPU (semirrealista)" }));
    expect(screen.getByText(/Com a GPU, a foto é enviada/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Gerar avatar com a GPU" }));
    expect(await screen.findByText("Semelhança com a foto: 20%")).toBeTruthy();
    expect(screen.getByText(/O desenho ficou pouco parecido com você/)).toBeTruthy();
    expect(gpu.stylizedPortraitOnGpu).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("data:image/jpeg;base64,AAA");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "entregar humano" }));
    await waitFor(() => expect(screen.queryByText("Conferindo a qualidade da prévia…")).toBeNull());
    expect((screen.getByRole("button", { name: "Salvar avatar" }) as HTMLButtonElement).disabled).toBe(true);
    // o consentimento da GPU vale para um envio só
    expect(screen.getByRole("switch", { name: "Gerar o avatar com a GPU (semirrealista)" }).getAttribute("aria-checked")).toBe("false");
  });

  it("GPU recusa a foto sem rosto: para com o motivo, sem montar o avatar", async () => {
    gpu.stylizedPortraitOnGpu.mockRejectedValue(new ApiError(422, "RETRATO_GPU_RECUSADO", "recusado", { reason: "FACE_NOT_FOUND" }));
    await mount(NONE);
    await screen.findByText(/Você ainda não tem foto de perfil/);
    chooseFile();
    fireEvent.click(screen.getByRole("switch", { name: "Gerar o avatar com a GPU (semirrealista)" }));
    fireEvent.click(screen.getByRole("button", { name: "Gerar avatar com a GPU" }));
    expect(await screen.findByText(/Não encontramos um rosto nítido na foto/)).toBeTruthy();
    expect(pipe.analyzePhoto).not.toHaveBeenCalled();
  });

  it("GPU ocupada ou desligada: monta da própria foto e avisa o motivo", async () => {
    gpu.stylizedPortraitOnGpu.mockRejectedValueOnce(new ApiError(503, "RETRATO_GPU_RECUSADO", "ocupada", { reason: "GPU_BUSY_RETRY_LATER" }));
    await mount(NONE);
    await screen.findByText(/Você ainda não tem foto de perfil/);
    chooseFile();
    fireEvent.click(screen.getByRole("switch", { name: "Gerar o avatar com a GPU (semirrealista)" }));
    fireEvent.click(screen.getByRole("button", { name: "Gerar avatar com a GPU" }));
    expect(await screen.findByText("A GPU está ocupada agora. Tente de novo em instantes.")).toBeTruthy();
    expect(pipe.analyzePhoto).toHaveBeenCalledTimes(1);
    gpu.stylizedPortraitOnGpu.mockRejectedValueOnce(new Error("rede"));
    fireEvent.click(screen.getByRole("switch", { name: "Gerar o avatar com a GPU (semirrealista)" }));
    fireEvent.click(screen.getByRole("button", { name: "Gerar avatar com a GPU" }));
    expect(await screen.findByText("A GPU está desligada agora: o avatar foi montado direto da foto.")).toBeTruthy();
  });

  it("falha ao salvar mostra o erro da API", async () => {
    await mount(NONE, { "POST /api/me/avatar3d": () => new Response(JSON.stringify({ status: 413, code: "GRANDE", message: "Arquivo grande demais" }), { status: 413, headers: { "content-type": "application/json" } }) });
    await screen.findByText(/Você ainda não tem foto de perfil/);
    chooseFile();
    fireEvent.click(screen.getByRole("button", { name: "Gerar prévia" }));
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "entregar humano" }));
    const salvar = screen.getByRole("button", { name: "Salvar avatar" }) as HTMLButtonElement;
    await waitFor(() => expect(salvar.disabled).toBe(false));
    fireEvent.click(salvar);
    expect(await screen.findByText("Arquivo grande demais")).toBeTruthy();
  });

  it("avatar salvo: mostra avisos, ajustes finos e salva ajustes e visibilidade", async () => {
    const { calls } = await mount(SAVED, { "PATCH /api/me/avatar3d": { ok: true } });
    expect(await screen.findByText(/Feito com 1 foto/)).toBeTruthy();
    expect(screen.getByText(/O rosto estava pequeno na foto de frente/)).toBeTruthy();
    expect(screen.getByText(/Esta foto precisa de ajuste/)).toBeTruthy();
    expect(screen.getByTestId("scena").getAttribute("data-texture-url")).toBe("/api/me/avatar3d/texture");
    // sliders: cabeça em %, pescoço em cm
    expect(screen.getByText("102%")).toBeTruthy();
    expect(screen.getByText("0 cm")).toBeTruthy();
    expect(screen.getByText("Da foto: volumoso. 100% = o volume medido.")).toBeTruthy();
    // olhos com heterocromia, sobrancelhas cheias, óculos de grau
    expect(screen.getByTestId("avatar-eyes").textContent).toContain("Azul (um olho de cada cor)");
    expect(screen.getByTestId("avatar-brows").textContent).toContain("arco suave, cheias");
    const salvarAjustes = screen.getByRole("button", { name: "Salvar ajustes" }) as HTMLButtonElement;
    expect(salvarAjustes.disabled).toBe(true);
    fireEvent.change(document.getElementById("adj-neck")!, { target: { value: "0.01" } });
    expect(screen.getByText("+1 cm")).toBeTruthy();
    fireEvent.change(document.getElementById("adj-skinLight")!, { target: { value: "-0.05" } });
    expect(screen.getByText("-5%")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Sem óculos" }));
    expect(screen.getByRole("radio", { name: "Sem óculos" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Com os óculos da foto" }));
    expect(salvarAjustes.disabled).toBe(false);
    fireEvent.click(salvarAjustes);
    expect(await screen.findByText("Alterações salvas.")).toBeTruthy();
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.body).toMatchObject({ adjust: { neck: 0.01, skinLight: -0.05, headScale: 1.02 } });
    fireEvent.click(screen.getByRole("switch", { name: "Mostrar meu avatar na Passarela 3D" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH" && (c.body as { publicOnRunway?: boolean }).publicOnRunway === true)).toBe(true));
  });

  it("escolhe corte, franja e tom do cabelo e volta ao medido", async () => {
    await mount(SAVED);
    await screen.findByText(/Feito com 1 foto/);
    const corte = screen.getByRole("radiogroup", { name: "Corte" });
    expect(screen.getByText("Curto (da foto)")).toBeTruthy();
    fireEvent.click(within(corte).getByRole("radio", { name: "Raspado" }));
    expect(within(corte).getByRole("radio", { name: "Raspado" }).getAttribute("aria-checked")).toBe("true");
    const franja = screen.getByRole("radiogroup", { name: "Franja" });
    fireEvent.click(within(franja).getByRole("radio", { name: "Sem franja" }));
    expect(within(franja).getByRole("radio", { name: "Sem franja" }).getAttribute("aria-checked")).toBe("true");
    const tom = screen.getByRole("radiogroup", { name: "Tom do cabelo" });
    const auto = within(tom).getAllByRole("radio")[0];
    expect(auto.getAttribute("aria-label")).toMatch(/^Da foto: .+ acinzentado$/);
    fireEvent.click(within(tom).getByRole("radio", { name: "Preto" }));
    expect(within(tom).getByRole("radio", { name: "Preto" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao medido na foto" }));
    expect(auto.getAttribute("aria-checked")).toBe("true");
    expect(screen.getAllByText("100%").length).toBeGreaterThanOrEqual(2);
  });

  it("cabelo coberto ou careca sem cor: sem seletores de corte; olhos padrão sem óculos; sobrancelhas ralas", async () => {
    const model = { ...MODEL, hair: { ...MODEL.hair, cover: "#000000" }, eyes: { ...MODEL.eyes, source: "DEFAULT", glasses: "NONE", right: undefined }, brows: { ...MODEL.brows, density: 0.2, shape: "STRAIGHT" } };
    await mount({ ...SAVED, model, warnings: [], photos: undefined, updatedAt: undefined });
    await screen.findByText(/Feito com 1 foto/);
    expect(screen.queryByRole("radiogroup", { name: "Corte" })).toBeNull();
    expect(screen.getByTestId("avatar-eyes").textContent).toContain("Padrão (não apareceu na foto)");
    expect(screen.getByTestId("avatar-brows").textContent).toContain("retas, ralas");
    expect(screen.queryByRole("radiogroup", { name: "Óculos" })).toBeNull();
  });

  it("careca sem cor: o corte mostra 'Careca (da foto)' e franja/tom só aparecem ao escolher um corte; sobrancelhas médias", async () => {
    const model = { ...MODEL, hair: { present: false, color: null, top: 0, side: 0, bottom: null, fringe: 0, cut: false, tone: { level: 9, family: "golden" } }, brows: { ...MODEL.brows, density: 0.4 } };
    await mount({ ...SAVED, model });
    await screen.findByText(/Feito com 1 foto/);
    expect(screen.getByText("Careca (da foto)")).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: "Franja" })).toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Tom do cabelo" })).toBeNull();
    expect(screen.getByTestId("avatar-brows").textContent).toContain("médias");
    fireEvent.click(screen.getByRole("radio", { name: "Raspado" }));
    const tom = screen.getByRole("radiogroup", { name: "Tom do cabelo" });
    expect(within(tom).getAllByRole("radio")[0].getAttribute("aria-label")).toMatch(/dourado$/);
    expect(screen.getByRole("radiogroup", { name: "Franja" })).toBeTruthy();
  });

  it("sem tom medido o tom automático fica 'Da foto'", async () => {
    const model = { ...MODEL, hair: { ...MODEL.hair, tone: null, color: null }, eyes: undefined, brows: undefined };
    await mount({ ...SAVED, model }, {});
    await screen.findByText(/Feito com 1 foto/);
    fireEvent.click(screen.getByRole("radio", { name: "Raspado" }));
    const tom = screen.getByRole("radiogroup", { name: "Tom do cabelo" });
    expect(within(tom).getAllByRole("radio")[0].getAttribute("aria-label")).toBe("Da foto");
    expect(screen.queryByTestId("avatar-eyes")).toBeNull();
  });

  it("nova prévia sobre o avatar salvo pode ser cancelada e volta ao salvo", async () => {
    await mount(SAVED);
    await screen.findByText(/Feito com 1 foto/);
    chooseFile();
    fireEvent.click(screen.getByRole("button", { name: "Gerar prévia" }));
    await screen.findByRole("button", { name: "Salvar avatar" });
    expect(screen.queryByText(/Feito com 1 foto/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(await screen.findByText(/Feito com 1 foto/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Salvar avatar" })).toBeNull();
  });

  it("exclui o avatar depois de confirmar; erro na exclusão vira toast", async () => {
    let fail = true;
    const { calls } = await mount(SAVED, { "DELETE /api/me/avatar3d": () => fail ? new Response(JSON.stringify({ status: 500, code: "X", message: "Falha ao excluir" }), { status: 500, headers: { "content-type": "application/json" } }) : undefined });
    await screen.findByText(/Feito com 1 foto/);
    fireEvent.click(screen.getByRole("button", { name: "Excluir avatar" }));
    const dlg = await screen.findByRole("dialog", { name: "Excluir seu avatar 3D?" });
    fireEvent.click(within(dlg).getByRole("button", { name: "Excluir avatar" }));
    expect(await screen.findByText("Falha ao excluir")).toBeTruthy();
    fail = false;
    fireEvent.click(within(dlg).getByRole("button", { name: "Excluir avatar" }));
    expect(await screen.findByText(/Avatar excluído/)).toBeTruthy();
    expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(2);
  });

  it("fecha o diálogo de exclusão no cancelar", async () => {
    await mount(SAVED);
    await screen.findByText(/Feito com 1 foto/);
    fireEvent.click(screen.getByRole("button", { name: "Excluir avatar" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("erro ao salvar ajustes mostra o erro", async () => {
    await mount(SAVED, { "PATCH /api/me/avatar3d": () => new Response(JSON.stringify({ status: 400, code: "X", message: "Ajuste inválido" }), { status: 400, headers: { "content-type": "application/json" } }) });
    await screen.findByText(/Feito com 1 foto/);
    fireEvent.click(screen.getByRole("switch", { name: "Mostrar meu avatar na Passarela 3D" }));
    expect(await screen.findByText("Ajuste inválido")).toBeTruthy();
  });
});

describe("identidade versionada do avatar (AVATAR-ID I1)", () => {
  const VERSIONS = [
    { version: 3, status: "NEEDS_REFINEMENT", current: true, approved: false, createdAt: "2026-10-02T10:00:00Z" },
    { version: 2, status: "APPROVED", current: false, approved: true, approvedWithWarnings: true },
  ];
  it("precisa de refinamento: lista o que reprovou, aprova mesmo assim e restaura versão anterior", async () => {
    const identity = { version: 3, status: "NEEDS_REFINEMENT", approvedVersion: 2, quality: { gate: { passed: false, failed: ["asymmetry", "skinColorError"] } } };
    const { calls } = await mount({ ...SAVED, identity }, {
      "GET /api/me/avatar3d/versions": VERSIONS, "POST /api/me/avatar3d/versions/3/approve": { ok: true }, "POST /api/me/avatar3d/versions/2/restore": { ok: true },
    });
    expect(await screen.findByText("Versão 3")).toBeTruthy();
    expect(screen.getByText("Esta versão ainda não ficou parecida o bastante com você em: assimetria do rosto, tom de pele.")).toBeTruthy();
    expect(screen.getByText("Outras pessoas continuam vendo a versão 2, a última aprovada.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aprovar mesmo assim" }));
    expect(await screen.findByText("Versão aprovada.")).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/me/avatar3d/versions/3/approve")?.body).toEqual({ acceptWarnings: true });
    const toggle = await screen.findByRole("button", { name: "Versões · 2" });
    fireEvent.click(toggle);
    const list = screen.getByRole("list", { name: "Versões" });
    expect(within(list).getByText("v3")).toBeTruthy();
    expect(within(list).getByText("atual")).toBeTruthy();
    expect(within(list).getByText("Aprovada (com avisos)")).toBeTruthy();
    expect(within(list).getByText("vista pelos outros")).toBeTruthy();
    expect(within(list).getAllByRole("button", { name: "Voltar para esta versão" })).toHaveLength(1);
    fireEvent.click(within(list).getByRole("button", { name: "Voltar para esta versão" }));
    expect(await screen.findByText("Versão restaurada.")).toBeTruthy();
  });

  it("refinamento sem detalhes e sem versão aprovada: aviso geral e manequim; erro ao aprovar", async () => {
    const identity = { version: 1, status: "NEEDS_REFINEMENT", approvedVersion: null, quality: null };
    await mount({ ...SAVED, identity }, {
      "GET /api/me/avatar3d/versions": [], "POST /api/me/avatar3d/versions/1/approve": () => new Response(JSON.stringify({ status: 409, code: "X", message: "Não deu para aprovar" }), { status: 409, headers: { "content-type": "application/json" } }),
    });
    expect(await screen.findByText("Esta versão ainda não ficou parecida o bastante com você.")).toBeTruthy();
    expect(screen.getByText(/Outras pessoas veem o manequim de referência/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aprovar mesmo assim" }));
    expect(await screen.findByText("Não deu para aprovar")).toBeTruthy();
  });

  it("aprovada e rascunho não mostram o aviso de refinamento", async () => {
    await mount({ ...SAVED, identity: { version: 2, status: "APPROVED" } }, { "GET /api/me/avatar3d/versions": VERSIONS });
    expect(await screen.findByText("Aprovada")).toBeTruthy();
    expect(document.querySelector("[data-identity-status='APPROVED']")).toBeTruthy();
    expect(screen.queryByRole("note")).toBeNull();
    cleanup();
    await mount({ ...SAVED, identity: { version: 1, status: "DRAFT" } }, { "GET /api/me/avatar3d/versions": VERSIONS });
    expect(await screen.findByText("Rascunho")).toBeTruthy();
  });
});
