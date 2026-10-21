// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { CatalogPhoto, pieceCatalogCrop, pieceCatalogSource, semanticCropStyle, photoAspect, piecePhotoAspect } from "./catalog-photo";
import { mediaUrl } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";

describe("semanticCropStyle", () => {
  it("mostra só o recorte 4:5 da foto original, sem esticar", () => {
    const s = semanticCropStyle({ x: 0.25, y: 0.1, w: 0.5, h: 0.625 });
    expect(s.width).toBe("200%");
    expect(s.left).toBe("-50%");
    expect(s.top).toBe("-16%");
    expect(s.height).toBe("160%");   // altura explícita: a <img> lazy não fica com altura 0 fora do quadro
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

  it("Total frame: a peça inteira no quadro a partir da caixa da peça, sem o recorte de tecido", () => {
    const image = { url: "https://media.fashion-ai.app/card.jpg", mode: "PROCESSED" as const, sourceUrl: "https://img.brand.com/s.jpg",
      whole: { url: "https://img.brand.com/s.jpg", box: { x: 0.12, y: 0.19, w: 0.75, h: 0.6 }, background: "#ffffff", width: 864, height: 1152 } };
    const { container } = render(<CatalogPhoto alt="" image={image} framing="WHOLE" />);
    const wrap = container.querySelector("[data-mode='whole']") as HTMLElement;
    expect(wrap.className).toContain("is-blend");                       // fundo branco se funde ao fundo do quadro
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("https://img.brand.com/s.jpg");
    expect(img.style.position).toBe("absolute");
    expect(parseFloat(img.style.width)).toBeGreaterThan(100);           // a foto inteira, escalada para a peça caber
    // o mesmo card no modo de sempre continua no master recortado
    const fabric = render(<CatalogPhoto alt="" image={image} />);
    expect(fabric.container.querySelector("[data-mode='processed']")).not.toBeNull();
  });

  it("Peça inteira sem a peça recortada (foto com modelo) mostra o enquadramento de tecido, nunca a foto original com a pessoa", () => {
    const crop = { url: "https://img.brand.com/a.jpg", sourceUrl: "https://img.brand.com/modelo.jpg", mode: "SEMANTIC_CROP" as const, crop: { x: 0.2, y: 0.1, w: 0.6, h: 0.75 } };
    const a = render(<CatalogPhoto alt="" image={crop} framing="WHOLE" requiredFrame />);
    expect(a.container.querySelector("[data-mode='semantic-crop']")).not.toBeNull();
    expect(a.container.querySelector("[data-mode='whole-original']")).toBeNull();
    const processed = render(<CatalogPhoto alt="" image={{ url: "https://media.fashion-ai.app/card.jpg", sourceUrl: "https://img.brand.com/modelo.jpg", mode: "PROCESSED" }} framing="WHOLE" />);
    expect(processed.container.querySelector("img")?.getAttribute("src")).toContain("card.jpg");
    fireEvent.error(processed.container.querySelector("img")!);
    expect(processed.container.querySelector("img[src*='modelo.jpg']")).toBeNull();
    const withWhole = { ...crop, whole: { url: "https://img.brand.com/a.jpg", box: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }, background: "#eeeeee", width: 800, height: 800 } };
    const b = render(<CatalogPhoto alt="" image={withWhole} framing="WHOLE" />);
    fireEvent.error(b.container.querySelector("img")!);
    expect(b.container.querySelector("[data-mode='whole-original']")).not.toBeNull();
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

describe("CatalogPhoto sem foto quebrada", () => {
  it("se a foto processada não carrega, mostra a seguinte (a original da marca); se nenhuma carrega, a ilustração", () => {
    const { container } = render(<CatalogPhoto alt="Camiseta" image={{ url: "/media/catalog/card.webp", mode: "PROCESSED" }}
      fallbackUrl="/media/catalog/card.webp" alternatives={["https://img.brand.com/original.jpg", null]} placeholder={<span data-testid="glyph" />} />);
    const img = () => container.querySelector("img");
    expect(img()?.getAttribute("src")).toBe(mediaUrl("/media/catalog/card.webp"));
    fireEvent.error(img()!);
    expect(img()?.getAttribute("src")).toBe("https://img.brand.com/original.jpg");
    fireEvent.error(img()!);
    expect(img()).toBeNull();
    expect(container.querySelector("[data-testid=glyph]")).toBeTruthy();
  });

  it("recorte semântico que não carrega cai na foto original inteira, sem repetir a URL que falhou", () => {
    const { container } = render(<CatalogPhoto alt="Calça" image={{ url: "https://img.brand.com/a.jpg", mode: "SEMANTIC_CROP", crop: { x: 0.2, y: 0.1, w: 0.6, h: 0.75 } }}
      fallbackUrl="https://img.brand.com/a.jpg" alternatives={["https://img.brand.com/b.jpg"]} />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://img.brand.com/b.jpg");
    expect(container.querySelector("[data-mode=semantic-crop]")).toBeNull();
  });
});

describe("pieceCatalogCrop", () => {
  const card = { url: "https://img.brand.com/a.jpg", mode: "SEMANTIC_CROP" as const, crop: { x: 0.2, y: 0.1, w: 0.6, h: 0.75 }, background: "#f6f6f6" };
  const piece = (imageUrl: string, catalogImage: unknown) => ({ imageUrl, flatLayMetadata: { catalogImage } }) as unknown as PieceView;

  it("peça do catálogo com a foto oficial herda o recorte do card", () => {
    expect(pieceCatalogCrop(piece(card.url, card))).toEqual(card);
  });

  it("foto própria da pessoa ou master processado não recebem recorte", () => {
    expect(pieceCatalogCrop(piece("https://media.fashion-ai.app/minha.jpg", card))).toBeNull();
    expect(pieceCatalogCrop(piece(card.url, { ...card, mode: "PROCESSED" }))).toBeNull();
    expect(pieceCatalogCrop(piece(card.url, undefined))).toBeNull();
  });
});


describe("proporção do recorte de tecido", () => {
  it("mantém o quadril 2:1 e usa o retrato para metadados antigos ou inválidos", () => {
    expect(photoAspect("2:1")).toBe("2 / 1");
    expect(photoAspect("4:5")).toBe("4 / 5");
    for (const invalid of [undefined, "oops", "2:0", "100:1"]) expect(photoAspect(invalid)).toBe("4 / 5");
  });

  it("a proporção acompanha a foto aprovada e não se aplica a uma foto substituída", () => {
    const piece = { imageUrl: "official.jpg", flatLayMetadata: { catalogImage: { url: "official.jpg", aspect: "2:1" }, studio: { feed: { aspect: "4:5" } } } } as unknown as PieceView;
    expect(piecePhotoAspect(piece)).toBe("2 / 1");
    expect(piecePhotoAspect({ ...piece, imageUrl: "my-photo.jpg" })).toBe("4 / 5");
    expect(piecePhotoAspect({ ...piece, studioFeedUrl: "studio.feed.jpg" })).toBe("4 / 5");
  });
});


describe("CatalogPhoto transporte de mídia", () => {
  it("resolve a imagem processada e alternativas /media no backend", () => {
    const { container } = render(<CatalogPhoto alt="Peça" image={{ url: "/media/catalog/card.webp", mode: "PROCESSED" }} alternatives={["/media/catalog/original.jpg"]} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(mediaUrl("/media/catalog/card.webp"));
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(mediaUrl("/media/catalog/original.jpg"));
  });
  it("resolve também o recorte semântico sem alterar o enquadramento", () => {
    const { container } = render(<CatalogPhoto alt="Peça" image={{ url: "/media/catalog/original.jpg", mode: "SEMANTIC_CROP", crop: { x: 0, y: 0, w: 1, h: 1 } }} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(mediaUrl("/media/catalog/original.jpg"));
    expect(container.querySelector("[data-mode=semantic-crop]")).not.toBeNull();
  });
});


describe("foto oficial preservada", () => {
  it("recupera um master indisponível pela origem oficial sem precisar de alternativas extras", () => {
    const { container } = render(<CatalogPhoto alt="Peça" image={{ url: "/media/missing.webp", sourceUrl: "https://brand.example/original.jpg", mode: "PROCESSED" }} />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://brand.example/original.jpg");
  });
  it("não reutiliza a origem oficial depois que o usuário troca a foto", () => {
    const piece = { imageUrl: "master.webp", flatLayMetadata: { catalogImage: { url: "master.webp", sourceUrl: "official.jpg" } } } as unknown as PieceView;
    expect(pieceCatalogSource(piece)).toBe("official.jpg");
    expect(pieceCatalogSource({ ...piece, imageUrl: "user.jpg" })).toBeUndefined();
  });
});

// Required catalog framing never falls back to an unprocessed source.
it("enquadramento obrigatório oculta a original ao falhar",()=>{
 const {container}=render(<CatalogPhoto requiredFrame alt="Peça" image={{url:"/media/framed.jpg",mode:"PROCESSED",sourceUrl:"https://brand.example/raw.jpg"}} fallbackUrl="https://brand.example/raw.jpg"/>);
 fireEvent.error(container.querySelector('img')!);
 expect(container.querySelector('img')).toBeNull();
 expect(container.querySelector('[role="alert"]')).toBeTruthy();
});

it("retries an unavailable required image without exposing an unframed source", () => {
  let retries = 0;
  const props = { requiredFrame: true, alt: "Cargo", image: { url: "/media/cargo.webp", mode: "PROCESSED" as const }, onRetry: () => { retries++; } };
  const result = render(<CatalogPhoto {...props} />);
  fireEvent.error(result.container.querySelector("img")!);
  fireEvent.click(result.container.querySelector("button")!);
  expect(retries).toBe(1);
  expect(result.container.querySelector("img")?.getAttribute("src")).toBe(mediaUrl(props.image.url));
  result.rerender(<CatalogPhoto {...props} framing="WHOLE" />);
  result.rerender(<CatalogPhoto {...props} framing="FABRIC" />);
  expect(result.container.querySelector("[role=alert]")).toBeNull();
});
