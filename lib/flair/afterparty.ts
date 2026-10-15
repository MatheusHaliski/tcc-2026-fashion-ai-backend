export type AdventureTier='COMMON'|'RARE'|'LEGENDARY'|'COLLAB_DROP';
export interface AdventureLoadout {id:string;title:string;tier:AdventureTier;role:'STAFF'|'GUEST'|'VIP'|'EVENT_VIP';color:string;techwear:boolean;imageUrl?:string|null;cost:number;cooldownMs:number}
export interface AdventureState {x:number;z:number;energy:number;suspicion:number;status:'ACTIVE'|'COMPLETED'|'FAILED'|'ABANDONED';phase:'ACQUIRE'|'ESCAPE';activeDeckId:string|null;role:string;color:string;feedback:string;badge:boolean;item:boolean;running:boolean;activeUntil:number;distractionUntilLeft:number;distractionUntilRight:number;distractionReadyAt:number;loadouts:AdventureLoadout[];cooldowns:Record<string,number>}
export interface AdventureSession {id:string;serverTime:number;state:AdventureState}
export interface AdventureAction {type:'MOVE'|'ACTIVATE'|'INTERACT'|'DISTRACT'|'WAIT'|'ABANDON';deckId?:string;dx?:number;dz?:number;running?:boolean;requestId:string}
export function canActivateLoadout(s:AdventureSession,card:AdventureLoadout){return s.state.status==='ACTIVE'&&s.state.energy>=card.cost&&(s.state.cooldowns[card.id]??0)<=s.serverTime;}
export function remainingCooldown(s:AdventureSession,card:AdventureLoadout){return Math.max(0,Math.ceil(((s.state.cooldowns[card.id]??0)-s.serverTime)/1000));}
