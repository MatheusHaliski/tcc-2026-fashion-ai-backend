// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,renderApp,screen,waitFor} from '@/test-utils/render';
import {api} from '@/lib/api/client';
import {PrivateMotionVideo} from './private-motion-video';
vi.mock('@/components/card-art',()=>({ArtVideo:({src}:{src:string})=><video data-testid="private-video" src={src}/>}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('fetches private media only after an explicit click and revokes it on close',async()=>{
 const fetch=vi.spyOn(api,'blobUrl').mockResolvedValue('blob:private-render');
 Object.assign(URL,{revokeObjectURL:vi.fn()});
 renderApp(<PrivateMotionVideo jobId="job-1"/>);
 expect(fetch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Carregar vídeo'}));
 await screen.findByTestId('private-video');
 expect(fetch).toHaveBeenCalledWith('/api/me/aura-impersonation/jobs/job-1/media');
 expect(screen.getByTestId('private-video').getAttribute('src')).toBe('blob:private-render');
 fireEvent.click(screen.getByRole('button',{name:'Fechar prévia'}));
 expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-render');
 expect(screen.queryByTestId('private-video')).toBeNull();
});
it('uses the visibility-checked piece endpoint for an applied card',async()=>{
 const fetch=vi.spyOn(api,'blobUrl').mockResolvedValue('blob:applied');Object.assign(URL,{revokeObjectURL:vi.fn()});
 renderApp(<PrivateMotionVideo jobId="job-1" path="/api/pieces/p1/aura-media/job-1"/>);
 fireEvent.click(screen.getByRole('button',{name:'Carregar vídeo'}));
 await waitFor(()=>expect(fetch).toHaveBeenCalledWith('/api/pieces/p1/aura-media/job-1'));
 await screen.findByTestId('private-video');
});
it('shows an error without rendering the protected URL if access is denied',async()=>{
 vi.spyOn(api,'blobUrl').mockRejectedValue(new Error('403'));
 renderApp(<PrivateMotionVideo jobId="job-1"/>);
 fireEvent.click(screen.getByRole('button',{name:'Carregar vídeo'}));
 await screen.findByRole('alert');expect(screen.queryByTestId('private-video')).toBeNull();
});
