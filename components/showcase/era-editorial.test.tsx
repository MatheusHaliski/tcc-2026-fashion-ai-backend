// @vitest-environment jsdom
import {useState} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,renderApp,screen,loggedAs,waitFor} from '@/test-utils/render';
import {EraEditorialEditor,EraEditorialView} from './era-editorial';
import {emptyEditorial} from '@/lib/eras/editorial';
vi.mock('@/components/three/common',()=>({useReducedMotion:()=>true}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('mostra marcos em ordem e respeita redução de movimento',()=>{
 const e={...emptyEditorial(),headline:'Aurora',timeline:[{date:'2026-06-01',title:'Turnê',description:''},{date:'2026-01-01',title:'Álbum',description:''}],photos:[{url:'/photo.jpg',alt:'Figurino no palco',caption:'Abertura'}]};
 const {container}=renderApp(<EraEditorialView value={e} label="Era"/>);expect(screen.getByText('Aurora')).toBeTruthy();expect(container.querySelector('.era-editorial')?.getAttribute('data-motion')).toBe('off');expect([...container.querySelectorAll('time')].map(x=>x.textContent)).toEqual(['2026-01-01','2026-06-01']);expect(screen.getByAltText('Figurino no palco')).toBeTruthy();
});
it('manual permite temas, símbolos e marcos na prévia',()=>{
 function Editor(){const [e,set]=useState(emptyEditorial);return <EraEditorialEditor value={e} onChange={set}/>;}
 renderApp(<Editor/>);fireEvent.click(screen.getByRole('button',{name:/Dark pop gótico/}));expect(screen.getByRole('button',{name:/Dark pop gótico/}).getAttribute('aria-pressed')).toBe('true');fireEvent.click(screen.getByRole('button',{name:'Coroa',exact:true}));expect(screen.getByRole('img',{name:'Coroa'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Adicionar marco'}));expect(screen.getByLabelText('Data do marco')).toBeTruthy();
});
it('Copilot usa o mesmo editor e identifica retorno local',async()=>{
 loggedAs(undefined,{'POST /api/era-studio/draft':{editorial:{...emptyEditorial(),theme:'GOLDEN_RNB',headline:'Nova fase'},fallbackUsed:true}});
 function Editor(){const [e,set]=useState(emptyEditorial);return <EraEditorialEditor value={e} onChange={set}/>;}
 renderApp(<Editor/>);fireEvent.click(screen.getByRole('radio',{name:'Copilot IA'}));fireEvent.change(screen.getByLabelText('Descreva a estética e os marcos com suas datas'),{target:{value:'R&B dourado'}});fireEvent.click(screen.getByRole('button',{name:'Criar rascunho'}));await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Rascunho local'));expect(screen.getByDisplayValue('Nova fase')).toBeTruthy();
});
