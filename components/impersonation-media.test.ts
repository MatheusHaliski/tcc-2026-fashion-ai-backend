import {expect,it} from 'vitest';
import {impersonationMedia} from './impersonation-media';
const background={auraImpersonation:true,impersonationData:{status:'READY',ownerId:'u1',renderedMediaType:'video/mp4',renderedCardMediaUrl:'/media/users/u1/card.mp4'}};
it('renders only ready, owner-bound and explicitly equipped video',()=>{
 expect(impersonationMedia(background,'u1')?.src).toBe('/media/users/u1/card.mp4');
 expect(impersonationMedia(background,'u2')).toBeNull();
 expect(impersonationMedia({...background,auraImpersonation:false},'u1')).toBeNull();
 expect(impersonationMedia({...background,impersonationData:{...background.impersonationData,status:'MOCK_PREVIEW'}},'u1')).toBeNull();
});
