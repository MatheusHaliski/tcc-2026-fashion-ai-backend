// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,renderApp,screen} from '@/test-utils/render';
import {PieceCreationGuide} from './piece-creation-guide';
afterEach(cleanup);
it('orienta em cinco etapas com figuras e permite terminar sem bloquear o criador',()=>{
 const close=vi.fn();renderApp(<PieceCreationGuide open onClose={close}/>);
 expect(screen.getByRole('img',{name:'Uma fotografia clara destaca a roupa.'})).toBeTruthy();
 for(let i=0;i<4;i++)fireEvent.click(screen.getByRole('button',{name:'Avançar'}));
 expect(screen.getByText(/Publicar a peça não garante/)).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Começar'}));expect(close).toHaveBeenCalledOnce();
});
