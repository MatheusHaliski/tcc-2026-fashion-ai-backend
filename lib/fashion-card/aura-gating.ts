import {hasReachedLevel} from '@/lib/points/hub';
import {tr} from '@/lib/i18n/core';
/** Os três níveis de FAI XP: Básico (ESTREIA) → Studio → Loft. */
export const ROOM_TIERS=['ESTREIA','STUDIO','LOFT'] as const;
export type RoomTier=typeof ROOM_TIERS[number];
export type GatedAuraType='AURA_BASIC'|'AURA_DYNAMIC'|'AURA_METAMORPHOSE'|'AURA_IMPERSONATION';
export const AuraGatingConfig:Record<GatedAuraType,{requiredTier:RoomTier}>={AURA_BASIC:{requiredTier:'ESTREIA'},AURA_DYNAMIC:{requiredTier:'STUDIO'},AURA_METAMORPHOSE:{requiredTier:'LOFT'},AURA_IMPERSONATION:{requiredTier:'LOFT'}};
export interface AuraPermissionPort {canUserEquipAura(userId:string,auraType:GatedAuraType):Promise<boolean>}
export class AuraPermissionsService implements AuraPermissionPort {
 constructor(private lookupTier:(userId:string)=>Promise<RoomTier|null>){}
 async canUserEquipAura(userId:string,auraType:GatedAuraType){if(!userId)return false;const rule=AuraGatingConfig[auraType];if(!rule)return false;const current=await this.lookupTier(userId);return current!==null&&ROOM_TIERS.indexOf(current)>=ROOM_TIERS.indexOf(rule.requiredTier);}
 getLockedAuraMessage(auraType:GatedAuraType){return getLockedAuraMessage(auraType);}
}
export function getLockedAuraMessage(auraType:GatedAuraType){return tr(`auraGate.locked.${auraType}`);}
export class AuraLockedError extends Error {readonly code='AURA_LEVEL_REQUIRED';readonly requiredTier:RoomTier;constructor(auraType:GatedAuraType){super(getLockedAuraMessage(auraType));this.requiredTier=AuraGatingConfig[auraType].requiredTier;}}
/** Nível de FAI XP (Básico → Studio → Loft) para cada nível de carta AURA Hype: Comum é livre; Rara abre no Studio; Lendária e Collab/Drop no Loft. */
export const CARD_LEVEL_TIER:Record<'COMMON'|'RARE'|'LEGENDARY'|'COLLAB_DROP',RoomTier>={COMMON:'ESTREIA',RARE:'STUDIO',LEGENDARY:'LOFT',COLLAB_DROP:'LOFT'};
export function cardLevelUnlocked(level:keyof typeof CARD_LEVEL_TIER,current:string|null|undefined){return level==='COMMON'||hasReachedLevel(current,CARD_LEVEL_TIER[level]);}
