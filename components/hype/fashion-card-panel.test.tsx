// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {cleanup,renderApp,screen} from '@/test-utils/render';
import {FashionCardHeader,FashionCardStats} from './fashion-card-panel';
afterEach(cleanup);
it('renders server rarity and actual global score in the header',()=>{
 const {container}=renderApp(<FashionCardHeader state={{kind:'available',score:84,level:'HOT',direction:null,stale:false}} summary={{status:'AVAILABLE',fashionCard:{status:'CLASSIFIED',tier:'RARE',ruleVersion:1,source:'HYPE_SIGNALS'}}}/>);
 expect(screen.getByText('Rara')).toBeTruthy();expect(screen.getByText('HYPE SCORE')).toBeTruthy();expect(container.querySelector('.led-number')?.textContent).toBe('84');expect(container.textContent).not.toContain('/99');expect(container.textContent).not.toContain('/100');
});
it('does not invent versatility, serial numbers or legacy',()=>{
 const {container}=renderApp(<FashionCardStats styles={['Streetwear','Y2K']}/>);
 expect(container.querySelectorAll('.fashion-hype-stat b')[0].textContent).toBe('—');expect(container.querySelectorAll('.fashion-hype-stat b')[1].textContent).toBe('—');expect(container.querySelector('.fashion-hype-edition')).toBeNull();expect(screen.getByText('Streetwear')).toBeTruthy();
});
it('displays only confirmed edition numbers and actual longevity',()=>{
 renderApp(<FashionCardStats summary={{status:'AVAILABLE',dimensions:{LONGEVITY:98},fashionCard:{status:'CLASSIFIED',tier:'COLLAB_DROP',ruleVersion:1,source:'VERIFIED_DROP',edition:{serial:42,total:100,confirmed:true}}}}/>);
 expect(screen.getByText(/#042\/100/)).toBeTruthy();expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('98');
});
