import type {HypeDimension,HypeEntity,HypeSummary} from './types';
import {dimensionsFor} from './model';
import {fashionMetric} from './fashion-card';
export interface HypeEditorialContext {name?:string;brandName?:string|null;category?:string;subcategory?:string|null;color?:string|null;style?:string[];occasion?:string[]}
export function rankedDimensions(summary:HypeSummary|undefined|null,type:HypeEntity='PIECE'){
 return dimensionsFor(type).map(d=>({dimension:d,value:summary?.status==='AVAILABLE'?fashionMetric(summary.dimensions?.[d]):null})).sort((a,b)=>(b.value??-1)-(a.value??-1));
}
/** Compare two actual snapshots, never interpret the rank of one snapshot as growth. */
export function dimensionDelta(current:HypeSummary|undefined|null,previous:HypeSummary|undefined|null,dimension:HypeDimension){
 if(current?.status!=='AVAILABLE'||previous?.status!=='AVAILABLE'||!current.calculatedAt||!previous.calculatedAt||!(Date.parse(current.calculatedAt)>Date.parse(previous.calculatedAt))||current.algorithmVersion!==previous.algorithmVersion)return null;
 const a=fashionMetric(current.dimensions?.[dimension]),b=fashionMetric(previous.dimensions?.[dimension]);return a===null||b===null?null:a-b;
}
/** Editorial associations select existing metrics; they never generate or change a score. */
export function keyDimensions(summary:HypeSummary|undefined|null,type:HypeEntity,context:HypeEditorialContext={}){
 const text=[context.name,context.category,context.subcategory,...context.style??[],...context.occasion??[]].join(' ').toLowerCase();
 const rules:Partial<Record<HypeDimension,boolean>>={
  LONGEVITY:/classic|classico|timeless|formal|alfaiat|jeans|minimal/.test(text),
  TREND:/street|y2k|techwear|party|night|festa/.test(text),
  ORIGINALITY:/print|estamp|pattern|art|collab/.test(text),
  RARITY:/limited|limitad|exclusive|exclusiv|drop/.test(text),
 };
 return rankedDimensions(summary,type).map(row=>({...row,reason:rules[row.dimension]?'metadata':context.brandName&&row.dimension==='ORIGINALITY'?'brand':context.color&&row.dimension==='TREND'?'color':'snapshot'}))
  .sort((a,b)=>({metadata:3,brand:2,color:1,snapshot:0}[b.reason]??0)-({metadata:3,brand:2,color:1,snapshot:0}[a.reason]??0)).filter(row=>row.value!==null).slice(0,3);
}
