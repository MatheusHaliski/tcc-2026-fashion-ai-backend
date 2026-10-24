import sharp from 'sharp';
import path from 'node:path';
import { publicRoot, untracedFs } from '@/lib/server/untraced-fs';
import { defaultGarmentSource } from './default-garment';
/** Largest 3:4 rectangle wholly inside a binary material mask, never a bounding-box zoom. */
export function fabricRectangle(mask: Uint8Array, width: number, height: number) {
 const stride=width+1, integral=new Int32Array(stride*(height+1));
 for(let y=0;y<height;y++) { let row=0; for(let x=0;x<width;x++){row+=mask[y*width+x]?1:0;integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+row;} }
 let lo=1,hi=Math.min(Math.floor(width/3),Math.floor(height/4)),best:{left:number;top:number;width:number;height:number}|null=null;
 while(lo<=hi){const unit=Math.floor((lo+hi)/2),w=unit*3,h=unit*4;let found:{left:number;top:number;width:number;height:number}|null=null,distance=Infinity;
  for(let y=1;y+h<height;y++)for(let x=1;x+w<width;x++){
   if(integral[(y+h)*stride+x+w]-integral[y*stride+x+w]-integral[(y+h)*stride+x]+integral[y*stride+x]!==w*h)continue;
   const d=(x+w/2-width/2)**2+(y+h/2-height/2)**2;if(d<distance){distance=d;found={left:x,top:y,width:w,height:h};}
  }
  if(found){best=found;lo=unit+1;}else hi=unit-1;
 }
 return best;
}
/** Recolour only the blue/neutral material, preserving the orange FAI badge and transparent contour. */
export function recolorMaterial(data: Uint8Array, hex: string) {
 const target=hex.match(/[0-9a-f]{2}/gi)!.map(x=>parseInt(x,16)),material=new Uint8Array(data.length/4),lum:number[]=[];
 for(let i=0;i<material.length;i++){const k=i*4,r=data[k],g=data[k+1],b=data[k+2],max=Math.max(r,g,b),min=Math.min(r,g,b);
  const warm=r>g*1.13&&r>b*1.2;
  if(data[k+3]>240&&!warm&&(b>r*1.08||max-min<32&&max<244)){material[i]=1;lum.push(.2126*r+.7152*g+.0722*b);}
 }
 lum.sort((a,b)=>a-b);const mid=lum[Math.floor(lum.length/2)]||128;
 for(let i=0;i<material.length;i++)if(material[i]){const k=i*4,l=.2126*data[k]+.7152*data[k+1]+.0722*data[k+2],f=Math.max(.18,Math.min(1.8,l/mid));
  for(let c=0;c<3;c++)data[k+c]=Math.round(f<=1?target[c]*f:target[c]+(255-target[c])*(f-1)*.45);
 }
 return material;
}
export async function renderDefaultAsset(category:string,subcategory:string,color:string,framing:string) {
 const source=defaultGarmentSource(category,subcategory);
 // Source is selected from our compiled allowlist, never from a client-supplied URL/path. The file is read through
 // untracedFs so the bundler does not copy all of public/ into the function (outputFileTracingIncludes lists the thumbs).
 const {data,info}=await sharp(await untracedFs.promises.readFile(path.join(publicRoot,source))).resize({width:640,height:640,fit:'inside',withoutEnlargement:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const mask=recolorMaterial(data,color);
 const raw={width:info.width,height:info.height,channels:4 as const};
 const rectangle=framing==='FABRIC'?fabricRectangle(mask,info.width,info.height):null;
 let image=sharp(data,{raw});
 if(rectangle)image=image.extract(rectangle).resize(480,640);
 else if(framing==='FABRIC') {
  // Very narrow accessories have no usable fabric surface. A neutral material illustration still fills the frame.
  return sharp({create:{width:480,height:640,channels:3,background:color}}).png().toBuffer();
 } else {
  // Sharp applies only one resize per pipeline; compose the resized piece on an
  // explicit canvas rather than chaining two resizes around extend().
  const piece=await image.trim({background:'#00000000'}).resize(365,474,{fit:'inside'}).png().toBuffer({resolveWithObject:true});
  return sharp({create:{width:480,height:640,channels:4,background:'#f4f5f7'}})
   .composite([{input:piece.data,left:Math.floor((480-piece.info.width)/2),top:Math.floor((640-piece.info.height)/2)}])
   .flatten({background:'#f4f5f7'}).png().toBuffer();
 }
 return image.png().toBuffer();
}
