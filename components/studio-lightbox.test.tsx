// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderApp } from "@/test-utils/render";
import { StudioLightbox } from "./studio";

afterEach(cleanup);

describe("StudioLightbox", () => {
  it("foto oficial com recorte semântico abre em tela cheia com o mesmo recorte, não a foto inteira", () => {
    const crop = { url: "https://img.brand.com/a.jpg", mode: "SEMANTIC_CROP" as const, crop: { x: 0.25, y: 0.1, w: 0.5, h: 0.625 }, background: "#f6f6f6" };
    const { container } = renderApp(<StudioLightbox images={[{ src: crop.url, alt: "Camiseta", crop }]} edge="#fff" onClose={() => {}} />);
    const img = container.ownerDocument.querySelector("[data-mode='semantic-crop'] img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(crop.url);
    expect(img.style.width).toBe("200%");
  });

  it("sem recorte mostra a foto inteira contida", () => {
    const { container } = renderApp(<StudioLightbox images={[{ src: "https://media.fashion-ai.app/x.jpg", alt: "Peça" }]} edge="#fff" onClose={() => {}} />);
    expect(container.ownerDocument.querySelector("[data-mode='semantic-crop']")).toBeNull();
    expect(container.ownerDocument.querySelector("img.object-contain")?.getAttribute("src")).toBe("https://media.fashion-ai.app/x.jpg");
  });
});
