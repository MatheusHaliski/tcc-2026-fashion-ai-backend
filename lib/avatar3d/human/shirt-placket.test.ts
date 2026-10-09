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
  const parts = shirtPlacket(asset,c,P,gg); expect(parts.map(p=>p.part)).toEqual(["carcela","botoes"]);
  const buttons=parts[1];expect(buttons.position.length / 3).toBe(7 * 13);
  for(let i=0;i<buttons.position.length/3;i++) {
   expect(Math.abs(buttons.position[i*3])).toBeLessThanOrEqual(.0041);
   expect(buttons.position[i*3+2]).toBeGreaterThan(P.torsoZ);
   expect(buttons.skinWeight.slice(i*4,i*4+4).reduce((a,b)=>a+b,0)).toBeCloseTo(1);
  }
  const photo={width:100,height:100,box:{x0:0,y0:0,x1:100,y1:100},collarRow:null,widthAt:()=>({x0:0,x1:100})};
  const geometry=texturedGeometry(gg,gg.position,photo);
  expect([...geometry.getAttribute("photoWeight").array].every(w=>w===0)).toBe(true);geometry.dispose();
 }
});
