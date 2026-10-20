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
it.each([
 ['ESTREIA',['RARE','LEGENDARY','COLLAB_DROP']],
 ['STUDIO',['LEGENDARY','COLLAB_DROP']],
 ['LOFT',[]],
])('shows a visible lock and the required level for each blocked finish at %s',async(currentTier,locked)=>{
 loggedAs(undefined,{'GET /api/me/aura-permissions':{currentTier}});
 renderApp(<AuraHypePicker inline onChange={vi.fn()}/>);
 await waitFor(()=>expect(screen.queryByText('Verificando seu nível…')).toBeNull());
 for(const tier of ['COMMON','RARE','LEGENDARY','COLLAB_DROP']){
  const button=document.querySelector<HTMLButtonElement>(`.fashion-hype-level-preview[data-fashion-level="${tier}"]`)!;
  expect(button.querySelector('.fashion-hype-level-name')?.textContent).toBeTruthy();
  expect(button.disabled).toBe(locked.includes(tier));
  expect(!!button.querySelector('[data-fai-lock]')).toBe(locked.includes(tier));
  expect(button.hasAttribute('data-locked')).toBe(locked.includes(tier));
  if(locked.includes(tier))expect(button.textContent).toContain(tier==='RARE'?'Requer nível Studio':'Requer nível Loft');
 }
});
it('fails closed with visible locks and a retry when the permissions request fails',async()=>{
 loggedAs(undefined,{'GET /api/me/aura-permissions':new Response('{}',{status:503})});
 renderApp(<AuraHypePicker inline onChange={vi.fn()}/>);
 expect((await screen.findByRole('alert')).textContent).toContain('Os acabamentos avançados continuam bloqueados');
 expect(document.querySelectorAll('.fashion-hype-level-preview:disabled [data-fai-lock]')).toHaveLength(3);
 expect(screen.getByRole('button',{name:'Tentar novamente'})).toBeTruthy();
});

it('uses the FAI navigation icon tokens for finishes and stars for Special',()=>{
 renderApp(<AuraHypePicker inline onChange={vi.fn()}/>);
 for(const [tier,id] of [['COMMON','act-26'],['RARE','act-39'],['LEGENDARY','act-37'],['COLLAB_DROP','soc-06']]) {
  const button=document.querySelector<HTMLButtonElement>(`.fashion-hype-level-preview[data-fashion-level="${tier}"]`)!;
  expect(button.getAttribute('aria-label')).toBeTruthy();expect(button.title).toBeTruthy();
  expect(button.querySelector('.fashion-hype-level-token img')?.getAttribute('src')).toContain(id);
 }
 expect(document.querySelectorAll('[data-fashion-level="COLLAB_DROP"] .fashion-hype-level-token img')).toHaveLength(2);
});
