import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { baseNormals } from "./three-human";
import { SPECS, specOf, garmentMaterial, bodyParam, garmentGeometry, posedPositions, texturedGeometry } from "./garments";
import { asset, dressed, inside } from "./test-utils/garments-kit";

describe("cargo trouser construction", () => {
  it("raises the waist and distinguishes relaxed volume from ordinary pants", () => {
    const regular = specOf({ subcategory: "Calça cargo" })!;
    const relaxed = specOf({ subcategory: "Calça cargo", name: "Loose Fit Cargo Pants" })!;
    expect(regular.waist).toBeGreaterThan(SPECS.pants.waist);
    expect(regular.ease).toBeGreaterThan(SPECS.pants.ease);
    expect(relaxed.ease).toBeGreaterThan(regular.ease);
    expect(relaxed.flare).toBeGreaterThan(regular.flare);
    expect(specOf({ subcategory: "jeans" })).toEqual(SPECS.pants);
    expect(SPECS.pants.waist).toBe(.18);
  });
  it("uses matte workwear material rather than glossy thin cloth", () => {
    const texture = new THREE.Texture();
    const cargo = garmentMaterial(texture, specOf({ subcategory: "cargo" })!);
    expect(cargo.roughness).toBe(.94);
    expect(cargo.sheen).toBe(.08);
    cargo.dispose(); texture.dispose();
  });
});

it("builds cargo on both body shapes with continuous fabric instead of a front photo decal", () => {
  for (const sex of ["FEMININO", "MASCULINO"] as const) {
    const { c, h } = dressed(sex, ["pants"]);
    const P = bodyParam(asset, c), normals = baseNormals(c.body, asset.body.index, asset.body.renderVertex);
    const g = garmentGeometry(asset, c, normals, P, specOf({ subcategory: "cargo", name: "Loose fit" })!)!;
    expect(g.position.length).toBeGreaterThan(0);
    expect(inside(c.body, normals, g.position, g.alpha)).toBeLessThan(.02);
    const mesh = texturedGeometry(g, posedPositions(h.skeleton, h.body.bindMatrix, g.position, g.skinIndex, g.skinWeight), null);
    expect(Array.from(mesh.getAttribute("photoWeight").array).every(weight => weight === 0)).toBe(true);
    expect(Array.from(mesh.getAttribute("position").array).every(Number.isFinite)).toBe(true);
    mesh.dispose(); h.dispose();
  }
});

it("a foto da peça vai para a frente do corpo mesmo com o personagem girado na cena (Meu Quarto começa de costas)", () => {
  const { c, h } = dressed("FEMININO", ["tee"]);
  const P = bodyParam(asset, c), normals = baseNormals(c.body, asset.body.index, asset.body.renderVertex);
  const g = garmentGeometry(asset, c, normals, P, specOf({ subcategory: "t_shirt" })!)!;
  const still = posedPositions(h.skeleton, h.body.bindMatrix, g.position, g.skinIndex, g.skinWeight, h.body);
  const room = new THREE.Group(); room.add(h.root); room.position.set(0.6, 0, 2.2); room.rotation.y = Math.PI; room.updateMatrixWorld(true);
  const turned = posedPositions(h.skeleton, h.body.bindMatrix, g.position, g.skinIndex, g.skinWeight, h.body);
  for (let i = 0; i < still.length; i++) expect(turned[i]).toBeCloseTo(still[i], 4);              // mesmo resultado, girado ou não
  const world = posedPositions(h.skeleton, h.body.bindMatrix, g.position, g.skinIndex, g.skinWeight);
  expect(Math.abs(world[2] - still[2]) + Math.abs(world[0] - still[0])).toBeGreaterThan(0.1);      // sem o espaço do corpo, a pose vinha girada
  room.remove(h.root); h.dispose();
});

it("preserves the actual cargo photograph rather than discarding every pocket and logo",()=>{
 const {c,h}=dressed("FEMININO",["pants"]),P=bodyParam(asset,c);
 const gg=garmentGeometry(asset,c,baseNormals(c.body,asset.body.index,asset.body.renderVertex),P,specOf({subcategory:"cargo_pants"})!)!;
 const photo={width:100,height:100,box:{x0:0,y0:0,x1:100,y1:100},collarRow:null,neckDrop:null,cutout:true,backdrop:null,widthAt:()=>({x0:0,x1:100})};
 const mesh=texturedGeometry(gg,gg.position,photo);
 expect([...mesh.getAttribute('photoWeight').array].filter(w=>w>.5).length).toBeGreaterThan(100);
 expect([...mesh.getAttribute('fabricUv').array].every(Number.isFinite)).toBe(true);
 mesh.dispose();h.dispose();
});

it("maps separated trouser photographs to the corresponding leg panel",()=>{
 const pos:number[]=[],idx:number[]=[];
 for(const side of [-1,1]){
  const start=pos.length/3;
  for(let row=0;row<=50;row++)for(let col=0;col<=2;col++)pos.push(side<0?-.3+col*.1:.1+col*.1,row*.02,0);
  for(let row=0;row<50;row++)for(let col=0;col<2;col++){const i=start+row*3+col;idx.push(i,i+1,i+3,i+1,i+4,i+3);}
 }
 const gg={spec:SPECS.pants,position:Float32Array.from(pos),alpha:new Float32Array(pos.length/3).fill(1),index:Uint32Array.from(idx),source:new Int32Array(pos.length/3),skinIndex:new Uint16Array(pos.length/3*4),skinWeight:new Float32Array(pos.length/3*4)};
 const photo={width:100,height:100,box:{x0:0,y0:0,x1:100,y1:100},collarRow:null,neckDrop:null,cutout:true,backdrop:null,widthAt:()=>({x0:10,x1:90}),legRows:[40,50,60,70,80,90].map(y=>({y,left:{x0:10,x1:35},right:{x0:65,x1:90}}))};
 const mesh=texturedGeometry(gg,gg.position,photo),p=mesh.getAttribute('position'),uv=mesh.getAttribute('uv');let checked=0;
 for(let v=0;v<p.count;v++)if(p.getY(v)>.15&&p.getY(v)<.45&&Math.abs(Math.abs(p.getX(v))-.2)<.001){
  expect(uv.getX(v)).toBeCloseTo(p.getX(v)<0?.1125:.3875,3);checked++;
 }
 expect(checked).toBeGreaterThan(2);mesh.dispose();
});
