// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, renderApp, screen } from '@/test-utils/render';
import { CardBorderEditor } from './card-border-editor';
import { studioPart, writePieceArt, defaultArt } from '@/lib/piece-art';
afterEach(cleanup);
it('oferece cor e efeito estruturados preservando a arte durante a serialização',()=>{
 const onChange=vi.fn();renderApp(<CardBorderEditor value={{mode:'COLOR',color:'#123456',effect:'GLOW'}} onChange={onChange}/>);
 fireEvent.change(screen.getByLabelText('Cor da borda'),{target:{value:'#abcdef'}});
 expect(onChange).toHaveBeenCalledWith({mode:'COLOR',color:'#abcdef',effect:'GLOW'});
 const bg={border:{mode:'COLOR',color:'#abcdef',effect:'GLOW'},auraMetamorphose:'PRISMA',auraHype:'STARS'};
 expect(studioPart(bg)).toMatchObject(bg);
 expect(writePieceArt(bg,defaultArt())).toMatchObject(bg);
});
