'use client';
/*
 * MET Gala Heist (FLAIR Metamorfose — Afterparty) em 3D: o salão é a versão de gala do Meu Quarto — o mesmo piso de
 * madeira, as paredes da noite com rodapé, a janela com cortina, a porta de madeira, o tapete redondo FashionAI, o
 * letreiro de neon e o móvel FAI Origem — com tapete vermelho, cordões de veludo, lustres, seguranças e a vitrine da
 * joia. As cartas do deck (AfterpartyMods no servidor) mudam o salão — penumbra ou holofotes, convidados, rota VIP — e o
 * avatar — rastro de agilidade, sombra de furtividade, brilho de carisma. As coordenadas são as do motor (metros):
 * entrada ao sul (z = 5), portaria em z = 0, cordão VIP em z = −3, joia em (0, −5,5), crachá em (4, −2).
 */
import {Suspense,useMemo,useRef} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {ContactShadows} from '@react-three/drei';
import * as THREE from 'three';
import {Mannequin} from '@/components/three/mannequin';
import {useReducedMotion,type Look3d} from '@/components/three/common';
import type {HumanParts} from '@/components/three/human-avatar';
import {applyIdle} from '@/lib/avatar3d/human/pose';
import {FaiNeonSign,FaiRug,Label3D,Lamp,RoomDoor,RoomWindow,Sparkles} from '@/components/room3d/room-props';
import {useI18n} from '@/lib/i18n/i18n';
import {modsOf,vipRouteLeft,type AdventureMods,type AdventureSession} from '@/lib/flair/afterparty';

/** Salão: um pouco maior que a área do motor (x ±5, z ±7), com as paredes do quarto. */
export const HALL={minX:-5.6,maxX:5.6,minZ:-7.6,maxZ:7.6,h:3.2} as const;
/** Paleta da noite do Meu Quarto (room-scene.tsx) com o dourado e o veludo da gala. */
const C={floor:'#5a4636',floorDark:'#3f3127',wall:'#343747',wallSide:'#2e3140',strip:'#4a4038',ceiling:'#2a2c38',gold:'#c9a227',velvet:'#8a1c38',carpet:'#651e43',guard:'#12131b',guardDistracted:'#354d6e'};
/** Luz do salão conforme o deck: penumbra (seguranças enxergam menos), salão aceso, holofotes (enxergam mais). */
export const LIGHT={PENUMBRA:{ambient:.22,chandelier:.45,fog:14},SALAO:{ambient:.42,chandelier:1,fog:22},HOLOFOTES:{ambient:.5,chandelier:1.15,fog:26}} as const;
/** Lugares dos convidados, do mais perto da entrada para dentro; o deck decide quantos aparecem. */
export const GUEST_SPOTS:[number,number][]=[[-3.4,4.2],[3.6,3.6],[-4.2,1.6],[4.3,1.2],[-2.6,-1.8],[2.8,-1.4],[-4,-4.2],[4,-4.6],[-1.8,6.2],[2.2,6.4],[-4.6,-6.4],[4.6,-6.2]];

function Person({x,z,color='#111624',guard=false,name}:{x:number;z:number;color?:string;guard?:boolean;name?:string}){
 return <group position={[x,0,z]} name={name}><mesh position={[0,.95,0]} castShadow><capsuleGeometry args={[.23,.7,5,10]}/><meshStandardMaterial color={color} metalness={.15} roughness={.6}/></mesh><mesh position={[0,1.65,0]} castShadow><sphereGeometry args={[.17,12,10]}/><meshStandardMaterial color="#b9977a"/></mesh>{[-.13,.13].map(v=><mesh key={v} position={[v,.28,0]} castShadow><boxGeometry args={[.15,.55,.18]}/><meshStandardMaterial color={color}/></mesh>)}{guard&&<><mesh position={[0,1.67,.16]}><boxGeometry args={[.32,.07,.05]}/><meshStandardMaterial color="#000"/></mesh><mesh position={[.1,1.15,.24]}><boxGeometry args={[.08,.11,.02]}/><meshStandardMaterial color="#d5bd73" emissive="#6b5522"/></mesh></>}</group>;
}

/** Segurança da portaria olhando para a entrada, com a lanterna: cone menor na penumbra, maior com holofotes. */
function Guard({x,distracted,zoneMul}:{x:number;distracted:boolean;zoneMul:number}){
 const target=useMemo(()=>new THREE.Object3D(),[]);
 return <group name="heist-guard"><Person x={x} z={-.1} guard color={distracted?C.guardDistracted:C.guard}/>
  <primitive object={target} position={[x*.4,0,2.6]}/>
  {!distracted&&<spotLight position={[x,1.5,0]} target={target} angle={.32*zoneMul} penumbra={.6} intensity={6*zoneMul} distance={6} color="#fff3d6"/>}
 </group>;
}

/** Convidados da festa (cobertura): balançam devagar; com movimento reduzido ficam parados. */
function Guests({count,reduced}:{count:number;reduced:boolean}){
 const ref=useRef<THREE.Group>(null);
 const palette=['#c06090','#2d55c9','#e7b75f','#1baf7a','#7a4a9a','#d9d2c4'];
 useFrame(({clock})=>{if(reduced||!ref.current)return;ref.current.children.forEach((g,i)=>{g.position.y=Math.sin(clock.elapsedTime*1.6+i)*.02;g.rotation.y=Math.sin(clock.elapsedTime*.4+i*1.7)*.5;});});
 return <group ref={ref} name="heist-guests">{GUEST_SPOTS.slice(0,count).map(([x,z],i)=><group key={i} name="heist-guest"><Person x={x} z={z} color={palette[i%palette.length]}/></group>)}</group>;
}

/** Cordão de veludo entre postes dourados; aberto, a corda cai no chão ao lado do último poste. */
function VelvetRope({x0,x1,z,open,name}:{x0:number;x1:number;z:number;open:boolean;name:string}){
 const posts=[x0,(x0*2+x1)/3,(x0+x1*2)/3,x1];
 const ropes=useMemo(()=>posts.slice(0,-1).map((a,i)=>{const b=posts[i+1],mid=(a+b)/2;return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(a,.88,0),new THREE.Vector3(mid,.62,0),new THREE.Vector3(b,.88,0)),16,.022,6,false);}),[x0,x1]); // eslint-disable-line react-hooks/exhaustive-deps
 return <group position={[0,0,z]} name={name} userData={{open}}>
  {posts.map(x=><group key={x} position={[x,0,0]}><mesh position={[0,.46,0]} castShadow><cylinderGeometry args={[.035,.05,.92,12]}/><meshStandardMaterial color={C.gold} metalness={.85} roughness={.25}/></mesh><mesh position={[0,.95,0]}><sphereGeometry args={[.06,14,10]}/><meshStandardMaterial color={C.gold} metalness={.9} roughness={.2}/></mesh><mesh position={[0,.02,0]}><cylinderGeometry args={[.16,.18,.04,20]}/><meshStandardMaterial color={C.gold} metalness={.8} roughness={.3}/></mesh></group>)}
  {open?<mesh position={[x1-.4,.03,.15]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.8,.05]}/><meshStandardMaterial color={C.velvet}/></mesh>
   :ropes.map((g,i)=><mesh key={i} geometry={g}><meshStandardMaterial color={C.velvet} roughness={.85}/></mesh>)}
 </group>;
}

/** Área que os seguranças enxergam (a mesma regra do motor: |x| < 2,4 × luz, −0,7 < z < 3,4), pintada no chão. */
function SightZone({zoneMul,seen}:{zoneMul:number;seen:boolean}){
 const w=4.8*zoneMul;
 return <mesh name="heist-sight" rotation={[-Math.PI/2,0,0]} position={[0,.025,1.35]} userData={{width:w}}><planeGeometry args={[w,4.1]}/><meshBasicMaterial color={seen?'#e0443a':'#f0c060'} transparent opacity={seen?.22:.1} depthWrite={false}/></mesh>;
}

function Chandelier({position,intensity}:{position:[number,number,number];intensity:number}){
 const crystals=useMemo(()=>Array.from({length:14},(_,i)=>{const a=i/14*Math.PI*2;return [Math.cos(a)*.42,-.1-(i%2)*.12,Math.sin(a)*.42] as [number,number,number];}),[]);
 return <group position={position} name="heist-chandelier">
  <mesh><torusGeometry args={[.45,.02,8,40]}/><meshStandardMaterial color={C.gold} metalness={.9} roughness={.2}/></mesh>
  <mesh position={[0,.35,0]}><cylinderGeometry args={[.01,.01,.7,6]}/><meshStandardMaterial color={C.gold}/></mesh>
  {crystals.map((p,i)=><mesh key={i} position={p}><octahedronGeometry args={[.05]}/><meshStandardMaterial color="#fff8e6" emissive="#ffe2a8" emissiveIntensity={.8*intensity} toneMapped={false}/></mesh>)}
  <pointLight position={[0,-.3,0]} intensity={14*intensity} distance={9} color="#ffdcae"/>
 </group>;
}

/** Vitrine da joia no fundo do salão: pedestal, redoma de vidro e o holofote; levada a joia, a redoma fica vazia. */
function JewelDisplay({taken,reduced}:{taken:boolean;reduced:boolean}){
 const gem=useRef<THREE.Mesh>(null);
 useFrame((_,dt)=>{if(gem.current&&!reduced)gem.current.rotation.y+=dt*.8;});
 return <group position={[0,0,-5.5]} name="heist-jewel" userData={{taken}}>
  <mesh position={[0,.45,0]} castShadow><cylinderGeometry args={[.32,.4,.9,24]}/><meshStandardMaterial color="#f1ece2" roughness={.4}/></mesh>
  <mesh position={[0,.91,0]}><cylinderGeometry args={[.36,.36,.03,24]}/><meshStandardMaterial color={C.gold} metalness={.85} roughness={.25}/></mesh>
  <mesh position={[0,1.2,0]}><boxGeometry args={[.5,.55,.5]}/><meshPhysicalMaterial color="#e8f4ff" transparent opacity={.18} roughness={.05} transmission={.6}/></mesh>
  {!taken&&<><mesh ref={gem} position={[0,1.18,0]}><octahedronGeometry args={[.14]}/><meshStandardMaterial color="#e1c66d" emissive="#795f20" metalness={.7} roughness={.2}/></mesh><pointLight position={[0,1.5,0]} color="#e9cd73" intensity={8} distance={4}/></>}
 </group>;
}

/** Penteadeira do camarim (a do quarto, com lâmpadas) onde fica o crachá da equipe. */
function BadgeVanity({taken}:{taken:boolean}){
 return <group position={[4.85,0,-2]} rotation={[0,-Math.PI/2,0]} name="heist-badge" userData={{taken}}>
  <mesh position={[0,.42,0]} castShadow><boxGeometry args={[1.1,.84,.5]}/><meshStandardMaterial color="#e9e3d7" roughness={.6}/></mesh>
  <mesh position={[0,1.45,-.22]}><boxGeometry args={[.9,1.1,.04]}/><meshStandardMaterial color="#2b2622" metalness={.5} roughness={.35}/></mesh>
  <mesh position={[0,1.45,-.195]}><planeGeometry args={[.8,1]}/><meshStandardMaterial color="#aab3b8" metalness={.85} roughness={.12}/></mesh>
  {[-1,1].flatMap(side=>[0,1,2,3].map(i=><mesh key={`${side}-${i}`} position={[side*.48,1.0+i*.3,-.18]}><sphereGeometry args={[.025,12,10]}/><meshStandardMaterial color="#fff4d6" emissive="#ffd9a0" emissiveIntensity={1.2} toneMapped={false}/></mesh>))}
  {!taken&&<mesh position={[0,.86,.05]}><boxGeometry args={[.2,.025,.3]}/><meshStandardMaterial color="#6be1d4" emissive="#2b7369"/></mesh>}
 </group>;
}

/** Móvel FAI Origem do quarto (carcaça, portas e puxadores dourados) como fundo do salão VIP. */
function GalaWardrobe({x}:{x:number}){
 return <group position={[x,0,HALL.minZ+.32]} name="heist-wardrobe">
  <mesh position={[0,1.2,0]} castShadow receiveShadow><boxGeometry args={[2.4,2.4,.6]}/><meshStandardMaterial color="#efe9df" roughness={.6}/></mesh>
  {[-.9,-.3,.3,.9].map(dx=><group key={dx} position={[dx,1.2,.305]}><mesh><planeGeometry args={[.56,2.2]}/><meshStandardMaterial color="#e6dfd2" roughness={.5}/></mesh><mesh position={[dx<0?.22:-.22,0,.02]}><boxGeometry args={[.02,.4,.02]}/><meshStandardMaterial color={C.gold} metalness={.85} roughness={.25}/></mesh></group>)}
  <mesh position={[0,2.42,.2]}><boxGeometry args={[2.3,.03,.1]}/><meshStandardMaterial color="#fff6e4" emissive="#ffe2b8" emissiveIntensity={1.2} toneMapped={false}/></mesh>
 </group>;
}

/** Passagem de serviço nas laterais (o disfarce de equipe passa por ela). */
function ServiceDoor({x,label}:{x:number;label:string}){
 return <group position={[x,0,0]} name="heist-service-door">
  <mesh position={[0,1.1,0]}><boxGeometry args={[.12,2.2,1.2]}/><meshStandardMaterial color="#c9c4b8" roughness={.6}/></mesh>
  <Label3D text={label} w={.5} h={.12} px={256} bg="#2b2622" fg="#f3ead8" position={[x<0?.07:-.07,2.35,0]} rotation={[0,x<0?Math.PI/2:-Math.PI/2,0]}/>
 </group>;
}

/** Câmera atrás do avatar, olhando para o fundo do salão (onde está a joia); segue sem tranco. */
function FollowCamera({x,z,reduced}:{x:number;z:number;reduced:boolean}){
 const {camera}=useThree();const look=useMemo(()=>new THREE.Vector3(),[]);const want=useMemo(()=>new THREE.Vector3(),[]);
 useFrame((_,dt)=>{want.set(x*.7,6.2,z+7.2);const k=reduced?1:1-Math.exp(-4*Math.min(dt,.1));camera.position.lerp(want,k);look.lerp(new THREE.Vector3(x*.85,.9,z-1.6),k);camera.lookAt(look);});
 return null;
}

/**
 * O avatar com o look ativo, andando de verdade (passada das pernas e dos braços) entre as posições do servidor. As
 * cartas aparecem nele: rastro de velocidade (agilidade), sombra que esconde (furtividade) ou halo que denuncia (pouca
 * furtividade) e brilho (carisma).
 */
function Player({session,look,mods}:{session:AdventureSession;look:Look3d|null;mods:AdventureMods}){
 const body=useRef<THREE.Group>(null);const ring=useRef<THREE.Mesh>(null);const trail=useRef<THREE.Mesh>(null);const reduced=useReducedMotion();
 const last=useRef({x:session.state.x,z:session.state.z});const moving=useRef(false);const parts=useRef<HumanParts|null>(null);const phase=useRef(0);
 const initialPosition=useRef<[number,number,number]>([session.state.x,0,session.state.z]);const s=session.state;const active=s.activeDeckId!==null&&s.activeUntil>session.serverTime;
 const motes=useMemo(()=>Array.from({length:24},(_,i)=>({x:Math.sin(i*2.4)*.6,z:Math.cos(i*2.4)*.6,y:.3+(i%8)*.22})),[]);
 useFrame(({clock},dt)=>{
  const b=body.current;if(!b)return;const dx=s.x-last.current.x,dz=s.z-last.current.z;if(Math.hypot(dx,dz)>.001){b.rotation.y=Math.atan2(dx,dz);last.current={x:s.x,z:s.z};}
  const distance=Math.hypot(b.position.x-s.x,b.position.z-s.z);moving.current=distance>.03;const factor=reduced?1:1-Math.exp(-12*Math.min(dt,.1));
  b.position.x=THREE.MathUtils.lerp(b.position.x,s.x,factor);b.position.z=THREE.MathUtils.lerp(b.position.z,s.z,factor);
  const p=parts.current;
  if(p){applyIdle(p.human,p.pose,clock.elapsedTime,moving.current?0:.3);
   if(moving.current&&!reduced){phase.current+=dt*(s.running?11:7)*mods.speedMul;for(const [side,off] of [['Left',0],['Right',Math.PI]] as const){const sw=Math.sin(phase.current+off)*(s.running?.45:.32);p.human.bone(`${side}UpLeg`).rotateX(sw);p.human.bone(`${side}Leg`).rotateX(Math.max(0,-sw)*.8);p.human.bone(`${side}Arm`).rotateX(-sw*.6);}}}
  else b.position.y=reduced||!moving.current?0:Math.sin(clock.elapsedTime*(s.running?14:9))*.025;
  if(ring.current&&!reduced)ring.current.rotation.z+=dt*.8;
  if(trail.current){const m=trail.current.material as THREE.MeshBasicMaterial;m.opacity=THREE.MathUtils.lerp(m.opacity,moving.current&&mods.agility>=60?.35:0,1-Math.exp(-8*dt));}
 });
 return <group>
  <group ref={body} position={initialPosition.current} name="heist-player">
   {look?<Suspense fallback={<Person x={0} z={0} color={s.color}/>}><Mannequin mannequin={look.mannequin} pieces={look.pieces} externalPose onHuman={(h)=>{parts.current=h;}} fallback={<Person x={0} z={0} color={s.color}/>}/></Suspense>:<Person x={0} z={0} color={s.color}/>}
   {/* agilidade: rastro atrás de quem anda depressa */}
   <mesh ref={trail} name="heist-trail" position={[0,.9,-.7]} rotation={[0,0,0]}><planeGeometry args={[.5,1.4]}/><meshBasicMaterial color="#9fd8ff" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide}/></mesh>
   {/* furtividade: sombra que esconde (alta) ou halo que denuncia (baixa) */}
   {mods.stealth>=60&&<mesh name="heist-cloak" rotation={[-Math.PI/2,0,0]} position={[0,.03,0]}><circleGeometry args={[.9,32]}/><meshBasicMaterial color="#05060a" transparent opacity={.45} depthWrite={false}/></mesh>}
   {mods.stealth<=40&&<group name="heist-exposed"><mesh rotation={[-Math.PI/2,0,0]} position={[0,.03,0]}><ringGeometry args={[.55,.75,40]}/><meshBasicMaterial color="#ffd27a" transparent opacity={.5} depthWrite={false}/></mesh><pointLight position={[0,2.4,0]} intensity={5} distance={4} color="#fff0c8"/></group>}
   {/* carisma: brilho em volta */}
   {mods.charm>=60&&<group name="heist-charm" position={[0,.2,0]}><Sparkles count={30} radius={.45} reduced={reduced}/></group>}
  </group>
  {active&&<group position={[s.x,0,s.z]}><pointLight color={s.color} intensity={16} distance={7} decay={2}/><mesh ref={ring} position={[0,.9,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.68,.018,5,48]}/><meshBasicMaterial color={s.color} transparent opacity={.65}/></mesh>{motes.map((p,i)=><mesh key={i} position={[p.x,p.y,p.z]}><sphereGeometry args={[.018,5,5]}/><meshBasicMaterial color={s.color}/></mesh>)}</group>}
 </group>;
}

/** Holofotes que varrem o salão (deck claro e statement): mais luz, mais olhos. */
function Searchlights({reduced}:{reduced:boolean}){
 const targets=useMemo(()=>[new THREE.Object3D(),new THREE.Object3D()],[]);
 useFrame(({clock})=>{if(reduced)return;targets[0].position.set(Math.sin(clock.elapsedTime*.6)*3.5,0,1.5);targets[1].position.set(Math.sin(clock.elapsedTime*.6+Math.PI)*3.5,0,-2);});
 return <group name="heist-searchlights">{targets.map((t,i)=><group key={i}><primitive object={t} position={[i?-2:2,0,i?-2:1.5]}/><spotLight position={[i?-4.5:4.5,3,i?-5:4]} target={t} angle={.3} penumbra={.4} intensity={22} distance={14} color="#f4f0ff"/></group>)}</group>;
}

export function HeistWorld({session,look,onTarget}:{session:AdventureSession;look:Look3d|null;onTarget:(x:number,z:number)=>void}){
 const {t}=useI18n();const reduced=useReducedMotion();const s=session.state;const now=session.serverTime;const mods=modsOf(s);const L=LIGHT[mods.light];
 const active=s.activeUntil>now&&s.activeDeckId!==null;
 const vip=s.badge||active&&['VIP','EVENT_VIP'].includes(s.role)||s.distractionUntilLeft>now&&s.distractionUntilRight>now||vipRouteLeft(session)>0;
 const entry=vip||active&&s.role==='GUEST';
 const seen=Math.abs(s.x)<2.4*mods.zoneMul&&s.z>-.7&&s.z<3.4&&(s.distractionUntilLeft<=now||s.distractionUntilRight<=now);
 const W=HALL.maxX-HALL.minX,D=HALL.maxZ-HALL.minZ,cx=(HALL.minX+HALL.maxX)/2,cz=(HALL.minZ+HALL.maxZ)/2;
 return <>
  <color attach="background" args={[C.ceiling]}/><fog attach="fog" args={[C.ceiling,L.fog*.55,L.fog]}/>
  <ambientLight intensity={L.ambient}/><hemisphereLight args={['#ffe9d0','#2a2230',L.ambient*.6]}/>
  <directionalLight position={[4,9,6]} intensity={.5+L.ambient} castShadow shadow-mapSize={[1024,1024]}/>
  {/* piso de madeira e teto do quarto */}
  <mesh name="heist-floor" rotation={[-Math.PI/2,0,0]} position={[cx,0,cz]} receiveShadow onPointerDown={e=>{e.stopPropagation();onTarget(e.point.x,e.point.z);}}><planeGeometry args={[W,D]}/><meshStandardMaterial color={mods.light==='PENUMBRA'?C.floorDark:C.floor} roughness={.55} metalness={.1}/></mesh>
  <mesh rotation={[Math.PI/2,0,0]} position={[cx,HALL.h,cz]}><planeGeometry args={[W,D]}/><meshStandardMaterial color={C.ceiling} roughness={1}/></mesh>
  {/* paredes com rodapé (as do quarto à noite) */}
  {([[cx,HALL.minZ,0,W,C.wall],[HALL.minX,cz,Math.PI/2,D,C.wallSide],[HALL.maxX,cz,-Math.PI/2,D,C.wallSide]] as [number,number,number,number,string][]).map(([x,z,yaw,w,color],i)=><group key={i} position={[x,0,z]} rotation={[0,yaw,0]}>
   <mesh position={[0,HALL.h/2,0]} receiveShadow><planeGeometry args={[w,HALL.h]}/><meshStandardMaterial color={color} roughness={1}/></mesh>
   <mesh position={[0,.08,.01]}><planeGeometry args={[w,.16]}/><meshStandardMaterial color={C.strip} roughness={1}/></mesh>
  </group>)}
  {/* parede sul baixa (a câmera fica do lado de cá, como nas paredes recortadas do quarto); a porta de saída fica na
      parede oeste, perto da entrada, para não tapar a vista */}
  <group position={[0,0,HALL.maxZ]} rotation={[0,Math.PI,0]}><mesh position={[0,.08,0]}><planeGeometry args={[W,.16]}/><meshStandardMaterial color={C.strip}/></mesh></group>
  <group name="heist-exit"><RoomDoor position={[HALL.minX+.05,0,6.3]} rotation={[0,Math.PI/2,0]} night/><Label3D text={t('afterparty.exit')} w={.7} h={.16} px={256} bg="#2b2622" fg="#f3ead8" position={[HALL.minX+.08,2.35,6.3]} rotation={[0,Math.PI/2,0]}/></group>
  {/* objetos do quarto */}
  <FaiRug position={[0,.012,5]} radius={1.1} night/>
  <FaiNeonSign position={[0,2.55,HALL.minZ+.03]} w={1.6}/>
  <GalaWardrobe x={-3.4}/><GalaWardrobe x={3.4}/>
  <RoomWindow position={[HALL.minX+.02,1.6,3]} period="night" light={false}/>
  <group rotation={[0,Math.PI/2,0]} position={[HALL.minX+.02,1.6,-3]}><RoomWindow position={[0,0,0]} period="night" light={false}/></group>
  <Lamp position={[-4.9,0,6.6]} on intensity={mods.light==='PENUMBRA'?.6:1}/><Lamp position={[4.9,0,6.6]} on intensity={mods.light==='PENUMBRA'?.6:1}/>
  {/* gala: tapete vermelho, lustres, cordões, portaria e vitrine */}
  <mesh position={[0,.02,-.5]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[1.8,12.8]}/><meshStandardMaterial color={C.carpet} roughness={.85}/></mesh>
  {/* lustres dos lados e um sobre a vitrine: o corredor do tapete fica livre para a câmera ver o avatar */}
  <Chandelier position={[-2.7,2.75,1.6]} intensity={L.chandelier}/><Chandelier position={[2.7,2.75,1.6]} intensity={L.chandelier}/><Chandelier position={[0,2.75,-4.4]} intensity={L.chandelier}/>
  {mods.light==='HOLOFOTES'&&<Searchlights reduced={reduced}/>}
  <VelvetRope x0={-3} x1={3} z={0} open={entry} name="heist-rope-gate"/>
  <VelvetRope x0={-3} x1={3} z={-3} open={vip} name="heist-rope-vip"/>
  <SightZone zoneMul={mods.zoneMul} seen={seen&&s.status==='ACTIVE'}/>
  <Guard x={-1.4} distracted={s.distractionUntilLeft>now} zoneMul={mods.zoneMul}/><Guard x={1.4} distracted={s.distractionUntilRight>now} zoneMul={mods.zoneMul}/>
  <ServiceDoor x={HALL.minX+.06} label={t('afterparty.scene.staff')}/><ServiceDoor x={HALL.maxX-.06} label={t('afterparty.scene.staff')}/>
  <Guests count={mods.guests} reduced={reduced}/>
  <BadgeVanity taken={s.badge}/>
  <JewelDisplay taken={s.item} reduced={reduced}/>
  <Player session={session} look={look} mods={mods}/>
  <FollowCamera x={s.x} z={s.z} reduced={reduced}/>
  <ContactShadows position={[0,.012,0]} opacity={.25} scale={22} blur={2} far={4}/>
 </>;
}

export default function AfterpartyScene(props:{session:AdventureSession;look:Look3d|null;onTarget:(x:number,z:number)=>void}){
 return <Canvas shadows dpr={[1,1.5]} camera={{position:[0,6.2,props.session.state.z+7.2],fov:50,near:.1,far:60}}><HeistWorld {...props}/></Canvas>;
}
