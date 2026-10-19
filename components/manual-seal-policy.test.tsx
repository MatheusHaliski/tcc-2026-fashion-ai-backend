// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,renderApp,screen} from '@/test-utils/render';
import {ManualSealPolicy} from './manual-seal-policy';
vi.mock('@/lib/auth/session',()=>({useAuth:()=>({user:{id:'issuer'}}),AuthProvider:({children}:{children:unknown})=>children}));
vi.mock('@/lib/hooks/use-api',()=>({useApi:()=>({data:[{id:'a',name:'Selo A',tier:'PECA',status:'ACTIVE'},{id:'b',name:'Selo B',tier:'LOOK',status:'ACTIVE'},{id:'c',name:'Perfil',tier:'PERFIL',status:'ACTIVE'},{id:'d',name:'Suspenso',tier:'PECA',status:'INACTIVE'}],loading:false})}));
vi.mock('@/components/seal-policy-editor',()=>({SealPolicyEditor:()=>null,cleanPolicy:()=>true,describePolicy:()=> 'Peças compatíveis'}));
afterEach(cleanup);
it('permite um selo ou combinação ANY/ALL e não remove exigência vazia silenciosamente',()=>{
 const changed=vi.fn();renderApp(<ManualSealPolicy value={{match:'ALL',rules:[]}} tier="PERFIL" onChange={changed} onTier={vi.fn()}/>);
 fireEvent.click(screen.getByRole('switch'));
 expect(changed.mock.lastCall?.[0].referenceModel.earnedSeals.rules).toEqual([]);
 fireEvent.click(screen.getByLabelText('Selo A · PECA'));fireEvent.click(screen.getByLabelText('Selo B · LOOK'));
 expect(changed.mock.lastCall?.[0].referenceModel.earnedSeals).toMatchObject({match:'ALL',rules:[{sealId:'a'},{sealId:'b'}]});
 fireEvent.click(screen.getByLabelText('Condição dos selos conquistados'));fireEvent.click(screen.getByRole('option',{name:'Qualquer um dos selos selecionados'}));
 expect(changed.mock.lastCall?.[0].referenceModel.earnedSeals.match).toBe('ANY');
 expect(screen.queryByLabelText('Perfil · PERFIL')).toBeNull();expect(screen.queryByLabelText('Suspenso · PECA')).toBeNull();
 fireEvent.click(screen.getByRole('switch'));expect(changed.mock.lastCall?.[0].referenceModel.earnedSeals).toBeUndefined();
});
