// @vitest-environment jsdom
import { afterEach,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,renderApp,screen,waitFor } from '@/test-utils/render';
import { AuraFashionPicker } from './aura-fashion-picker';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('abre variações, busca catálogo sem cache, filtra URLs e aplica a opção',async()=>{
 const preset={id:'satin-ivory',name:'Cetim editorial',family:'COMMON',image:'/aura/fashion-curated/satin-ivory.webp',palette:['#dcc7a5','#faf1e1']};
 const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({presets:[preset,{...preset,id:'unsafe',image:'https://example.com/logo.png'}]})});vi.stubGlobal('fetch',fetch);
 const onChange=vi.fn();renderApp(<AuraFashionPicker onChange={onChange}/>);
 fireEvent.click(screen.getByRole('button',{name:/AURA comum/}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Cetim editorial'})).toBeTruthy());
 expect(fetch).toHaveBeenCalledWith('/aura/fashion-curated/catalog.json',expect.objectContaining({cache:'no-store'}));
 expect(screen.queryByRole('button',{name:'unsafe'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Cetim editorial'}));expect(onChange).toHaveBeenCalledWith(preset);
});
