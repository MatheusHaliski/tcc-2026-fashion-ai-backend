import {expect,it} from 'vitest';
import * as THREE from 'three';
import {mirrorCameraPose,protectAvatarCamera} from './mirror-camera';
it('keeps mirror poses on the reflective side and frames the reflected head and feet for every mirror orientation',()=>{
 for(let angle=0;angle<Math.PI*2;angle+=.2){const n={x:Math.sin(angle),z:Math.cos(angle)},m={x:2,z:-1};const p=mirrorCameraPose({x:m.x+n.x*.3,z:m.z+n.z*.3},m,n,1.6,2.2);expect((p.position.x-m.x)*n.x+(p.position.z-m.z)*n.z).toBeCloseTo(.25);expect(p.target.y).toBeGreaterThan(0);
 const camera=new THREE.PerspectiveCamera(p.fov,.65,.05,30);camera.position.copy(p.position);camera.lookAt(p.target);camera.updateMatrixWorld();for(const y of [0,1.6/.93]){const projected=p.target.clone().setY(y).project(camera);expect(Math.abs(projected.y)).toBeLessThan(1);}}
});
it('wall clamping never pushes orbiting camera through the clothing envelope',()=>{
 const bounds={minX:-3,maxX:3,minZ:-3,maxZ:3};
 for(const actor of [{x:0,z:0},{x:2.6,z:2.6}])for(let a=0;a<Math.PI*2;a+=.1){const p=protectAvatarCamera(new THREE.Vector3(actor.x+Math.sin(a)*.1,1.6,actor.z+Math.cos(a)*.1),actor,bounds);expect(Math.hypot(p.x-actor.x,p.z-actor.z)).toBeGreaterThanOrEqual(.74999);expect(p.x).toBeLessThanOrEqual(2.85);expect(p.z).toBeLessThanOrEqual(2.85);}
});
