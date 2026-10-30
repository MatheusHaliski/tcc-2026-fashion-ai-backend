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
        name: "TipoLook final — confirmação do criador",
      }).textContent,
    ).toContain("Escolha para confirmar"),
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Exportar GLB confirmado",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.change(input, { target: { value: "0.12" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar", exact: true }));
  await waitFor(() => expect(client.save).toHaveBeenCalled());
  expect(client.save.mock.calls[0][0].confirmedTipoLookId).toBeNull();
  expect(client.save.mock.calls[0][0].genderEvidenceHash).toBe("changed");
});
