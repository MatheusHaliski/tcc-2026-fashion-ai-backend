// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { PIECE } from "@/test-utils/fixtures";
import { PieceCard } from "@/components/piece-card";
import { resetSealArtCache } from "@/lib/seals/use-seal-art";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); resetSealArtCache(); });

const design = { mode: "GENERATED", palette: "FAI", element: { id: "HANGER", text: "NK" } };

it("mostra a arte real do selo escolhido (medalhão do emissor), não só o nome", async () => {
  const { calls } = mockApi({ "GET /api/seals/art": { items: { "BRAND:Nike": { name: "Selo Nike", owner: "nike", premium: false, tier: "PECA", iconUrl: null, design } } } });
  const { container } = renderApp(<PieceCard piece={{ ...PIECE, seals: ["BRAND:Nike"] }} mode="preview" />);
  await waitFor(() => expect(container.querySelector(".selected-seal svg, .selected-seal .seal-medallion")).toBeTruthy());
  expect(screen.getByLabelText("Selos selecionados · não verificados").textContent).toContain("Nike");
  expect(calls.filter((c) => c.path.startsWith("/api/seals/art"))).toHaveLength(1);
  expect(calls.find((c) => c.path.startsWith("/api/seals/art"))!.path).toContain("tier=PECA");
});

it("emissor sem selo publicado: o nome continua visível", async () => {
  const { calls } = mockApi({ "GET /api/seals/art": { items: {} } });
  const { container } = renderApp(<PieceCard piece={{ ...PIECE, seals: ["BRAND:Marca nova"] }} mode="preview" />);
  await waitFor(() => expect(calls.some((c) => c.path.startsWith("/api/seals/art"))).toBe(true));
  expect(container.querySelector(".selected-seal")).toBeNull();
  expect(screen.getByLabelText("Selos selecionados · não verificados").textContent).toContain("Marca nova");
});

it("card compacto da peça não repete marca e conservação soltas embaixo do nome", () => {
  mockApi({});
  const { container } = renderApp(<PieceCard piece={{ ...PIECE, seals: [] }} mode="preview" />);
  expect(container.querySelector(".pc-window.is-identity .pc-sub")).toBeNull();
  expect(container.querySelector(".card-fashion-meta")?.textContent).toContain("Nike");
});
