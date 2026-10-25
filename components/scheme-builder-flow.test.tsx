// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { PIECE, PIECE_2, SCHEME } from "@/test-utils/fixtures";
import { SchemeBuilder } from "./scheme-builder";
vi.mock("@/components/look-seal-verification", () => ({ useLookSeals: () => ({ valid: true, requests: [], pickedArts: [] }), SealSuggestions: () => null }));
vi.mock("@/components/scheme-card", () => ({ SchemeCard: () => null }));
vi.mock("@/components/hype/look-hype-preview", () => ({ LookHypePreview: () => null, PieceHypeTag: () => null }));
vi.mock("@/components/insights/insight-strip", () => ({ InsightStrip: () => null }));
vi.mock("@/components/expanded-card", () => ({ CreationSuccess: () => null }));
vi.mock("next/dynamic", () => ({ default: () => ({ onChange }: { onChange?: (v: unknown) => void }) => <button onClick={() => onChange?.({ color: "#ffffff" })}>Escolher aparência de teste</button> }));
vi.mock("@/components/background-studio", () => ({ BackgroundStudio: ({ onChange }: { onChange: (v: unknown) => void }) => <button onClick={() => onChange({ color: "#ffffff" })}>Escolher aparência de teste</button> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function setup() {
  return loggedAs(undefined, { "GET /api/schemes/builder": { totalPieces: 2, eligiblePieces: 2, status: "OK", lists: { upper: [PIECE], lower: [PIECE_2] }, defaultVisibility: "PRIVATE" }, "PUT /api/schemes/s1": { scheme: SCHEME } });
}
async function details() {
  fireEvent.click(await screen.findByRole("button", { name: "Avançar", exact: true }));
  fireEvent.click(await screen.findByRole("button", { name: "Avançar", exact: true }));
}
describe("Aparência opcional", () => {
  it("permite revisar e salvar sem abrir Aparência e preserva o fundo", async () => {
    const api = setup(); renderApp(<SchemeBuilder initial={SCHEME} />); await details();
    fireEvent.click(screen.getAllByRole("button", { name: "Revisar e salvar", exact: true }).find(b => b.classList.contains("btn-primary"))!);
    expect(screen.queryByRole("button", { name: "Escolher aparência de teste" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Salvar", exact: true }));
    await waitFor(() => expect(api.calls.some(c => c.method === "PUT" && c.path === "/api/schemes/s1")).toBe(true));
    const body = api.calls.find(c => c.method === "PUT" && c.path === "/api/schemes/s1")!.body as { background: { scheme: { skin: string } } };
    expect(body.background.scheme.skin).toBe("atelier");
  });
  it("mantém a etapa de Aparência e aplica a escolha ao salvar", async () => {
    const api = setup(); renderApp(<SchemeBuilder initial={SCHEME} />); await details();
    fireEvent.click(screen.getByRole("button", { name: /Aparência/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Escolher aparência de teste" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Revisar e salvar", exact: true }).find(b => b.classList.contains("btn-primary"))!);
    fireEvent.click(screen.getByRole("button", { name: "Salvar", exact: true }));
    await waitFor(() => expect(api.calls.some(c => c.method === "PUT" && c.path === "/api/schemes/s1")).toBe(true));
    const body = api.calls.find(c => c.method === "PUT" && c.path === "/api/schemes/s1")!.body as { background: { scheme: { color: string } } };
    expect(body.background.scheme.color).toBe("#ffffff");
  });
});
