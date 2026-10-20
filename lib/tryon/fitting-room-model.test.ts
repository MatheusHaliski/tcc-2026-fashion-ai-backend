import { describe, expect, it } from "vitest";
import { fromCatalog, fromWardrobe, toLook3d } from "./fitting-room-model";
import type { CatalogProduct } from "@/lib/api/catalog";
import type { PieceView } from "@/lib/api/types";
import { specFor } from "@/lib/avatar3d/human/garment-fit";

describe("product data survives the fitting adapters",()=>{
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
});
