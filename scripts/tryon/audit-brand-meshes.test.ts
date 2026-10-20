/** CLI: FAI_BRAND_MESH_REPORT=work/brand-meshes.json npx vitest run scripts/tryon/audit-brand-meshes.test.ts */
import { existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { expect,it } from 'vitest';
import { auditBrandMeshes,type BrandMeshInput } from '@/lib/tryon/brand-mesh-audit';
const output=process.env.FAI_BRAND_MESH_REPORT;
it.skipIf(!output)('audits local catalogue snapshots by brand without mutating source data or approving assets',()=>{
 const taxonomy=JSON.parse(readFileSync('fai-application/src/main/resources/taxonomy/taxonomy.json','utf8'));
 const categories=new Map<string,string>(taxonomy.subcategories.map((s:{code:string;category:string})=>[s.code,s.category]));
 const inputs:BrandMeshInput[]=[];
 for(const folder of ['data/catalog/products','data/catalog/expansion/products'])if(existsSync(folder))for(const file of readdirSync(folder).filter(f=>/\.jsonl?$/.test(f))){
  const text=readFileSync(`${folder}/${file}`,'utf8');
  const records=file.endsWith('.jsonl')?text.split('\n').filter(Boolean).map(l=>JSON.parse(l)):JSON.parse(text);
  if(!Array.isArray(records))continue;
  for(const p of records){
   const brand=typeof p.brand==='string'?p.brand:p.brand?.name??file.replace(/\.jsonl?$/,'');
   const name=p.product_name??p.productName;if(!name)continue;
   const id=[p.id,p.official_product_url,p.sku].find(v=>typeof v==='string'&&v.trim())??`${p.subcategory}:${name}`;
   inputs.push({id:String(id),brandName:brand,name,slot:'',category:p.category??categories.get(p.subcategory),subcategory:p.subcategory,material:p.material??null,variation:p.variation??p.variation_code??null,attributes:p.attributes??null,imageUrl:p.imageUrl??p.images?.[0]?.url??null});
  }
 }
 const report=auditBrandMeshes(inputs);expect(report.products).toBeGreaterThan(0);
 expect(report.brands.every(b=>b.invalidGeometryConfig===0)).toBe(true);
 const dest=resolve(output!);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({products:report.products,brands:report.brands.length,invalidConfigs:report.brands.reduce((n,b)=>n+b.invalidGeometryConfig,0),output:dest}));
});
