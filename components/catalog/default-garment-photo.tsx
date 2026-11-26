'use client';
import { useState } from 'react';
import { defaultGarmentUrl, defaultGarmentColor } from '@/lib/catalog/default-garment';
import type { PhotoFraming } from '@/lib/photo-framing';
export function DefaultGarmentPhoto({category,subcategory,colorHex,color,alt='',className='',framing='WHOLE'}:{category?:string|null;subcategory?:string|null;colorHex?:string|null;color?:string|null;alt?:string;className?:string;framing?:PhotoFraming}) {
 const url=defaultGarmentUrl(category,subcategory,colorHex,color,framing),[failed,setFailed]=useState<string|null>(null);
 const fallback='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 640"><rect width="480" height="640" fill="${framing==='FABRIC'?defaultGarmentColor(colorHex,color):'#f4f5f7'}"/>${framing==='FABRIC'?'':`<path d="${category==='lower_piece'?'M130 130h220l20 375H260l-20-240-20 240H110z':'M165 140l-90 70 55 85 30-20v230h160V275l30 20 55-85-90-70-45 30h-60z'}" fill="${defaultGarmentColor(colorHex,color)}"/>`}</svg>`);
 return <span className={`catalog-photo is-default ${className}`} data-mode="default" data-default-framing={framing}>
  <img src={failed===url?fallback:url} alt={alt} loading="lazy" style={{width:'100%',height:'100%',objectFit:framing==='WHOLE'?'contain':'cover'}} onError={()=>setFailed(url)}/>
 </span>;
}
