import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody } from "./compose";
import { DEFAULT_BODY } from "../body-spec";
import { baseNormals } from "./three-human";
import { bodyParam, garmentGeometry, SPECS, texturedGeometry } from "./garments";
import { shirtPlacket } from "./garment-trims";
const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
it("places seven buttons on the fitted centre-front from neckline to hem on both body shapes", () => {
 for (const sex of ["FEMININO", "MASCULINO"] as const) {
  const c = compose(asset, fitBody(asset, { sex }).z, null, DEFAULT_BODY[sex].stature), P = bodyParam(asset,c);
  const gg = garmentGeometry(asset,c,baseNormals(c.body,asset.body.index,asset.body.renderVertex),P,SPECS.shirt)!;
  const parts = shirtPlacket(asset,c,P,gg); expect(parts.map(p=>p.part)).toEqual(["carcela","costura","botoes","botoes-borda","gola-ponta"]);
  const buttons=parts[2];expect(buttons.position.length / 3).toBe(7 * 13);
  for(let i=0;i<buttons.position.length/3;i++) {
   expect(Math.abs(buttons.position[i*3])).toBeLessThanOrEqual(.0051);
   expect(buttons.position[i*3+2]).toBeGreaterThan(P.torsoZ);
   expect(buttons.skinWeight.slice(i*4,i*4+4).reduce((a,b)=>a+b,0)).toBeCloseTo(1);
  }
  // aro dos botões em volta de cada disco (5–6,3 mm) e pontas da gola deitadas no peito, uma de cada lado, abaixo do decote
  const rims=parts[3]; expect(rims.position.length/3).toBe(7*24);
  const collar=parts[4]; expect(collar.position.length/3).toBe(8);
  for (let i=0;i<8;i++) { expect(collar.position[i*3+2]).toBeGreaterThan(P.torsoZ); expect(collar.skinWeight.slice(i*4,i*4+4).reduce((a,b)=>a+b,0)).toBeCloseTo(1); }
  expect(Math.sign(collar.position[0])).toBe(-1); expect(Math.sign(collar.position[4*3])).toBe(1);
  // a frente da camisa recebe a foto (cor e padrão reais); a carcela e os botões 3D vêm por cima
  const photo={width:100,height:100,box:{x0:0,y0:0,x1:100,y1:100},collarRow:null,neckDrop:null,cutout:true,backdrop:null,widthAt:()=>({x0:0,x1:100})};
  const geometry=texturedGeometry(gg,gg.position,photo);
  expect([...geometry.getAttribute("photoWeight").array].some(w=>w>0.5)).toBe(true);geometry.dispose();
 }
});
