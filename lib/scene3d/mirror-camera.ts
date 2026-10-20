import * as THREE from 'three';
/** A first-person mirror pose frames the reflected body, not furniture outside the glass. */
export function mirrorCameraPose(actor:{x:number;z:number},mirror:{x:number;z:number},normal:{x:number;z:number},eyeHeight:number,top:number){
 const n=new THREE.Vector3(normal.x,0,normal.z).normalize();
 const position=new THREE.Vector3(actor.x,eyeHeight,actor.z).addScaledVector(n,-.18);
 const signed=(position.x-mirror.x)*n.x+(position.z-mirror.z)*n.z;
 if(signed<.25)position.addScaledVector(n,.25-signed);
 const actorDistance=(actor.x-mirror.x)*n.x+(actor.z-mirror.z)*n.z;
 const bodyHeight=eyeHeight/.93;
 const reflected=new THREE.Vector3(actor.x,Math.min(top,bodyHeight),actor.z).addScaledVector(n,-2*actorDistance);
 const head=reflected.clone().setY(bodyHeight).sub(position).normalize();
 const foot=reflected.clone().setY(0).sub(position).normalize();
 // Bisect the head/foot viewing angles. Aiming at the geometric body centre clips the head
 // when the eyes are close to the mirror, even with a wide lens.
 const direction=head.clone().add(foot).normalize();
 const horizontalDistance=Math.hypot(reflected.x-position.x,reflected.z-position.z);
 const horizontalDirection=Math.hypot(direction.x,direction.z);
 const target=position.clone().addScaledVector(direction,horizontalDistance/Math.max(.001,horizontalDirection));
 const halfAngle=Math.max(direction.angleTo(head),direction.angleTo(foot));
 const fov=THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(halfAngle*2)*1.22,48,120);
 return {position,target,fov};
}
/** Keep an orbit outside the avatar/clothing envelope even after wall clamping. */
export function protectAvatarCamera(position:THREE.Vector3,actor:{x:number;z:number},bounds:{minX:number;maxX:number;minZ:number;maxZ:number}={minX:-Infinity,maxX:Infinity,minZ:-Infinity,maxZ:Infinity},radius=.75){
 const clamp=(p:THREE.Vector3)=>p.set(THREE.MathUtils.clamp(p.x,bounds.minX+.15,bounds.maxX-.15),p.y,THREE.MathUtils.clamp(p.z,bounds.minZ+.15,bounds.maxZ-.15));
 const desired=clamp(position.clone());if(Math.hypot(desired.x-actor.x,desired.z-actor.z)>=radius)return desired;
 let best:THREE.Vector3|null=null,bestCost=Infinity;
 const angle=Math.atan2(desired.x-actor.x,desired.z-actor.z);
 for(let i=0;i<32;i++){const a=angle+i*Math.PI/16,p=clamp(new THREE.Vector3(actor.x+Math.sin(a)*radius,position.y,actor.z+Math.cos(a)*radius));
  if(Math.hypot(p.x-actor.x,p.z-actor.z)<radius-1e-6)continue;
  const cost=p.distanceToSquared(desired);if(cost<bestCost){best=p;bestCost=cost;}}
 return best??desired;
}
