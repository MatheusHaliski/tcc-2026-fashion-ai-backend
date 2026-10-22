import { createHash } from 'node:crypto';
import { defaultGarmentColor } from '@/lib/catalog/default-garment';
import { renderDefaultAsset } from '@/lib/catalog/default-asset-render';
export const runtime='nodejs';
const cache=new Map<string,Buffer>(),pending=new Map<string,Promise<Buffer>>();let size=0;
export async function GET(request:Request) {
 const p=new URL(request.url).searchParams,category=(p.get('category')??'').slice(0,60),subcategory=(p.get('subcategory')??'').slice(0,80),color=defaultGarmentColor(p.get('color')),framing=p.get('framing')==='FABRIC'?'FABRIC':'WHOLE';
 const key=JSON.stringify([category,subcategory,color,framing]);
 try {
  let data=cache.get(key);
  if(!data){let job=pending.get(key);if(!job){
   if(pending.size>=4)return new Response(null,{status:503,headers:{'Retry-After':'1'}});
   job=renderDefaultAsset(category,subcategory,color,framing);pending.set(key,job);
  }try{data=await job;}finally{pending.delete(key);}
   if(!cache.has(key)){while(size+data.length>24*1024*1024&&cache.size){const first=cache.keys().next().value!;size-=cache.get(first)!.length;cache.delete(first);}cache.set(key,data);size+=data.length;}
  }
  const etag='"'+createHash('sha256').update(data).digest('hex')+'"';
  const headers={'Content-Type':'image/png','Cache-Control':'public, max-age=86400, s-maxage=31536000, immutable','ETag':etag,'X-Content-Type-Options':'nosniff'};
  return request.headers.get('if-none-match')===etag?new Response(null,{status:304,headers}):new Response(new Uint8Array(data),{headers});
 }catch{return new Response(null,{status:503,headers:{'Retry-After':'30'}});}
}
