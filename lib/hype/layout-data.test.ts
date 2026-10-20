import {expect,it} from 'vitest';
import {rankedDimensions,dimensionDelta,keyDimensions} from './layout-data';
import type {HypeSummary} from './types';
const base:HypeSummary={status:'AVAILABLE',calculatedAt:'2026-10-18T00:00:00Z',algorithmVersion:'v2',dimensions:{POPULARITY:30,TREND:80,RARITY:0}};
it('orders actual dimensions descending and preserves missing vs zero',()=>{const rows=rankedDimensions(base);expect(rows.slice(0,3).map(r=>r.value)).toEqual([80,30,0]);expect(rows[3].value).toBeNull();expect(rankedDimensions({status:'NOT_CALCULATED'})[0].value).toBeNull();});
it('does not derive temporal direction from a single snapshot or a stale ordering',()=>{expect(dimensionDelta(base,undefined,'TREND')).toBeNull();expect(dimensionDelta(base,base,'TREND')).toBeNull();expect(dimensionDelta({...base,calculatedAt:'2026-10-19T00:00:00Z',dimensions:{TREND:72}},base,'TREND')).toBe(-8);});
it('uses metadata to select existing dimensions, never create values',()=>{const rows=keyDimensions(base,'PIECE',{name:'Limited drop',color:'black',brandName:'Example'});expect(rows[0].dimension).toBe('RARITY');expect(rows[0].reason).toBe('metadata');expect(rows[0].value).toBe(0);expect(rows).toHaveLength(3);});
