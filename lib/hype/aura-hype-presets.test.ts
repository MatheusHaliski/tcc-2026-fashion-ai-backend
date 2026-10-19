import {expect,it} from 'vitest';
import {HYPE_PRESETS,hypePreset} from './aura-hype-presets';
it('oferece 40 perfis distintos de tratamento fotográfico sem trocar o score',()=>{
 expect(HYPE_PRESETS).toHaveLength(40);expect(new Set(HYPE_PRESETS.map(p=>p.id)).size).toBe(40);
 expect(new Set(HYPE_PRESETS.map(p=>`${p.tech}:${p.color}:${p.duration}:${p.angle}`)).size).toBe(40);
 expect(HYPE_PRESETS.filter(p=>p.kind === 'static')).toHaveLength(20);
 expect(HYPE_PRESETS.filter(p=>p.kind === 'dynamic')).toHaveLength(20);
 expect(hypePreset('SCANNER').id).toBe('SCAN_GRAPHITE');
 for(const p of HYPE_PRESETS)expect(hypePreset(p.id)).toEqual(p);
});
