'use client';
import {Suspense,useMemo,useRef} from 'react';
import {Canvas,useFrame} from '@react-three/fiber';
import {ContactShadows} from '@react-three/drei';
import * as THREE from 'three';
import {Mannequin} from '@/components/three/mannequin';
import {useReducedMotion,type Look3d} from '@/components/three/common';
import type {AdventureSession} from '@/lib/flair/afterparty';

function Person({x,z,color='#111624',guard=false}:{x:number;z:number;color?:string;guard?:boolean}){
 return <group position={[x,0,z]}><mesh position={[0,.95,0]} castShadow><capsuleGeometry args={[.23,.7,5,10]}/><meshStandardMaterial color={color} metalness={.15} roughness={.6}/></mesh><mesh position={[0,1.65,0]} castShadow><sphereGeometry args={[.17,12,10]}/><meshStandardMaterial color="#b9977a"/></mesh>{[-.13,.13].map(v=><mesh key={v} position={[v,.28,0]} castShadow><boxGeometry args={[.15,.55,.18]}/><meshStandardMaterial color={color}/></mesh>)}{guard&&<><mesh position={[0,1.67,.16]}><boxGeometry args={[.32,.07,.05]}/><meshStandardMaterial color="#000"/></mesh><mesh position={[.1,1.15,.24]}><boxGeometry args={[.08,.11,.02]}/><meshStandardMaterial color="#d5bd73" emissive="#6b5522"/></mesh></>}</group>;
}
function Player({session,look}:{session:AdventureSession;look:Look3d|null}){
 const body=useRef<THREE.Group>(null);const ring=useRef<THREE.Mesh>(null);const reduced=useReducedMotion();const last=useRef({x:session.state.x,z:session.state.z});const moving=useRef(false);const initialPosition=useRef<[number,number,number]>([session.state.x,0,session.state.z]);const s=session.state;const active=s.activeDeckId!==null&&s.activeUntil>session.serverTime;
 const motes=useMemo(()=>Array.from({length:24},(_,i)=>({x:Math.sin(i*2.4)*.6,z:Math.cos(i*2.4)*.6,y:.3+(i%8)*.22})),[]);
 useFrame(({clock},dt)=>{const b=body.current;if(!b)return;const dx=s.x-last.current.x,dz=s.z-last.current.z;if(Math.hypot(dx,dz)>.001){b.rotation.y=Math.atan2(dx,dz);last.current={x:s.x,z:s.z};}const distance=Math.hypot(b.position.x-s.x,b.position.z-s.z);moving.current=distance>.03;const factor=reduced?1:1-Math.exp(-12*Math.min(dt,.1));b.position.x=THREE.MathUtils.lerp(b.position.x,s.x,factor);b.position.z=THREE.MathUtils.lerp(b.position.z,s.z,factor);b.position.y=reduced||!moving.current?0:Math.sin(clock.elapsedTime*(s.running?14:s.role==='VIP'?6:9))*.025;if(ring.current&&!reduced)ring.current.rotation.z+=dt*.8;});
 return <group><group ref={body} position={initialPosition.current}>{look?<Suspense fallback={<Person x={0} z={0} color={s.color}/>}><Mannequin mannequin={look.mannequin} pieces={look.pieces} still={reduced}/></Suspense>:<Person x={0} z={0} color={s.color}/>}</group>{active&&<group position={[s.x,0,s.z]}><pointLight color={s.color} intensity={16} distance={7} decay={2}/><mesh ref={ring} position={[0,.9,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.68,.018,5,48]}/><meshBasicMaterial color={s.color} transparent opacity={.65}/></mesh>{motes.map((p,i)=><mesh key={i} position={[p.x,p.y,p.z]}><sphereGeometry args={[.018,5,5]}/><meshBasicMaterial color={s.color}/></mesh>)}</group>}</group>;
}
function World({session,look,onTarget}:{session:AdventureSession;look:Look3d|null;onTarget:(x:number,z:number)=>void}){
 const s=session.state;const active=s.activeUntil>session.serverTime&&s.activeDeckId!==null;const vip=s.badge||active&&['VIP','EVENT_VIP'].includes(s.role)||s.distractionUntilLeft>session.serverTime&&s.distractionUntilRight>session.serverTime;const entry=vip||active&&s.role==='GUEST';
 return <><color attach="background" args={['#101522']}/><fog attach="fog" args={['#101522',18,42]}/><ambientLight intensity={.7}/><directionalLight position={[5,12,5]} intensity={1.8} castShadow shadow-mapSize={[1024,1024]}/><pointLight position={[0,4,-5]} color="#bd8fdb" intensity={35} distance={15}/>
  <mesh rotation={[-Math.PI/2,0,0]} receiveShadow onPointerDown={e=>{e.stopPropagation();onTarget(e.point.x,e.point.z);}}><planeGeometry args={[11,15]}/><meshStandardMaterial color="#222937" metalness={.35} roughness={.45}/></mesh>
  {[-5.5,5.5].map(x=><mesh key={x} position={[x,1,-1]}><boxGeometry args={[.2,2,15]}/><meshStandardMaterial color="#34404d"/></mesh>)}
  <mesh position={[0,.08,-1.5]} receiveShadow><boxGeometry args={[3,.08,12]}/><meshStandardMaterial color="#651e43" roughness={.8}/></mesh>
  {[-3,3].map(x=><mesh key={x} position={[x,.6,0]}><cylinderGeometry args={[.06,.09,1.2,10]}/><meshStandardMaterial color="#cfb16a" metalness={.8} roughness={.2}/></mesh>)}
  {!entry&&<mesh position={[0,.85,0]}><boxGeometry args={[6,.06,.06]}/><meshStandardMaterial color="#b23450"/></mesh>}
  {!vip&&<mesh position={[0,.8,-3]}><boxGeometry args={[6,.08,.08]}/><meshStandardMaterial color="#d4b36d" emissive="#403018"/></mesh>}
  <Person x={-1.4} z={-.1} guard color={s.distractionUntilLeft>session.serverTime?'#354d6e':'#12131b'}/><Person x={1.4} z={-.1} guard color={s.distractionUntilRight>session.serverTime?'#354d6e':'#12131b'}/><Person x={-3.6} z={-4.7} color="#b9c4ce"/>
  <group position={[4,0,-2]}><mesh position={[0,.45,0]}><boxGeometry args={[.9,.9,.6]}/><meshStandardMaterial color="#4a5969"/></mesh>{!s.badge&&<mesh position={[0,.95,0]}><boxGeometry args={[.2,.025,.3]}/><meshStandardMaterial color="#6be1d4" emissive="#2b7369"/></mesh>}</group>
  {!s.item&&<group position={[0,.7,-5.5]}><mesh><octahedronGeometry args={[.28]}/><meshStandardMaterial color="#e1c66d" emissive="#795f20" metalness={.7} roughness={.2}/></mesh><pointLight color="#e9cd73" intensity={8} distance={4}/></group>}
  {[-4,-2,0,2,4].map(x=><group key={x}><mesh position={[x,2.5,-7]}><boxGeometry args={[1.2,5,.4]}/><meshStandardMaterial color="#121a2a"/></mesh><mesh position={[x,2.5,-6.78]}><boxGeometry args={[.5,3,.02]}/><meshStandardMaterial color="#62589b" emissive="#36366b"/></mesh></group>)}
  <Player session={session} look={look}/><ContactShadows position={[0,.12,0]} opacity={.25} scale={20} blur={2} far={4}/>
 </>;
}
export default function AfterpartyScene(props:{session:AdventureSession;look:Look3d|null;onTarget:(x:number,z:number)=>void}){
 return <Canvas shadows dpr={[1,1.5]} camera={{position:[9,11,14],fov:45}} onCreated={({camera})=>camera.lookAt(0,0,-.5)}><World {...props}/></Canvas>;
}
