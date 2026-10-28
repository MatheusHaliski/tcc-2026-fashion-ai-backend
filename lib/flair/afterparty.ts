export type AdventureTier='COMMON'|'RARE'|'LEGENDARY'|'COLLAB_DROP';
export interface AdventureLoadout {id:string;title:string;tier:AdventureTier;role:'STAFF'|'GUEST'|'VIP'|'EVENT_VIP';color:string;techwear:boolean;imageUrl?:string|null;cost:number;cooldownMs:number}
/**
 * O que as cartas do deck fazem com o avatar e com o salão (AfterpartyMods.java, calculado no servidor): atributos de
 * 0 a 100 e os multiplicadores que entram nas regras; luz do salão, convidados e a rota VIP do começo.
 */
export interface AdventureMods {agility:number;stealth:number;charm:number;stamina:number;speedMul:number;suspicionMul:number;distractMul:number;regenMul:number;light:'PENUMBRA'|'SALAO'|'HOLOFOTES';zoneMul:number;crowd:number;guests:number;vipRouteMs:number}
export interface AdventureState {x:number;z:number;energy:number;suspicion:number;status:'ACTIVE'|'COMPLETED'|'FAILED'|'ABANDONED';phase:'ACQUIRE'|'ESCAPE';activeDeckId:string|null;role:string;color:string;feedback:string;badge:boolean;item:boolean;running:boolean;activeUntil:number;distractionUntilLeft:number;distractionUntilRight:number;distractionReadyAt:number;loadouts:AdventureLoadout[];cooldowns:Record<string,number>;startedAt?:number;mods?:AdventureMods|null}
export interface AdventureSession {id:string;serverTime:number;state:AdventureState}
export interface AdventureAction {type:'MOVE'|'ACTIVATE'|'INTERACT'|'DISTRACT'|'WAIT'|'ABANDON';deckId?:string;dx?:number;dz?:number;running?:boolean;requestId:string}
export function canActivateLoadout(s:AdventureSession,card:AdventureLoadout){return s.state.status==='ACTIVE'&&s.state.energy>=card.cost&&(s.state.cooldowns[card.id]??0)<=s.serverTime;}
export function remainingCooldown(s:AdventureSession,card:AdventureLoadout){return Math.max(0,Math.ceil(((s.state.cooldowns[card.id]??0)-s.serverTime)/1000));}

/** Partida salva antes dos modificadores: tudo neutro (o jogo de antes). */
export const NEUTRAL_MODS:AdventureMods={agility:50,stealth:50,charm:50,stamina:50,speedMul:1,suspicionMul:1,distractMul:1,regenMul:1,light:'SALAO',zoneMul:1,crowd:0,guests:2,vipRouteMs:0};
export const modsOf=(s:AdventureState):AdventureMods=>s.mods??NEUTRAL_MODS;
/** Segundos que faltam da rota VIP do começo (0 = fechada). */
export function vipRouteLeft(session:AdventureSession){const m=modsOf(session.state),start=session.state.startedAt??0;return m.vipRouteMs>0&&start>0?Math.max(0,Math.ceil((start+m.vipRouteMs-session.serverTime)/1000)):0;}

export type ModTone='plus'|'minus'|'neutral';
export interface ModEffect {key:'agility'|'stealth'|'charm'|'stamina'|'light'|'crowd'|'vip';tone:ModTone;score?:number;percent?:number;value?:string|number}
const pct=(mul:number)=>Math.round((mul-1)*100);
const tone=(p:number,inverse=false):ModTone=>{const v=inverse?-p:p;return v>=3?'plus':v<=-3?'minus':'neutral';};
/**
 * Vantagens e desvantagens do deck, na ordem em que aparecem: avatar (agilidade, furtividade, carisma, fôlego) e
 * salão (luz, convidados, rota VIP). A suspeita é inversa: subir menos é vantagem.
 */
export function modEffects(m:AdventureMods):ModEffect[]{
 const suspicion=pct(m.suspicionMul);
 return [
  {key:'agility',score:m.agility,percent:pct(m.speedMul),tone:tone(pct(m.speedMul))},
  {key:'stealth',score:m.stealth,percent:suspicion,tone:tone(suspicion,true)},
  {key:'charm',score:m.charm,percent:pct(m.distractMul),tone:tone(pct(m.distractMul))},
  {key:'stamina',score:m.stamina,percent:pct(m.regenMul),tone:tone(pct(m.regenMul))},
  {key:'light',value:m.light,tone:m.light==='PENUMBRA'?'plus':m.light==='HOLOFOTES'?'minus':'neutral'},
  {key:'crowd',value:m.guests,tone:m.crowd>=.25?'plus':'neutral'},
  {key:'vip',value:Math.round(m.vipRouteMs/1000),tone:m.vipRouteMs>0?'plus':'neutral'},
 ];
}
