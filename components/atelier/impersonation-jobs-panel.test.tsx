// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,loggedAs,renderApp,screen,waitFor} from '@/test-utils/render';
import {ImpersonationJobsPanel} from './impersonation-jobs-panel';
const BASE='/api/me/aura-impersonation';
beforeEach(()=>{Object.assign(URL,{createObjectURL:vi.fn(()=>"blob:input-photo"),revokeObjectURL:vi.fn()});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('never generates without a configured worker',async()=>{
 const {calls}=loggedAs(undefined,{[`GET ${BASE}/capabilities`]:{available:false}});
 renderApp(<ImpersonationJobsPanel pieceId="p1" personMediaUrl="/media/source.png" template="STREET_IMPACT" allowed/>);
 await screen.findByText(/serviço de geração pessoal ainda não está disponível/);
 expect((screen.getByRole('button',{name:'Gerar vídeo pessoal'}) as HTMLButtonElement).disabled).toBe(true);
 expect(calls.some(c=>c.method==='POST'&&c.path.startsWith(BASE))).toBe(false);
});
it('requires consent and persists a real job request without claiming a finished video',async()=>{
 const {calls}=loggedAs(undefined,{[`GET ${BASE}/capabilities`]:{available:true},[`GET ${BASE}/jobs`]:[],[`POST ${BASE}/jobs`]:{id:'job-1',pieceId:'p1',status:'QUEUED',motionTemplateId:'STREET_IMPACT'}});
 renderApp(<ImpersonationJobsPanel pieceId="p1" personMediaUrl="/media/source.png" template="STREET_IMPACT" allowed/>);
 await waitFor(()=>expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(false));
 const button=screen.getByRole('button',{name:'Gerar vídeo pessoal'});
 expect((button as HTMLButtonElement).disabled).toBe(true);fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(button);
 await screen.findByText('Na fila de geração');
 expect(calls.find(c=>c.method==='POST'&&c.path===`${BASE}/jobs`)?.body).toMatchObject({pieceId:'p1',processingConsent:true,enableForPiece:true});
 expect(screen.queryByRole('button',{name:'Aplicar na peça'})).toBeNull();
});
it('keeps generation disabled below Loft even if the worker is online',async()=>{
 const {calls}=loggedAs(undefined,{[`GET ${BASE}/capabilities`]:{available:true},[`GET ${BASE}/jobs`]:[]});
 renderApp(<ImpersonationJobsPanel pieceId="p1" personMediaUrl="/media/source.png" template="STREET_IMPACT" allowed={false}/>);
 await screen.findByRole('button',{name:'Gerar vídeo pessoal'});
 expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
 expect(calls.some(c=>c.method==='POST'&&c.path.startsWith(BASE))).toBe(false);
});
it('uploads an owned person photo before submitting the generation request',async()=>{
 const {calls}=loggedAs(undefined,{[`GET ${BASE}/capabilities`]:{available:true},[`GET ${BASE}/jobs`]:[], 'POST /api/try-on/person-photos':{url:'/media/users/u1/person.jpg'},[`POST ${BASE}/jobs`]:{id:'job-2',pieceId:'p1',status:'QUEUED',motionTemplateId:'STREET_IMPACT'}});
 renderApp(<ImpersonationJobsPanel pieceId="p1" personMediaUrl="" template="STREET_IMPACT" allowed/>);
 const input=await screen.findByLabelText('Escolher minha foto vestindo a peça');
 await waitFor(()=>expect((input as HTMLInputElement).disabled).toBe(false));
 fireEvent.change(input,{target:{files:[new File(['fixture'],'photo.png',{type:'image/png'})]}});
 await waitFor(()=>expect(screen.getByAltText('Fotografia selecionada para animação').getAttribute('src')).toContain('blob:input-photo'));
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Gerar vídeo pessoal'}));
 await screen.findByText('Na fila de geração');
 expect(calls.find(c=>c.method==='POST'&&c.path===`${BASE}/jobs`)?.body).toMatchObject({personMediaUrl:'/media/users/u1/person.jpg'});
});
