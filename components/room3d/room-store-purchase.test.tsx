// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {RoomStore} from './room-store';
import {cleanup,fireEvent,loggedAs,renderApp,screen,waitFor} from '@/test-utils/render';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),replace:vi.fn()}),usePathname:()=>'/points/loja',useSearchParams:()=>new URLSearchParams()}));
const item={sku:'TEST',name:'Acabamento FAI',kind:'COMPONENT',moldId:'door',slotType:'door',blockLabel:'Porta',pricePoints:100,requiredLevel:'ESTREIA',availability:'DISPONIVEL',compatibleModules:['door:1'],affordable:true,levelOk:true,inventory:[],finish:{color:'#fff'}};
beforeEach(()=>localStorage.clear());afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('explica uso e exige confirmação antes de enviar qualquer compra',async()=>{
 let sentKey:string|null=null;
 const {calls}=loggedAs(undefined,{'GET /api/points/shop':[item],'POST /api/points/shop/TEST/purchase':(_u:URL,init:RequestInit)=>{sentKey=(init.headers as Record<string,string>)['Idempotency-Key']??null;return {inventoryId:'i1',balance:50};}});
 renderApp(<RoomStore/>);await screen.findByText('Acabamento FAI');
 fireEvent.click(screen.getByRole('button',{name:'Mais informações'}));expect(await screen.findByText(/Este item personaliza Porta/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:/Fechar/i}));
 fireEvent.click(screen.getByRole('button',{name:'Comprar',exact:true}));expect(calls.filter(c=>c.method==='POST'&&c.path.includes('purchase'))).toHaveLength(0);
 fireEvent.click(screen.getByRole('button',{name:'Confirmar compra'}));await waitFor(()=>expect(calls.filter(c=>c.path.includes('purchase'))).toHaveLength(1));
 expect(sentKey).toMatch(/^[A-Za-z0-9-]{16,64}$/);   // chave de compra: um reenvio depois de timeout não cobra de novo
 expect(await screen.findByText(/Montar ·|Montar Acabamento|Montar:|Acabamento FAI/, {selector:'h2'})).toBeTruthy();
});
it('saldo insuficiente abre modal sem enviar compra',async()=>{
 const {calls}=loggedAs(undefined,{'GET /api/points/shop':[{...item,affordable:false}]});renderApp(<RoomStore/>);await screen.findByText('Acabamento FAI');fireEvent.click(screen.getByRole('button',{name:'Comprar',exact:true}));
 expect((await screen.findByRole('alert')).textContent).toContain('Nenhum ponto foi descontado');expect(calls.filter(c=>c.path.includes('purchase'))).toHaveLength(0);
});
it('saldo alterado no servidor é rejeitado em modal após confirmação',async()=>{
 loggedAs(undefined,{'GET /api/points/shop':[item],'POST /api/points/shop/TEST/purchase':()=>new Response(JSON.stringify({code:'SALDO_INSUFICIENTE',message:'Saldo insuficiente no servidor.'}),{status:409,headers:{'content-type':'application/json'}})});renderApp(<RoomStore/>);await screen.findByText('Acabamento FAI');fireEvent.click(screen.getByRole('button',{name:'Comprar',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Confirmar compra'}));expect((await screen.findByRole('alert')).textContent).toContain('Saldo insuficiente no servidor.');
});
