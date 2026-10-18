// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {cleanup,renderApp,screen} from '@/test-utils/render';
import {FashionCardHeader,FashionCardStats} from './fashion-card-panel';
afterEach(cleanup);
it('renders server rarity and actual global score in the header',()=>{
 const {container}=renderApp(<FashionCardHeader state={{kind:'available',score:84,level:'HOT',direction:null,stale:false}} summary={{status:'AVAILABLE',fashionCard:{status:'CLASSIFIED',tier:'RARE',ruleVersion:1,source:'HYPE_SIGNALS'}}}/>);
 expect(screen.getByText('Rara')).toBeTruthy();expect(screen.getByText('HYPE SCORE')).toBeTruthy();expect(container.querySelector('.led-number')?.textContent).toBe('84');expect(container.textContent).not.toContain('/99');expect(container.textContent).not.toContain('/100');
});
it('does not invent attributes or serial numbers',()=>{
 const {container}=renderApp(<FashionCardStats styles={['Streetwear','Y2K']}/>);
 const values=[...container.querySelectorAll('.fashion-hype-cell dd')].map(d=>d.textContent);
 expect(values).toHaveLength(8);expect(values.every(v=>v==='—')).toBe(true);expect(container.querySelector('.fashion-hype-cell[data-tone]')).toBeNull();
 expect(container.querySelector('.fashion-hype-edition')).toBeNull();expect(screen.getByText('Streetwear')).toBeTruthy();
});
it('displays only confirmed edition numbers and actual longevity',()=>{
 renderApp(<FashionCardStats summary={{status:'AVAILABLE',dimensions:{LONGEVITY:98},fashionCard:{status:'CLASSIFIED',tier:'COLLAB_DROP',ruleVersion:1,source:'VERIFIED_DROP',edition:{serial:42,total:100,confirmed:true}}}}/>);
 expect(screen.getByText(/#042\/100/)).toBeTruthy();
 const lon=document.querySelector('.fashion-hype-cell[data-dimension="LONGEVITY"]')!;expect(lon.querySelector('dd')?.textContent).toBe('98');expect(lon.getAttribute('data-tone')).toBe('high');expect(lon.querySelector('abbr')?.getAttribute('title')).toBe('Longevidade');
});
it('shows the same derived attributes as the back of the card (look adds influence)',()=>{
 const {container}=renderApp(<FashionCardStats type="SCHEME" summary={{status:'AVAILABLE',dimensions:{POPULARITY:30,INFLUENCE:55}}}/>);
 expect(container.querySelectorAll('.fashion-hype-cell')).toHaveLength(9);
 expect(container.querySelector('[data-dimension="POPULARITY"]')?.getAttribute('data-tone')).toBe('low');expect(container.querySelector('[data-dimension="INFLUENCE"] dd')?.textContent).toBe('55');
});
