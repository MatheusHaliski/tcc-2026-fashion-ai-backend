// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {cleanup,fireEvent,mockApi,renderApp,screen,within} from '@/test-utils/render';
import {PIECE,SCHEME,PIECE_2} from '@/test-utils/fixtures';
import {PieceCard} from './piece-card';
import {SchemeCard,CardSealSummary} from './scheme-card';
import {CardFashionMeta} from './card-fashion-meta';
afterEach(cleanup);
const seals=[{label:'Marca',name:'Seleção oficial',owner:'marca',tier:'PECA'}];
it('shows the brand seal as the "Selo" cell of the Info list and keeps fashion facts outside the Hype tab',()=>{
 mockApi({});const {container}=renderApp(<PieceCard piece={PIECE} seals={seals} flip={false}/>);
 const media=container.querySelector<HTMLElement>('.pc-media')!;expect(media.style.aspectRatio).toBe('4 / 3');
 const sealCell=container.querySelector('.pc-info-seal')!;
 expect(sealCell.textContent).toContain('Seleção oficial');expect(sealCell.parentElement?.previousElementSibling?.textContent).toBe('Selo');
 expect(container.querySelector('.card-seals')).toBeNull();
 const meta=container.querySelector('.card-fashion-meta')!;
 expect([...meta.querySelectorAll('dt')].map(e=>e.textContent)).toEqual(['Marca','Cor','Ocasião','Estilo']);
 expect(meta.textContent).toContain('Nike');expect(meta.textContent).toContain('Casual');
 fireEvent.click(screen.getByRole('tab',{name:/^Hype/}));expect(meta.closest('[role="tabpanel"]')).toBeNull();
 expect(meta.isConnected).toBe(true);expect(screen.queryByTitle('Seleção oficial · @marca · PECA')).toBeNull();
});
it('shortens outfit posts without losing the full item list in expanded view',()=>{
 mockApi({});const {container,unmount}=renderApp(<SchemeCard scheme={SCHEME} seals={seals} flip={false}/>);
 expect(container.querySelector<HTMLElement>('.c-photo')?.style.aspectRatio).toBe('4 / 3');
 expect(container.querySelector('.card-fashion-meta')?.textContent).toContain('Trabalho');
 expect(container.querySelector('.piece2, .piece-layout, .grid-pieces, .hero-lateral-list')).toBeNull();
 expect(container.querySelector('.card-seals')).toBeTruthy();unmount();
 const full=renderApp(<SchemeCard scheme={SCHEME} expanded flip={false}/>);
 expect(full.container.querySelector('.piece2, .piece-layout')).toBeTruthy();expect(full.container.textContent).toContain(PIECE_2.name);
});
it('never manufactures metadata or treats a sustainability attribute as an approved award',()=>{
 mockApi({});const {container}=renderApp(<PieceCard piece={{...PIECE,seals:['SUSTAINABLE'],style:[],occasion:[],brandName:null,color:''}} flip={false}/>);
 expect(container.querySelector('.card-seals')).toBeNull();
 expect(within(container.querySelector('.card-fashion-meta') as HTMLElement).getAllByText('—')).toHaveLength(4);
});
it('preserves raw brand names and exposes all metadata when a short summary has extra values',()=>{
 const {container}=renderApp(<CardFashionMeta brands={[{name:'Basic'},{name:'Nike'}]} styles={['basic','streetwear','minimalist','basic']} occasions={['casual']} colors={[]}/>);
 expect(container.textContent).toContain('Basic · Nike');expect(container.querySelector('.card-meta-more')?.textContent).toContain('+1');
 expect(container.querySelector('[aria-label*="Streetwear"]')).toBeTruthy();
});
it('keeps a visible count of approved awards beyond the first three',()=>{
 const {container}=renderApp(<CardSealSummary seals={Array.from({length:5},(_,i)=>({label:'A'+i,name:'Oficial '+i}))}/>);
 expect(container.querySelectorAll('.seal-medallion')).toHaveLength(3);expect(container.querySelector('.card-meta-more')?.textContent).toContain('+2');
});
