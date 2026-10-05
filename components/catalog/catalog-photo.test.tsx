// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CatalogPhoto, semanticCropStyle } from "./catalog-photo";

describe("semanticCropStyle", () => {
  it("mostra só o recorte 4:5 da foto original, sem esticar", () => {
    const s = semanticCropStyle({ x: 0.25, y: 0.1, w: 0.5, h: 0.625 });
    expect(s.width).toBe("200%");
    expect(s.left).toBe("-50%");
    expect(s.top).toBe("-16%");
    expect(s.height).toBe("auto");
  });

  it("recorte que passa da borda (smartPadding) desloca a foto para dentro", () => {
    const s = semanticCropStyle({ x: -0.1, y: -0.05, w: 1.2, h: 1.1 });
    expect(parseFloat(String(s.left))).toBeGreaterThan(0);
    expect(parseFloat(String(s.top))).toBeGreaterThan(0);
  });
});

describe("CatalogPhoto", () => {
  it("usa a URL original da marca com o recorte e o fundo da foto", () => {
    const { container } = render(<CatalogPhoto alt="Camiseta" image={{ url: "https://img.brand.com/a.jpg", mode: "SEMANTIC_CROP", crop: { x: 0.2, y: 0.1, w: 0.6, h: 0.75 }, background: "#f6f6f6" }} />);
    const wrap = container.querySelector("[data-mode='semantic-crop']") as HTMLElement;
    expect(wrap.style.background).toContain("246");
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://img.brand.com/a.jpg");
  });

  it("sem canônica mostra a foto inteira contida; master processado também", () => {
    const a = render(<CatalogPhoto alt="" fallbackUrl="https://img.brand.com/b.jpg" />);
    expect(a.container.querySelector("[data-mode='original']")).not.toBeNull();
    const b = render(<CatalogPhoto alt="" image={{ url: "https://media.fashion-ai.app/card.jpg", mode: "PROCESSED" }} />);
    expect(b.container.querySelector("[data-mode='processed']")).not.toBeNull();
    const c = render(<CatalogPhoto alt="" />);
    expect(c.container.innerHTML).toBe("");
  });
});
