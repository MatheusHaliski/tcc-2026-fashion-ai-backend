/** Small, session-only decoded image cache. No persistence, no catalog-wide download. */
const MAX_IMAGES=24, CONCURRENCY=3, MAX_AGE_MS=5*60_000;
const entries=new Map<string,{image:HTMLImageElement,created:number}>();
const inflight=new Set<string>();
const queue:string[]=[];let active=0;
function pump(){
 if(typeof Image==='undefined')return;
 while(active<CONCURRENCY && queue.length){
  const url=queue.shift()!;if(entries.has(url))continue;
  inflight.add(url);const image=new Image();image.decoding='async';active++;
  const finish=(ok:boolean)=>{
   inflight.delete(url);clearTimeout(timer);image.onload=null;image.onerror=null;active--;
   if(ok){entries.set(url,{image,created:Date.now()});while(entries.size>MAX_IMAGES)entries.delete(entries.keys().next().value!);}
   pump();
  };
  const timer=setTimeout(()=>finish(false),8000);
  image.onload=()=>finish(true);image.onerror=()=>finish(false);image.src=url;
 }
}
export function warmMediaImage(url:string){
 if(typeof window==='undefined' || (navigator as Navigator & {connection?:{saveData?:boolean}}).connection?.saveData)return;
 for(const [key,item] of entries)if(Date.now()-item.created>MAX_AGE_MS)entries.delete(key);
 if(entries.has(url)||inflight.has(url)||queue.includes(url)||entries.size+queue.length+active>=MAX_IMAGES)return;
 queue.push(url);pump();
}
