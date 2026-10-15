'use client';
import {useEffect,useId,useLayoutEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';

/** OS and app motion preferences apply to canvas and DOM effects alike. */
export function useHologramMotion(paused=false){
 const [reduced,setReduced]=useState(true);
 useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const read=()=>setReduced(query.matches||document.documentElement.dataset.reduceMotion==='true');read();query.addEventListener('change',read);const observer=new MutationObserver(read);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-reduce-motion']});return()=>{query.removeEventListener('change',read);observer.disconnect();};},[]);
 return !paused&&!reduced;
}
export function HologramCircleStream({paused=false}:{paused?:boolean}){
 const ref=useRef<HTMLCanvasElement>(null);const motion=useHologramMotion(paused);
 useEffect(()=>{
  const canvas=ref.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
  let frame=0,last=0,visible=true,width=1,height=1;const scale=Math.min(window.devicePixelRatio||1,1.5);
  function paint(time:number){ctx!.clearRect(0,0,width,height);const x=width*.76,y=height*.4,r=Math.min(width,height)*.37;ctx!.strokeStyle='#61e3da';ctx!.lineWidth=1;for(let i=0;i<5;i++){ctx!.globalAlpha=.1+i*.025;ctx!.beginPath();const angle=(motion?time*.00009:0)*(i%2?1:-1)+i*.3;ctx!.arc(x,y,r*(1-i*.13),angle,angle+Math.PI*1.6);ctx!.stroke();}ctx!.globalAlpha=1;}
  function loop(time:number){if(time-last>33){paint(time);last=time;}frame=requestAnimationFrame(loop);}
  function stop(){cancelAnimationFrame(frame);frame=0;}
  function sync(){stop();if(motion&&visible&&!document.hidden)frame=requestAnimationFrame(loop);else paint(0);}
  function resize(){const bounds=canvas!.getBoundingClientRect();width=Math.max(1,bounds.width);height=Math.max(1,bounds.height);canvas!.width=width*scale;canvas!.height=height*scale;ctx!.setTransform(scale,0,0,scale,0,0);sync();}
  const size=typeof ResizeObserver==='undefined'?null:new ResizeObserver(resize);size?.observe(canvas);resize();
  const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();});observer?.observe(canvas);document.addEventListener('visibilitychange',sync);
  return()=>{stop();size?.disconnect();observer?.disconnect();document.removeEventListener('visibilitychange',sync);};
 },[motion]);
 return <canvas ref={ref} className="atelier-circle-stream" aria-hidden="true"/>;
}
export function DataTunnelPipes(){
 const id=useId().replace(/:/g,'');return <svg className="atelier-data-tunnels" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id={`pipe-${id}`}><stop stopColor="#44c9d8" stopOpacity=".05"/><stop offset=".5" stopColor="#96ffee" stopOpacity=".65"/><stop offset="1" stopColor="#a07de1" stopOpacity=".12"/></linearGradient></defs>{[45,120,215].map((y,i)=><g key={y}><path d={`M-10 ${y} H200 Q270 ${y} 320 ${y+35} T550 ${y+20} H1010`} fill="none" stroke={`url(#pipe-${id})`} strokeWidth="14" opacity=".18"/><path className="atelier-flow-line" style={{animationDelay:`${i*-2}s`}} d={`M-10 ${y} H200 Q270 ${y} 320 ${y+35} T550 ${y+20} H1010`} fill="none" stroke={`url(#pipe-${id})`} strokeWidth="2" strokeDasharray="12 50"/></g>)}</svg>;
}
export function NeonArrowFlow(){return <div className="atelier-arrow-flow" aria-hidden="true">{[0,1,2,3].map(i=><svg key={i} viewBox="0 0 36 24" style={{animationDelay:`${i*.35}s`}}><path d="M2 12H30M21 3L30 12L21 21" fill="none" stroke="currentColor" strokeWidth="2"/></svg>)}</div>;}
export function ShiftingCardsGrid({items,activeId,motion=true}:{items:{id:string;content:ReactNode}[];activeId?:string;motion?:boolean}){
 const root=useRef<HTMLDivElement>(null);const positions=useRef(new Map<string,DOMRect>());const animate=useHologramMotion(!motion);
 useLayoutEffect(()=>{const next=new Map<string,DOMRect>();root.current?.querySelectorAll<HTMLElement>('[data-layout-id]').forEach(el=>{const id=el.dataset.layoutId!,rect=el.getBoundingClientRect(),old=positions.current.get(id);next.set(id,rect);if(animate&&old&&el.animate){const dx=old.x-rect.x,dy=old.y-rect.y;if(Math.abs(dx)+Math.abs(dy)>2)el.animate([{translate:`${dx}px ${dy}px`},{translate:'0px 0px'}],{duration:420,easing:'cubic-bezier(.2,.8,.2,1)'});}});positions.current=next;},[items,activeId,animate]);
 return <div className="atelier-shifting-grid" ref={root}>{items.map((item,i)=><div key={item.id} data-layout-id={item.id} data-active={item.id===activeId?'true':'false'} className="atelier-shifting-card" style={{'--atelier-depth':item.id===activeId?'24px':`${i%3*4}px`,'--atelier-lean':item.id===activeId?'0deg':`${i%2?1:-1}deg`,'--atelier-delay':`${Math.min(i,8)*45}ms`} as CSSProperties}>{item.content}</div>)}</div>;
}
export function HolographicFxEngine({paused=false}:{paused?:boolean}){return <div className="atelier-fx" data-paused={paused?'true':'false'} aria-hidden="true"><HologramCircleStream paused={paused}/><DataTunnelPipes/><NeonArrowFlow/></div>;}
