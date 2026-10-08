// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { useLookSeals, SealSuggestions } from "./look-seal-verification";
import { SchemeBuilder } from "./scheme-builder";
import { DnaBuilder } from "./dna-builder";
import { SCHEME, OWNER, PIECE, PIECE_2 } from "@/test-utils/fixtures";
import type { DnaView } from "./dna-card";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const brand = { targetOwnerId: "brand1", kind: "BRAND", name: "Marca teste", confidence: .95 };
const celeb = { ...brand, targetOwnerId: "celeb1", kind: "CELEBRITY", name: "Celebridade teste" };
function Harness({ ids = ["p1", "p2"] }: { ids?: string[] }) {
  const v = useLookSeals({ pieceIds: ids, occasion: [], style: [], enabled: true });
  return <><SealSuggestions {...v} /><output data-testid="requests">{JSON.stringify(v.requests)}</output><output data-testid="valid">{String(v.valid)}</output></>;
}
const dna: DnaView = { id: "d1", owner: OWNER, title: "Meu DNA", palette: [], cardLayout: "AMPLIADO", targetElement: "DNA_COMPLETO", visibility: "PRIVATE", status: "DRAFT", cells: ["s1", "s2"].map((id) => ({ cell: id, schemeId: id, title: id, occasion: [], style: [], milestone: false, pieces: [] })), logos: [], counters: { likes: 0, comments: 0, shares: 0, remixes: 0 }, canEdit: true };

describe("RF5/RF13 seal verification", () => {
  it("RF5 retries errors and invalidates selections when the composition changes", async () => {
    let fail = true;
    loggedAs(undefined, { "POST /api/seal-suggestions/preview": () => fail ? new Response(JSON.stringify({ message: "offline" }), { status: 503 }) : { suggestions: [brand] } });
    const view = renderApp(<Harness />);
    await screen.findByText(/Não deu para pesquisar os selos agora/i);
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Verificar selos" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /Marca teste/ }));
    expect(screen.getByTestId("requests").textContent).toContain("brand1");
    view.rerender(<Harness ids={["p3"]} />);
    expect(screen.getByTestId("requests").textContent).toBe("[]");
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /Marca teste/ }).getAttribute("aria-checked")).toBe("false"));
  });
  it("RF5 requires image consent before a celebrity request can be sent", async () => {
    loggedAs(undefined, { "POST /api/seal-suggestions/preview": { suggestions: [celeb] } });
    renderApp(<Harness />);
    fireEvent.click(await screen.findByRole("checkbox", { name: /Celebridade teste/ }));
    expect(screen.getByTestId("valid").textContent).toBe("false");
    expect(screen.getByTestId("requests").textContent).toBe("[]");
    fireEvent.click(screen.getByRole("checkbox", { name: /imagem/i }));
    expect(JSON.parse(screen.getByTestId("requests").textContent!)).toEqual([{ targetOwnerId: "celeb1", imageRightsConsent: true }]);
  });
  it("RF5 exposes verification in Details and sends only the selected brand after saving", async () => {
    const { calls } = loggedAs(undefined, {
      "GET /api/schemes/builder": { totalPieces: 2, status: "OK", lists: { upper: [PIECE], lower: [PIECE_2] }, defaultVisibility: "PRIVATE" },
      "POST /api/seal-suggestions/preview": { suggestions: [brand] },
      "PUT /api/schemes/s1": { scheme: SCHEME },
      "POST /api/schemes/s1/seal-bonds": { status: "PENDING_REVIEW" },
    });
    renderApp(<SchemeBuilder initial={SCHEME} />);
    fireEvent.click(await screen.findByRole("button", { name: /Detalhes/ }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /Marca teste/ }));
    fireEvent.click(screen.getByRole("button", { name: /Revisar/ }));
    const save = screen.getAllByRole("button", { name: /Salvar/ }).find((b) => b.classList.contains("btn-primary"))!;
    fireEvent.click(save);
    await waitFor(() => expect(calls.some((c) => c.path === "/api/schemes/s1/seal-bonds")).toBe(true));
    expect(calls.find((c) => c.path === "/api/seal-suggestions/preview")?.body).toMatchObject({ pieceIds: ["p1", "p2"], occasion: SCHEME.occasion, style: SCHEME.style, background: { cardSkin: "atelier", layoutAnatomy: "LISTA_VERTICAL" } });
  });
  it("RF13 checks both looks, shows existing approval, and sends the selected bond on save", async () => {
    const { calls } = loggedAs(undefined, {
      "GET /api/dna-schemes/builder": { totalSchemes: 2, status: "OK", schemes: [{ ...SCHEME, id: "s1" }, { ...SCHEME, id: "s2" }], defaultVisibility: "PRIVATE" },
      "POST /api/dna-schemes/preview": dna,
      "GET /api/schemes/s1/seal-preview": { suggestions: [brand], bonds: [] },
      "GET /api/schemes/s2/seal-preview": { suggestions: [], bonds: [{ id: "bond1", name: "Outra marca", status: "APPROVED" }] },
      "PUT /api/dna-schemes/d1": dna,
      "POST /api/schemes/s1/seal-bonds": { status: "PENDING_REVIEW" },
    });
    renderApp(<DnaBuilder initial={dna} />);
    fireEvent.click(await screen.findByRole("button", { name: /Detalhes/ }));
    await screen.findByText("Outra marca · Aprovado");
    fireEvent.click(await screen.findByRole("checkbox", { name: /Marca teste/ }));
    fireEvent.click(screen.getByRole("button", { name: /Revisar/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Salvar" }).find((b) => b.classList.contains("btn-primary"))!);
    await waitFor(() => expect(calls.some((c) => c.path === "/api/schemes/s1/seal-bonds")).toBe(true));
    expect(calls.find((c) => c.path === "/api/schemes/s1/seal-bonds")?.body).toEqual({ targetOwnerId: "brand1" });
    expect(calls.some((c) => c.path === "/api/schemes/s2/seal-bonds")).toBe(false);
  });
});
