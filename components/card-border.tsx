"use client";
import { useEffect, useRef, useState } from 'react';
import { borderStyle, type CardBorderConfig } from '@/lib/card-border';
import type { HypeViewState } from '@/lib/hype/model';
export const HYPE_BORDER_PULSE_MS = 2400;
/** Baseline on mount; signal only a new score received while AURA Hype is active. */
export function CardBorder({ entityId, background, auraHype = false, hype }: { entityId: string; background?: Record<string,unknown> | null; auraHype?: boolean; hype?: HypeViewState }) {
  const active = auraHype;
  const score = hype?.kind === 'available' ? hype.score : null;
  const previous = useRef<{id:string;score:number|null;active:boolean}>({id:entityId,score:null,active:false});
  const [pulse,setPulse] = useState<{id:string;direction:'up'|'down'}|null>(null);
  useEffect(()=>{
    const old=previous.current;
    previous.current={id:entityId,score,active};
    setPulse(null);
    if(!active||!old.active||old.id!==entityId||old.score==null||score==null||score===old.score)return;
    setPulse({id:entityId,direction:score>old.score?'up':'down'});
    const timer=setTimeout(()=>setPulse(null),HYPE_BORDER_PULSE_MS);
    return ()=>clearTimeout(timer);
  },[entityId,score,active]);
  const configured=(background?.border as CardBorderConfig | undefined)?.effect;
  const effect=configured && configured!=='AUTO' ? configured : (active?'SHIMMER':'NONE');
  return <span className="card-border" aria-hidden="true" data-effect={effect} data-pulse={active && pulse?.id===entityId ? pulse.direction : undefined} style={borderStyle(background,auraHype)} />;
}
