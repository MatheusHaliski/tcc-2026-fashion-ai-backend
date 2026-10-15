import {tr} from '@/lib/i18n/core';
export const ROOM_TIERS=['ESTREIA','STUDIO','LOFT','CLOSET','ATELIER','PENTHOUSE','MAISON'] as const;
export type RoomTier=typeof ROOM_TIERS[number];
export type GatedAuraType='AURA_BASIC'|'AURA_DYNAMIC'|'AURA_IMPERSONATION';
export const AuraGatingConfig:Record<GatedAuraType,{requiredTier:RoomTier}>={AURA_BASIC:{requiredTier:'ESTREIA'},AURA_DYNAMIC:{requiredTier:'STUDIO'},AURA_IMPERSONATION:{requiredTier:'LOFT'}};
export interface AuraPermissionPort {canUserEquipAura(userId:string,auraType:GatedAuraType):Promise<boolean>}
export class AuraPermissionsService implements AuraPermissionPort {
 constructor(private lookupTier:(userId:string)=>Promise<RoomTier|null>){}
 async canUserEquipAura(userId:string,auraType:GatedAuraType){if(!userId)return false;const rule=AuraGatingConfig[auraType];if(!rule)return false;const current=await this.lookupTier(userId);return current!==null&&ROOM_TIERS.indexOf(current)>=ROOM_TIERS.indexOf(rule.requiredTier);}
 getLockedAuraMessage(auraType:GatedAuraType){return getLockedAuraMessage(auraType);}
}
export function getLockedAuraMessage(auraType:GatedAuraType){return tr(`auraGate.locked.${auraType}`);}
export class AuraLockedError extends Error {readonly code='AURA_LEVEL_REQUIRED';readonly requiredTier:RoomTier;constructor(auraType:GatedAuraType){super(getLockedAuraMessage(auraType));this.requiredTier=AuraGatingConfig[auraType].requiredTier;}}
