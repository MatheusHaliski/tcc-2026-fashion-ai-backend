// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, renderApp } from "@/test-utils/render";
import { CardFashionMeta } from "./card-fashion-meta";
import { CardOccasionIcons, CardPieceIcons } from "./card-meta-icons";

afterEach(cleanup);

it("PEÇAS: uma mini-ilustração por peça (asset padrão da categoria na cor da peça), com o nome no rótulo e +N no excesso", () => {
  const pieces = Array.from({ length: 8 }, (_, i) => ({ name: `Peça ${i + 1}`, category: "upper_piece", subcategory: "t_shirt", colorHex: "#112233", color: "black" }));
  const { container } = renderApp(<CardPieceIcons pieces={pieces} />);
  const imgs = [...container.querySelectorAll<HTMLImageElement>(".card-piece-icon img")];
  expect(imgs).toHaveLength(6);
  expect(imgs[0].alt).toContain("Peça 1");
  expect(imgs[0].getAttribute("src")).toContain("/api/catalog/default-asset?category=upper_piece&subcategory=t_shirt&color=%23112233");
  expect(container.querySelector(".card-meta-more")?.textContent).toBe("+2");
  expect(container.querySelector(".card-piece-icons")?.getAttribute("aria-label")).toContain("Peça 8");
});

it("ocasião conhecida vira ícone FAI; a desconhecida continua em texto", () => {
  const { container } = renderApp(<CardOccasionIcons values={["work", "casamento"]} />);
  expect(container.querySelector('img[alt="Trabalho"]')).toBeTruthy();
  expect(container.querySelector(".card-occasion-text")?.textContent).toBeTruthy();
});

it("cores: uma cor mostra amostra + nome; várias mostram só as amostras, com o nome no rótulo de cada uma", () => {
  const uma = renderApp(<CardFashionMeta colors={[{ name: "black", hex: "#111111" }]} />);
  expect(uma.container.querySelector(".pc-info-color")?.textContent).toBe("Preto");
  cleanup();
  const varias = renderApp(<CardFashionMeta colors={[{ name: "black", hex: "#111111" }, { name: "white", hex: "#ffffff" }, { name: "blue" }]} />);
  const cores = [...varias.container.querySelectorAll(".pc-info-color")];
  expect(cores.map((c) => c.textContent)).toEqual(["", "", "Azul"]);
  expect(cores[0].querySelector("i")?.getAttribute("aria-label")).toBe("Preto");
});
