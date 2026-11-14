import { createHash } from 'node:crypto';
import { defaultGarmentColor } from '@/lib/catalog/default-garment';
import { renderDefaultAsset } from '@/lib/catalog/default-asset-render';
export const runtime='nodejs';
const cache=new Map<string,Buffer>(),pending=new Map<string,Promise<Buffer>>();let size=0;
/** Quantas renderizações rodam ao mesmo tempo e quantas vezes um pedido espera uma vaga antes de desistir (503). */
const MAX_RENDERS=4,MAX_WAITS=24;
/**
 * A imagem da chave: reaproveita a renderização em andamento, espera uma vaga quando as 4 estão ocupadas (a tag
 * <img> não tenta de novo num 503: sem a espera, a grade do guarda-roupa ficava com ilustrações quebradas) e guarda
 * o resultado no cache. `null` = não houve vaga a tempo.
 */
async function rendered(key:string,render:()=>Promise<Buffer>):Promise<Buffer|null> {
 for(let waits=0;!pending.has(key)&&!cache.has(key)&&pending.size>=MAX_RENDERS;waits++) {
  if(waits>=MAX_WAITS)return null;
  await Promise.race([...pending.values()].map((running)=>running.catch(()=>undefined)));
 }
 const ready=cache.get(key);
 if(ready)return ready;
 let job=pending.get(key);
 if(!job) {
  job=render();
  pending.set(key,job);
 }
 let data:Buffer;
 try {
  data=await job;
 } finally {
  pending.delete(key);
 }
 if(!cache.has(key)) {
  while(size+data.length>24*1024*1024&&cache.size) {
   const first=cache.keys().next().value!;
   size-=cache.get(first)!.length;
   cache.delete(first);
  }
  cache.set(key,data);
  size+=data.length;
 }
 return data;
}
export async function GET(request:Request) {
 const p=new URL(request.url).searchParams,category=(p.get('category')??'').slice(0,60),subcategory=(p.get('subcategory')??'').slice(0,80),color=defaultGarmentColor(p.get('color')),framing=p.get('framing')==='FABRIC'?'FABRIC':'WHOLE';
 const key=JSON.stringify([category,subcategory,color,framing]);
 try {
  const data=cache.get(key)??await rendered(key,()=>renderDefaultAsset(category,subcategory,color,framing));
  if(!data)return new Response(null,{status:503,headers:{'Retry-After':'1'}});
  const etag='"'+createHash('sha256').update(data).digest('hex')+'"';
  const headers={'Content-Type':'image/png','Cache-Control':'public, max-age=86400, s-maxage=31536000, immutable','ETag':etag,'X-Content-Type-Options':'nosniff'};
  return request.headers.get('if-none-match')===etag?new Response(null,{status:304,headers}):new Response(new Uint8Array(data),{headers});
 }catch{return new Response(null,{status:503,headers:{'Retry-After':'30'}});}
}
