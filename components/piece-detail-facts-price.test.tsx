// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, loggedAs, renderApp } from "@/test-utils/render";
import { PIECE } from "@/test-utils/fixtures";
import type { PieceView } from "@/lib/api/types";
import { PieceDetailFacts } from "./piece-detail-facts";

afterEach(cleanup);

const keys = (container: HTMLElement) => Array.from(container.querySelectorAll(".c-facts dt")).map((d) => d.textContent);

describe("dados da peça › preço", () => {
  it("peça sem preço (gravado como 0) não mostra \"R$ 0,00\"", () => {
    loggedAs();
    const { container } = renderApp(<PieceDetailFacts piece={{ ...PIECE, price: 0, forSale: false } as PieceView} />);
    expect(keys(container)).not.toContain("Preço");
    expect(container.textContent).not.toMatch(/R\$\s?0,00/);
  });

  it("peça com preço mostra o valor", () => {
    loggedAs();
    const { container } = renderApp(<PieceDetailFacts piece={{ ...PIECE, price: 129.9, forSale: false } as PieceView} />);
    expect(keys(container)).toContain("Preço");
    expect(container.textContent).toMatch(/129,90/);
  });
});
