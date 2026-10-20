import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody } from "./compose";
import { DEFAULT_BODY } from "../body-spec";
import { baseNormals } from "./three-human";
import { bodyParam, fabricSurface, garmentMaterial, type GarmentSpec } from "./garments";
import { buildGarment, softBodyOf } from "./dress";
import { specFor } from "./garment-fit";
import * as THREE from "three";

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

describe("final garment clearance on the actual avatar mesh", () => {
  it.each(["MASCULINO", "FEMININO"] as const)("keeps jeans, shirt and jacket outside source skin after all deformation on %s", sex => {
    const c = compose(asset, fitBody(asset, { sex }).z, null, DEFAULT_BODY[sex].stature);
    const original=c.body.slice(), P=bodyParam(asset,c), soft=softBodyOf(asset,c);
    const normals=baseNormals(c.body,asset.body.index,asset.body.renderVertex);
    const below: GarmentSpec[]=[];
    for (const subcategory of ["jeans","shirt","jacket"]) {
      const spec=specFor({subcategory,attributes:{RISE:["HIGH_RISE"]}})!;
      const {gg,under}=buildGarment(asset,c,soft,normals,P,spec,below);
      expect(gg).not.toBeNull();let checked=0;
      for(let v=0;v<gg!.source.length;v++) {
        const src=gg!.source[v];if(src<0 || gg!.alpha[v]<.5)continue;
        const j=src*3,i=v*3,norm=Math.hypot(normals[j],normals[j+1],normals[j+2]);
        if(norm<1e-8)continue;
        const d=((gg!.position[i]-c.body[j])*normals[j]+(gg!.position[i+1]-c.body[j+1])*normals[j+1]+(gg!.position[i+2]-c.body[j+2])*normals[j+2])/norm;
        expect(d).toBeGreaterThanOrEqual(Math.max(.003,spec.ease*.55)+(under?.ease[src]??0)-1e-6);
        checked++;
      }
      expect(checked).toBeGreaterThan(100);below.push(spec);
    }
    expect(c.body).toEqual(original);
  });
  it("uses the declared material appearance without tinting the product texture",()=>{
    const tex=new THREE.Texture();
    const denim=garmentMaterial(tex,specFor({subcategory:"jeans",material:"DENIM"})!);
    const silk=garmentMaterial(tex,specFor({subcategory:"shirt",material:"SILK"})!);
    expect(denim.roughness).toBeGreaterThan(silk.roughness);
    expect(silk.map).toBe(tex);expect(silk.color.getHexString()).toBe("ffffff");
    expect(fabricSurface("UNKNOWN")).toBeNull();
    denim.dispose();silk.dispose();tex.dispose();
  });
});
