// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {cleanup,renderApp,mockApi,screen,fireEvent,waitFor} from '@/test-utils/render';
import {SCHEME} from '@/test-utils/fixtures';
import {SchemeCard} from './scheme-card';
afterEach(cleanup);
it('look salvo em edição recebe o layout Hype e mantém o score no label Info',async()=>{
 mockApi({'GET /api/hype/summaries':{items:{[SCHEME.id]:{status:'AVAILABLE',score:77,level:'HOT',calculatedAt:'2026-10-19T00:00:00Z',dimensions:{POPULARITY:80,TREND:50}}}}});
 const {container}=renderApp(<SchemeCard scheme={{...SCHEME,background:{auraHype:'COMMON_STATIC_GLOBAL'}}} href="#"/>);
 await waitFor(()=>expect(container.querySelector('[data-hype-layout="static-global"] strong')?.textContent).toBe('77'));
 expect(container.querySelector('.fashion-hype-header')).toBeNull();
 expect(container.querySelector('.pc-tab-live-score .hype-badge')?.textContent).toContain('77');
 fireEvent.click(screen.getByRole('tab',{name:/Info/}));expect(container.querySelector('.pc-info')).toBeTruthy();
});
