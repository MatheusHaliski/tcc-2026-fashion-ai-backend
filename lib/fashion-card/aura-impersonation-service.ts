import {AuraLockedError,type AuraPermissionPort} from './aura-gating';
import type {OwnedFashionCard,AuraAnimationPreset,PowerVfx} from './types';
import {safeMediaUrl,validStat} from './types';
import {AuraPresetResolver,AuraContextEngineService} from './aura-context-engine';
export const MOTION_TEMPLATES=[{id:'WIND_POSE',power:'ELEMENTAL_WIND',demo:'/aura/fashion-curated/satin-ivory.mp4'},{id:'STREET_IMPACT',power:'CYBERPUNK_ELECTRIC',demo:'/aura/fashion-curated/cyan-thread.mp4'},{id:'COSMIC_FLOAT',power:'COSMIC_GOLD',demo:'/aura/fashion-curated/liquid-chrome.mp4'},{id:'Y2K_ECHO',power:'Y2K_HOLOGRAM',demo:'/aura/fashion-curated/rose-thread.mp4'},{id:'ELEMENTAL_BURST',power:'ELEMENTAL_FIRE',demo:'/aura/fashion-curated/coral-ink.mp4'}] as const;
export interface MotionRequest {ownerId:string;entityId:string;entityType:OwnedFashionCard['entityType'];userMediaUrl:string;motionTemplateId:string;preset:AuraAnimationPreset}
export interface MotionResult {jobId:string;mediaUrl:string;mimeType:'video/mp4'|'video/webm'|'image/gif';status:'MOCK_PREVIEW'|'READY'}
/** Production adapter must authorize owner, validate consent/media, queue the job and verify output. */
export interface FashionMotionWorker {process(request:MotionRequest,signal?:AbortSignal):Promise<MotionResult>}
export interface OwnedFashionCardRepository {getOwned(ownerId:string,type:OwnedFashionCard['entityType'],id:string):Promise<OwnedFashionCard|null>;saveOwned(card:OwnedFashionCard,expectedRevision:number):Promise<OwnedFashionCard>}
export class FashionCardPipelineService {
 constructor(private worker:FashionMotionWorker){}
 async processFashionCardMotion(request:MotionRequest,signal?:AbortSignal){signal?.throwIfAborted();if(!safeMediaUrl(request.userMediaUrl))throw Error('INVALID_USER_MEDIA');if(!MOTION_TEMPLATES.some(t=>t.id===request.motionTemplateId))throw Error('UNKNOWN_MOTION_TEMPLATE');const result=await this.worker.process(request,signal);signal?.throwIfAborted();if(!safeMediaUrl(result.mediaUrl)||!['video/mp4','video/webm','image/gif'].includes(result.mimeType))throw Error('INVALID_WORKER_MEDIA');return result;}
}
export class AuraImpersonationService {
 constructor(private presets:AuraPresetResolver,private pipeline:FashionCardPipelineService,private cards:OwnedFashionCardRepository,private permissions:AuraPermissionPort,private context=new AuraContextEngineService()){}
 async generateImpersonationAura(input:{ownerId:string;entityType:OwnedFashionCard['entityType'];entityId:string;userMediaUrl:string;motionTemplateId?:string},signal?:AbortSignal){
  signal?.throwIfAborted();if(!await this.permissions.canUserEquipAura(input.ownerId,'AURA_IMPERSONATION'))throw new AuraLockedError('AURA_IMPERSONATION');signal?.throwIfAborted();const card=await this.cards.getOwned(input.ownerId,input.entityType,input.entityId);if(!card||card.ownerId!==input.ownerId)throw Error('OWNED_CARD_NOT_FOUND');if(!Object.values(card.fashionCard.stats).every(validStat))throw Error('INVALID_CARD_STATS');
  const preset=await this.presets.resolve(card.metadata,card.auraPresetId);const templateId=input.motionTemplateId??MOTION_TEMPLATES.find(t=>t.power===preset.config.powerVfx)?.id??'COSMIC_FLOAT';
  const result=await this.pipeline.processFashionCardMotion({...input,motionTemplateId:templateId,preset},signal);signal?.throwIfAborted();
  const updated:OwnedFashionCard={...card,auraPresetId:preset.id,fashionCard:{...card.fashionCard,auraType:'IMPERSONATION',motionTemplateId:templateId,cardMediaUrl:result.mediaUrl,contextVfx:preset.config,contextBadges:this.context.badges(card.metadata),impersonationData:{userMediaUrl:input.userMediaUrl,motionTemplateId:templateId,powerVfx:preset.config.powerVfx,renderedCardMediaUrl:result.mediaUrl,renderedMediaType:result.mimeType,posterUrl:input.userMediaUrl,status:result.status,jobId:result.jobId}}};
  return this.cards.saveOwned(updated,card.revision);
 }
}
/** Demonstrates VFX library plumbing only; never fabricates a motion-transferred user video. */
export class MockFashionMotionWorker implements FashionMotionWorker {
 async process(request:MotionRequest,signal?:AbortSignal):Promise<MotionResult>{signal?.throwIfAborted();const template=MOTION_TEMPLATES.find(t=>t.id===request.motionTemplateId);if(!template)throw Error('UNKNOWN_MOTION_TEMPLATE');return {jobId:`mock-${crypto.randomUUID()}`,mediaUrl:template.demo,mimeType:'video/mp4',status:'MOCK_PREVIEW'};}
}
export class InMemoryOwnedFashionCardRepository implements OwnedFashionCardRepository {
 private cards=new Map<string,OwnedFashionCard>();
 private key(owner:string,type:string,id:string){return JSON.stringify([owner,type,id]);}
 constructor(cards:OwnedFashionCard[]){cards.forEach(c=>this.cards.set(this.key(c.ownerId,c.entityType,c.entityId),structuredClone(c)));}
 async getOwned(owner:string,type:OwnedFashionCard['entityType'],id:string){const c=this.cards.get(this.key(owner,type,id));return c?structuredClone(c):null;}
 async saveOwned(card:OwnedFashionCard,revision:number){const k=this.key(card.ownerId,card.entityType,card.entityId);const existing=this.cards.get(k);if(!existing||existing.revision!==revision)throw Error('FASHION_CARD_REVISION_CONFLICT');const next={...structuredClone(card),revision:revision+1};this.cards.set(k,next);return structuredClone(next);}
}
