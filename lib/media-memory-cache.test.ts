// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();vi.resetModules();});
it('deduplica downloads em andamento e limita memória e concorrência',async()=>{
 vi.useFakeTimers();const images:any[]=[];
 class FakeImage{onload:any;onerror:any;src='';decoding='';constructor(){images.push(this);}}
 vi.stubGlobal('Image',FakeImage);const {warmMediaImage}=await import('./media-memory-cache');
 warmMediaImage('/a.jpg');warmMediaImage('/a.jpg');expect(images).toHaveLength(1);
 for(let i=0;i<40;i++)warmMediaImage(`/image-${i}.jpg`);
 expect(images).toHaveLength(3);
 let completed=0;while(completed<images.length){images[completed++].onload();}
 expect(images).toHaveLength(24);warmMediaImage('/a.jpg');expect(images).toHaveLength(24);
});
