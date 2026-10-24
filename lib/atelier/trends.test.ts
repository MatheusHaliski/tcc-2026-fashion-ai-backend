import {expect,it} from 'vitest';
import {atelierTrendSignals} from './trends';
import type {AtelierTrend} from './types';
const row=(id:string,styles:string[],delta:number|null):AtelierTrend=>({id,rank:1,hype:{status:'AVAILABLE',score:50,deltaPoints:delta},piece:{id,style:styles,color:'blue'}} as AtelierTrend);
it('counts each style once per piece and uses only measured deltas',()=>{const signals=atelierTrendSignals([row('p1',['Y2K','Y2K'],4),row('p2',['Y2K','MINIMAL'],null),row('p3',['Y2K'],-2)],'style');expect(signals).toEqual([{name:'Y2K',count:3,delta:1},{name:'MINIMAL',count:1,delta:null}]);});
it('never invents zero change for missing or pending Hype',()=>{const pending=row('p1',['STREET'],NaN);pending.hype.status='NOT_CALCULATED';expect(atelierTrendSignals([pending],'color')).toEqual([{name:'blue',count:1,delta:null}]);expect(atelierTrendSignals([],'style')).toEqual([]);});
