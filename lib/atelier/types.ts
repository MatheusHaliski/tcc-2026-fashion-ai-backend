import type {LevelProgress} from '@/components/profile-level-progress';
import type {PieceView} from '@/lib/api/types';
import type {HypeSummary} from '@/lib/hype/types';
export const ATELIER_CATEGORIES=['auraSignature','garmentMemory','habitableTrofeus','directorPower','collectiveWork','seasonPasses'] as const;
export type AtelierCategory=typeof ATELIER_CATEGORIES[number];
export interface AtelierReward {id:string;category:AtelierCategory;code:string;title:string;description:string;sourceType:string;sourceReference:string;referenceId?:string|null;earnedAt:string;expiresAt?:string|null}
export interface AtelierRewardSystem {categories:Record<AtelierCategory,AtelierReward[]>;levelProgress:LevelProgress;total:number}
export type AtelierTab='metamorphoses'|'timeline'|'trends'|'room';
export interface AtelierPhoto {id:string;url?:string|null;thumbnailUrl?:string|null;createdAt:string;keyMoment:boolean;subject?:{kind:'PIECE'|'SCHEME';id:string;title:string;style?:string[]}|null}
export interface AtelierTimeline {moments:{photo:AtelierPhoto;date:string;origin:string}[];timeline:{month:string;count:number;keyMoments:number;photos:AtelierPhoto[]}[]}
export interface AtelierTrend {id:string;rank:number;hype:HypeSummary;piece:PieceView}
export interface AtelierTrends {items:AtelierTrend[];window:number}
