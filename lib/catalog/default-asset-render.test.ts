import { expect,it } from 'vitest';
import sharp from 'sharp';
import { defaultGarmentColor,defaultGarmentSource,defaultGarmentUrl } from './default-garment';
import { renderDefaultAsset } from './default-asset-render';
it('matches the subcategory and selected colour without accepting a source URL',()=>{
 expect(defaultGarmentSource('lower_piece','bermuda_shorts')).toContain('bermuda');expect(defaultGarmentSource('upper_piece','bermuda_shorts')).not.toContain('bermuda');
 expect(defaultGarmentColor(null,'beige')).toBe('#dfcdb0');expect(defaultGarmentColor('#ABCDEF','blue')).toBe('#abcdef');
 expect(defaultGarmentUrl('lower_piece','shorts',null,'beige','FABRIC')).toContain('color=%23dfcdb0');expect(defaultGarmentSource('../../etc/passwd','../../etc/passwd')).toBe(defaultGarmentSource(null,null));
});
it('renders actual colour variants and a fabric frame entirely filled by material',async()=>{
 const [red,blue]=await Promise.all(['#c62b28','#2a5fa8'].map(c=>renderDefaultAsset('lower_piece','bermuda_shorts',c,'FABRIC')));
 const r=await sharp(red).removeAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(blue).removeAlpha().raw().toBuffer({resolveWithObject:true});
 expect([r.info.width,r.info.height]).toEqual([480,640]);
 for(const i of [0,(320*480+240)*3,(640*480-1)*3]){expect(r.data[i]).toBeGreaterThan(r.data[i+2]);expect(b.data[i+2]).toBeGreaterThan(b.data[i]);}
});

it('keeps the whole illustration on an exact 480 by 640 canvas', async()=>{
 const result=await renderDefaultAsset('lower_piece','shorts','#dfcdb0','WHOLE');
 const meta=await sharp(result).metadata();expect([meta.width,meta.height]).toEqual([480,640]);
});
