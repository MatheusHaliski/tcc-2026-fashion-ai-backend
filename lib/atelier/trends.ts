import type {AtelierTrend} from './types';
export interface TrendSignal {name:string;count:number;delta:number|null}
/** Counts and mean Hype changes within the displayed sample, never a market forecast. */
export function atelierTrendSignals(rows:AtelierTrend[],kind:'style'|'color'):TrendSignal[]{
 const groups=new Map<string,{count:number;sum:number;measured:number}>();
 for(const row of rows){const values=kind==='style'?[...new Set(row.piece.style??[])]:row.piece.color?[row.piece.color]:[];for(const name of values){const group=groups.get(name)??{count:0,sum:0,measured:0};group.count++;if(row.hype.status==='AVAILABLE'&&typeof row.hype.deltaPoints==='number'&&Number.isFinite(row.hype.deltaPoints)){group.sum+=row.hype.deltaPoints;group.measured++;}groups.set(name,group);}}
 return [...groups].map(([name,g])=>({name,count:g.count,delta:g.measured?Math.round(g.sum/g.measured*10)/10:null})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
}
