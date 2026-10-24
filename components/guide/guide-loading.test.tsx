// @vitest-environment jsdom
import {useState} from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {renderApp,cleanup,screen,fireEvent} from '@/test-utils/render';
const pending=vi.hoisted(()=>new Promise<never>(()=>{}));
vi.mock('@/components/guide/guide-demos',()=>({GuideDemo:()=>{throw pending;}}));
import {GuideDialog} from './guide';
afterEach(cleanup);
it('mantém instruções e Escape disponíveis enquanto a demonstração suspende',async()=>{
 function Harness(){const [open,setOpen]=useState(true);return open?<GuideDialog guideKey="moments.calendar" initiallyHidden={false} onClose={()=>setOpen(false)}/>:null;}
 renderApp(<Harness/>);
 const dialog=await screen.findByRole('dialog');
 expect(dialog.textContent).toContain('Momentos: o calendário da moda');
 fireEvent.keyDown(dialog,{key:'Escape'});
 expect(screen.queryByRole('dialog')).toBeNull();
});
it('renders the feed card immediately even while the other demonstrations are suspended',async()=>{
 renderApp(<GuideDialog guideKey="feed.posts" initiallyHidden={false} onClose={()=>undefined}/>);
 const dialog=await screen.findByRole('dialog');
 expect(dialog.querySelector('.gd-feed .piece-card')).not.toBeNull();
 expect(screen.getByRole('button',{name:'Entendi'})).toBeTruthy();
});
