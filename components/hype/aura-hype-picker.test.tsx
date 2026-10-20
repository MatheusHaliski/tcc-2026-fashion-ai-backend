// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,loggedAs,renderApp,screen,waitFor} from '@/test-utils/render';
import {AuraHypePicker} from './aura-hype-picker';
afterEach(cleanup);
it('shows only eight layouts in two bands, labeled as examples and without palette choices',()=>{
 const change=vi.fn();renderApp(<AuraHypePicker inline onChange={change}/>);
 expect(document.querySelectorAll('.aura-hype-preset')).toHaveLength(8);
 expect(document.querySelectorAll('.aura-hype-preset-band')).toHaveLength(2);
 expect(document.querySelectorAll('.aura-hype-preset-band[data-preset-kind="static"] .aura-hype-preset')).toHaveLength(4);
 expect(document.querySelectorAll('.hype-demo-label')).toHaveLength(8);
 expect(document.querySelectorAll('.aura-hype-field')).toHaveLength(0);
 fireEvent.click(document.querySelectorAll('.aura-hype-preset')[3]);expect(change).toHaveBeenCalledWith('COMMON_STATIC_GLOBAL');
});
it('cannot open Gold or Special areas below Loft, including when the form has no piece ID',async()=>{
 loggedAs(undefined,{'GET /api/me/aura-permissions':{currentTier:'STUDIO'}});
 renderApp(<AuraHypePicker inline onChange={vi.fn()}/>);
 const level=(tier:string)=>document.querySelector<HTMLButtonElement>(`.fashion-hype-level-preview[data-fashion-level="${tier}"]`)!;
 await waitFor(()=>expect(level('RARE').disabled).toBe(false));
 expect(level('LEGENDARY').disabled).toBe(true);expect(level('COLLAB_DROP').disabled).toBe(true);
 fireEvent.click(level('LEGENDARY'));expect(document.querySelector('[aria-pressed="true"][data-fashion-level]')?.getAttribute('data-fashion-level')).toBe('COMMON');
 fireEvent.click(level('RARE'));expect(document.querySelectorAll('.aura-hype-preset')).toHaveLength(8);
});
