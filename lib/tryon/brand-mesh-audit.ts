import type { Look3dPiece } from '@/components/three/common';
import { garmentContractOf } from '@/lib/avatar3d/garment-contract';
import { specFor } from '@/lib/avatar3d/human/garment-fit';

export interface BrandMeshInput extends Look3dPiece { brandName: string }
/** Structural readiness only: no pixel comparison, collision measurement or automatic mesh approval. */
export function auditBrandMeshes(products: BrandMeshInput[]) {
 const unique=new Map<string,BrandMeshInput>();
 for(const p of products)unique.set(`${p.brandName}\0${p.id}`,p);
 const brands=new Map<string,{brand:string;products:number;estimated:number;withoutMould:number;missingPhoto:number;missingMaterial:number;missingDimensions:number;invalidGeometryConfig:number}>();
 const rows=[...unique.values()].map(p=>{
  const contract=garmentContractOf(p,{origin:'CATALOG'}),spec=specFor(p);
  const invalid=spec!=null&&[spec.ease,spec.neck,spec.vneck,spec.sleeve,spec.leg,spec.skirt,spec.flare,spec.layer].some(v=>!Number.isFinite(v));
  const brand=brands.get(p.brandName)??{brand:p.brandName,products:0,estimated:0,withoutMould:0,missingPhoto:0,missingMaterial:0,missingDimensions:0,invalidGeometryConfig:0};
  brand.products++;if(contract.quality.approximation)brand.estimated++;
  if(!spec)brand.withoutMould++;if(!contract.surface.photo.value)brand.missingPhoto++;
  if(!contract.fabric.material.value)brand.missingMaterial++;
  if(!contract.dimensions.measurementsCm.value)brand.missingDimensions++;
  if(invalid)brand.invalidGeometryConfig++;brands.set(p.brandName,brand);
  return {brand:p.brandName,id:p.id,name:p.name,subcategory:p.subcategory,path:contract.asset.path,approved:contract.quality.approved,
   fit:spec?{ease:spec.ease,waist:Number.isFinite(spec.waist)?spec.waist:null,sleeve:spec.sleeve,leg:spec.leg}:null,
   missingPhoto:!contract.surface.photo.value,missingMaterial:!contract.fabric.material.value,invalidGeometryConfig:invalid};
 });
 return {scope:'Local catalogue snapshots; structural checks only, not a visual or physical fitting certification.',products:rows.length,brands:[...brands.values()].sort((a,b)=>a.brand.localeCompare(b.brand)),rows};
}
