// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderApp, loggedAs, ME } from "@/test-utils/render";
import { triangle } from "@/test-utils/glb-fixture";
import { Atelier3dEditor } from "./editor";
import type { SceneResponse, GenderEvidence } from "./contracts";
const client = vi.hoisted(() => ({
  get: vi.fn(),
  bytes: vi.fn(),
  evidence: vi.fn(),
  save: vi.fn(),
  search: vi.fn(),
}));
vi.mock("./scene-api", () => ({ sceneApi: () => client }));
afterEach(cleanup);
it("requires reconfirmation when catalog gender changes since the saved version", async () => {
  loggedAs(ME);
  const evidence: GenderEvidence = {
    sources: [
      { id: "p", name: "Camisa", gender: "MEN", normalized: "MASCULINO" },
    ],
    status: "READY",
    suggestion: "MASCULINO",
    hash: "old",
    options: [{ id: "male", codigo: "MASCULINO", nome: "Masculino" }],
  };
  const current = {
    id: "v1",
    sequence: 1,
    assetId: "a1",
    author: "test",
    createdAt: "2026-10-30T00:00:00Z",
    document: { nodes: {}, materials: {}, vertices: {} },
    gender: evidence,
    confirmedTipoLookId: "male",
  };
  const scene: SceneResponse = {
    title: "Projeto teste",
    edit: true,
    export: true,
    manageGuests: false,
    asset: {
      id: "a1",
      filename: "test.glb",
      bytes: 500,
      sha256: "a".repeat(64),
      inspection: {
        nodes: 1,
        meshes: 1,
        materials: 1,
        vertices: 3,
        skinned: false,
        morphs: false,
        animated: false,
        primitives: { "n0.p0": 3 },
        extensions: [],
      },
    },
    current,
    history: [current],
  };
  client.get.mockResolvedValue(scene);
  client.bytes.mockResolvedValue(triangle());
  client.evidence.mockResolvedValue({
    ...evidence,
    hash: "changed",
    sources: [{ ...evidence.sources[0], gender: "UNKNOWN", normalized: null }],
    suggestion: null,
    status: "INCOMPLETE",
  });
  client.save.mockImplementation(async (body) => ({
    ...current,
    sequence: 2,
    document: body.document,
    confirmedTipoLookId: body.confirmedTipoLookId,
  }));
  renderApp(<Atelier3dEditor projectId="project" />);
  fireEvent.click(
    await screen.findByRole("checkbox", { name: "Salvar automaticamente" }),
  );
  const input = await screen.findByLabelText("Posição — unidades do arquivo X");
  await waitFor(() =>
    expect(
      screen.getByRole("button", {
        name: "Tipo de look final (confirmação de quem cria)",
      }).textContent,
    ).toContain("Escolha para confirmar"),
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Exportar arquivo 3D final",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.change(input, { target: { value: "0.12" } });
  fireEvent.click(screen.getByRole("button", { name: "Desfazer", exact: true }));
  expect((input as HTMLInputElement).value).toBe("0");
  fireEvent.click(screen.getByRole("button", { name: "Refazer", exact: true }));
  expect((input as HTMLInputElement).value).toBe("0.12");
  fireEvent.change(screen.getByLabelText("Rotação — graus Y"), { target: { value: "180" } });
  fireEvent.change(screen.getByLabelText("Cor", { exact: true }), { target: { value: "#2266aa" } });
  fireEvent.change(screen.getByLabelText("Repetição da textura", { exact: true }), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Posição do vértice Z"), { target: { value: "0.2" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar", exact: true }));
  await waitFor(() => expect(client.save).toHaveBeenCalled());
  expect(client.save.mock.calls[0][0].confirmedTipoLookId).toBeNull();
  expect(client.save.mock.calls[0][0].genderEvidenceHash).toBe("changed");
  const saved = client.save.mock.calls[0][0].document;
  expect(saved.nodes.n0.position).toEqual([0.12, 0, 0]);
  expect(saved.nodes.n0.rotation[1]).toBeCloseTo(Math.PI);
  expect(saved.materials["n0.p0"]).toMatchObject({ color: "#2266aa", repeat: [3, 3] });
  expect(saved.vertices["n0.p0"][0]).toEqual([0, 0, 0.2]);
});

it("sem versão salva, a conferência que chega antes da cena não é apagada: o Salvar liga depois da mudança", async () => {
  loggedAs(ME);
  const evidence: GenderEvidence = { sources: [], status: "INCOMPLETE", suggestion: null, hash: "h0", options: [] };
  let answer!: (scene: SceneResponse) => void;
  client.get.mockImplementation(() => new Promise<SceneResponse>((resolve) => { answer = resolve; }));
  client.bytes.mockResolvedValue(triangle());
  client.evidence.mockReset().mockResolvedValue(evidence);
  client.save.mockReset().mockImplementation(async (body) => ({
    id: "v1", sequence: 1, assetId: "a1", author: "test", createdAt: "2026-11-15T00:00:00Z",
    document: body.document, gender: evidence, confirmedTipoLookId: null,
  }));
  renderApp(<Atelier3dEditor projectId="project" />);
  // a conferência da composição responde primeiro (auditoria 10: "Carregando…" sem fim e Salvar desligado)
  await waitFor(() => expect(client.evidence).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 0));
  answer({
    title: "Saia teste", edit: true, export: true, manageGuests: false,
    asset: { id: "a1", filename: "fai-skirt-prototype.glb", bytes: 500, sha256: "a".repeat(64),
      inspection: { nodes: 1, meshes: 1, materials: 1, vertices: 3, skinned: false, morphs: false, animated: false, primitives: { "n0.p0": 3 }, extensions: [] } },
    current: null, history: [],
  } as unknown as SceneResponse);
  fireEvent.click(await screen.findByRole("checkbox", { name: "Salvar automaticamente" }));
  const input = await screen.findByLabelText("Posição — unidades do arquivo X");
  expect(await screen.findByText(/Ainda não há sugestão/)).toBeTruthy();
  fireEvent.change(input, { target: { value: "0.12" } });
  const save = screen.getByRole("button", { name: "Salvar", exact: true }) as HTMLButtonElement;
  await waitFor(() => expect(save.disabled).toBe(false));
  fireEvent.click(save);
  await waitFor(() => expect(client.save).toHaveBeenCalledOnce());
  expect(client.save.mock.calls[0][0].genderEvidenceHash).toBe("h0");
  await waitFor(() => expect(screen.getAllByRole("status")[0].textContent).toContain("Versão 1"));
});
it("caracterização: barra da vista e histórico de versões mantêm controles e estados", async () => {
  loggedAs(ME);
  const evidence: GenderEvidence = { sources: [], status: "INCOMPLETE", suggestion: null, hash: "h0", options: [] };
  const current = { id: "v1", sequence: 1, assetId: "a1", author: "ana", createdAt: "2026-11-15T00:00:00Z",
    document: { nodes: {}, materials: {}, vertices: {} }, gender: evidence, confirmedTipoLookId: null };
  client.get.mockReset().mockResolvedValue({
    title: "Camiseta teste", edit: true, export: true, manageGuests: false,
    asset: { id: "a1", filename: "t.glb", bytes: 500, sha256: "a".repeat(64),
      inspection: { nodes: 1, meshes: 1, materials: 1, vertices: 3, skinned: false, morphs: false, animated: false, primitives: { "n0.p0": 3 }, extensions: [] } },
    current, history: [current],
  } as unknown as SceneResponse);
  client.bytes.mockResolvedValue(triangle());
  client.evidence.mockReset().mockResolvedValue(evidence);
  renderApp(<Atelier3dEditor projectId="project" />);
  const rotate = await screen.findByRole("button", { name: "Rotacionar (R)" });
  expect(screen.getByRole("button", { name: "Mover (G)" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(rotate);
  expect(rotate.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: /Vista da câmera/ }));
  expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Perspectiva", "Frente", "Costas", "Lado esquerdo", "Lado direito", "Vista superior"]);
  fireEvent.click(screen.getByRole("option", { name: "Frente" }));
  expect(screen.getByRole("button", { name: /Vista da câmera/ }).textContent).toContain("Frente");
  expect(screen.getByRole("button", { name: "Enquadrar (F)" })).toBeTruthy();
  const snap = screen.getByRole("checkbox", { name: "Alinhar à grade" }) as HTMLInputElement;
  fireEvent.click(snap);
  expect(snap.checked).toBe(true);
  expect((screen.getByRole("button", { name: "Desfazer", exact: true }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("heading", { name: "Histórico 3D" })).toBeTruthy();
  const restore = screen.getByRole("button", { name: "Restaurar como rascunho" }) as HTMLButtonElement;
  expect(restore.disabled).toBe(false);
  expect(screen.getByText(/· ana/)).toBeTruthy();
});
