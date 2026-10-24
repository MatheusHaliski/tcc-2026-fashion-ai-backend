// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,loggedAs,renderApp,screen,waitFor} from '@/test-utils/render';
import {AuraHypePicker} from './aura-hype-picker';
import {api} from '@/lib/api/client';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
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
 expect(level('RARE').querySelector('[data-fai-selected]')).toBeTruthy();
 expect(level('COMMON').querySelector('[data-fai-selected]')).toBeNull();
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

it('represents each finish with its own visible FAI metal medal or special stars and a readable name',()=>{
 renderApp(<AuraHypePicker inline onChange={vi.fn()}/>);
 for(const [tier,label] of [['COMMON','Bronze'],['RARE','Prata'],['LEGENDARY','Ouro'],['COLLAB_DROP','Especial']]) {
  const button=document.querySelector<HTMLButtonElement>(`.fashion-hype-level-preview[data-fashion-level="${tier}"]`)!;
  expect(button.getAttribute('aria-label')).toBeTruthy();expect(button.title).toBeTruthy();
  expect(button.querySelector(`[data-fai-finish-token="${tier}"]`)).toBeTruthy();
  const text=button.querySelector('.fashion-hype-level-label')!;
  expect(text.textContent).toBe(label);expect(text.classList.contains('sr-only')).toBe(false);
  expect(button.querySelector('[data-finish-shape]')?.getAttribute('data-finish-shape')).toBe(tier==='COLLAB_DROP'?'stars':'medal');
  expect(button.querySelector('img')).toBeNull();
 }
 expect(document.querySelectorAll('[data-fashion-level="COLLAB_DROP"] [data-finish-shape="stars"] path')).toHaveLength(3);
});

it('keeps advanced finishes locked and vectors visible while permissions are unresolved',()=>{
 loggedAs();
 const original=api.get;
 vi.spyOn(api,'get').mockImplementation((path,options)=>path==='/api/me/aura-permissions'?new Promise<never>(()=>{}):original(path,options));
 const change=vi.fn();renderApp(<AuraHypePicker inline onChange={change}/>);
 for(const tier of ['RARE','LEGENDARY','COLLAB_DROP']){
  const button=document.querySelector<HTMLButtonElement>(`[data-fashion-level="${tier}"]`)!;
  expect(button.disabled).toBe(true);expect(button.querySelector('svg[data-fai-lock] path')).toBeTruthy();
  fireEvent.click(button);
 }
 expect(change).not.toHaveBeenCalled();
});
