import {expect,it} from 'vitest';
import {HYPE_PRESETS,hypePreset,hypePresetsForTier} from './aura-hype-presets';
it('offers exactly eight layouts, four static and four dynamic, without palette permutations',()=>{
 expect(HYPE_PRESETS).toHaveLength(8);expect(new Set(HYPE_PRESETS.map(p=>p.layout)).size).toBe(8);
 expect(HYPE_PRESETS.filter(p=>p.kind==='static')).toHaveLength(4);
 expect(HYPE_PRESETS.filter(p=>p.kind==='dynamic')).toHaveLength(4);
 for(const tier of ['COMMON','RARE','LEGENDARY','COLLAB_DROP'] as const){const presets=hypePresetsForTier(tier);expect(presets).toHaveLength(8);for(const p of presets)expect(hypePreset(p.id)).toEqual(p);}
 expect(new Set(['COMMON','RARE','LEGENDARY','COLLAB_DROP'].flatMap(t=>hypePresetsForTier(t as 'COMMON').map(p=>p.color))).size).toBe(1);
});
it('reads old choices without listing them as new selectable presets',()=>{expect(hypePreset('SCANNER').layout).toBe('static-horizontal');expect(HYPE_PRESETS.some(p=>p.id==='SCAN_GRAPHITE')).toBe(false);});
