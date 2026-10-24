import { expect,it } from 'vitest';
import { auditBrandMeshes } from './brand-mesh-audit';
it('keeps brands and products separate and never upgrades estimated moulds to approved meshes',()=>{
 const shirt={id:'same-sku',name:'Camisa',slot:'upper',subcategory:'shirt',material:'LINEN',imageUrl:'/shirt.webp'};
 const r=auditBrandMeshes([{...shirt,brandName:'Marca A'},{...shirt,brandName:'Marca A'},{...shirt,brandName:'Marca B'},{id:'bag',name:'Bolsa',slot:'accessory',subcategory:'handbag',brandName:'Marca B'}]);
 expect(r.products).toBe(3);expect(r.brands).toHaveLength(2);
 expect(r.brands.find(b=>b.brand==='Marca A')).toMatchObject({products:1,estimated:1,missingPhoto:0,missingMaterial:0,missingDimensions:1});
 expect(r.brands.find(b=>b.brand==='Marca B')).toMatchObject({products:2,withoutMould:1,missingPhoto:1});
 expect(r.rows.every(p=>!p.approved)).toBe(true);
});
