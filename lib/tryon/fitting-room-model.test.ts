import { describe, expect, it } from "vitest";
import { fromCatalog, fromWardrobe, processedImageOf, toLook3d } from "./fitting-room-model";
import type { CatalogProduct } from "@/lib/api/catalog";
import type { PieceView } from "@/lib/api/types";
import { specFor } from "@/lib/avatar3d/human/garment-fit";

describe("product data survives the fitting adapters",()=>{
  it("never paints the fabric card or an unrelated processed photograph on a garment", () => {
    const product = { id: "shorts", productName: "Bermuda", category: "lower_piece", subcategory: "shorts", imageUrl: "/media/fabric.jpg",
      catalogImage: { url: "/media/fabric.jpg", mode: "PROCESSED", imageId: "shorts-photo", sourceUrl: "https://brand.example/shorts.jpg" },
      images: [{ id: "shoe-photo", primary: true, processedUrl: "/media/shoe.jpg" }] } as unknown as CatalogProduct;
    expect(processedImageOf(product)).toBeNull();
    expect(fromCatalog(product, null, undefined)?.imageUrl).toBe("https://brand.example/shorts.jpg");
    product.catalogImage!.whole = { url: "/media/whole-shorts.png", box: { x: 0, y: 0, w: 1, h: 1 }, processed: true, rendered: true };
    expect(processedImageOf(product)).toBe("/media/whole-shorts.png");
  });
  it("keeps catalogue material, product color and high-rise name through to the render spec",()=>{
    const product={id:"jeans",brand:null,productName:"Jeans cintura alta",category:"lower_piece",subcategory:"jeans",material:"DENIM",colorHex:"#234567",variation:"SKINNY",attributes:{RISE:["LOW_RISE"]}} as CatalogProduct;
    const fitting=fromCatalog(product,null,undefined)!;
    const render=toLook3d(fitting);
    expect(render.material).toBe("DENIM");expect(render.colorHex).toBe("#234567");
    expect(specFor(render)!.fabric).toBe("DENIM");expect(specFor(render)!.waist).toBe(.10);expect(specFor(render)!.legColumn).toBe(0);
  });
  it("keeps wardrobe closures, sleeve lengths, material and original photograph",()=>{
    const piece={id:"shirt",name:"Camisa",category:"upper_piece",subcategory:"shirt",material:"SILK",imageUrl:"/shirt.webp",attributes:{CLOSURE:["ZIPPER"],SLEEVE_LENGTH:["SHORT_SLEEVE"]}} as unknown as PieceView;
    const render=toLook3d(fromWardrobe({piece,slot:"upper_piece",wear:"TOP"}));
    expect(render.imageUrl).toBe("/shirt.webp");expect(render.material).toBe("SILK");
    expect(specFor(render)).toMatchObject({placket:false,sleeve:.33,fabric:"SILK"});
  });
  it("treats a processed-only product photograph as its own artwork, not a default", () => {
    const product = { id: "logo-shirt", brand: null, productName: "Camisa", category: "upper_piece", subcategory: "shirt", imageUrl: null, processedUrl: "/media/unique-shirt.png" } as unknown as CatalogProduct;
    const fitting = fromCatalog(product, null, undefined)!;
    const render = toLook3d({ ...fitting, imageUrl: null, processedUrl: "/media/unique-shirt.png" });
    expect(render.defaultImage).toBe(false);
    expect(render.studioUrl).toBe("/media/unique-shirt.png");
    expect(toLook3d({ ...fitting, imageUrl: null, processedUrl: null }).defaultImage).toBe(true);
  });
});
