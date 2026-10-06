/**
 * FashionAI Momentos — tipos do contrato com /api/moments (docs/momentos/MOMENTOS.md).
 * Tempo vem SEMPRE do servidor (MomentTimeView): o cliente só formata e anda o relógio a partir de `now`.
 */
import type { SchemeView, UserCard } from "@/lib/api/types";

export type MomentType = "SEASONAL" | "CULTURAL" | "EVENT" | "FASHION_EVENT" | "COMMUNITY" | "CHALLENGE" | "PRIVATE_GROUP" | "PERSONAL" | "BRAND_EVENT" | "FLAIR_EVENT";
export type MomentNature = "CULTURAL" | "SEASONAL" | "COMMERCIAL" | "RELIGIOUS" | "FASHIONAI" | "PRIVATE";
export type MomentStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "ENDED" | "ARCHIVED" | "CANCELLED";
export type MomentVisibility = "PRIVATE" | "INVITE_ONLY" | "FRIENDS" | "GROUP" | "PUBLIC";
export type FlairMomentMode = "BATTLE" | "TOURNAMENT" | "GROUP_CHALLENGE" | "COOPERATIVE" | "MOMENT" | "TEAM_VS_TEAM" | "LOOK_LEAGUE";
export type MomentChallengeKind = "STYLE" | "COLOR" | "THEME" | "NO_BUY" | "REDISCOVERY" | "ONE_PIECE_MANY_LOOKS" | "EXPERIMENTAL" | "REMIX";
export type ParticipationStatus = "INTERESTED" | "JOINED" | "SUBMITTED" | "COMPLETED" | "LEFT";
export type MomentApproach = "MY_STYLE" | "DISCOVERY" | "EXPERIMENTAL";
export type VoteDimension = "TREND" | "ELEGANT" | "CREATIVE" | "ORIGINAL" | "THEME";
export type Outcome = "WINNER" | "TOP_10" | "COMPLETED" | "PARTICIPATED";

/** MomentTheme (§51): camada visual sobre a identidade FashionAI; nunca a substitui. */
export interface MomentTheme { accent?: string | null; background?: string | null; gradient?: string | null; icon?: string | null; animation?: string | null; cover?: string | null; banner?: string | null; tone?: "light" | "dark" | null }

export interface MomentTimeView {
  status: MomentStatus; now: string; startAt: string; endAt: string; timezone: string; localStart: string; localEnd: string;
  startsInSeconds: number; endsInSeconds: number; elapsed: number; daysLeft?: number | null;
}

export interface Participation {
  status: ParticipationStatus; approach?: MomentApproach | null; wardrobeOnly: boolean; remind: boolean; preparedSchemeId?: string | null; joinedAt?: string | null;
  pointsEarned: number; bestMatch?: number | null; ranking?: number | null; percentile?: number | null; badgeCode?: string | null; publicOnProfile: boolean; outcome: Outcome;
}

export interface MomentCard {
  id: string; slug: string; name: string; description?: string | null; type: MomentType; nature: MomentNature; scope: string; visibility: MomentVisibility;
  country?: string | null; region?: string | null; season?: string | null; official: boolean; featured: boolean; sponsored: boolean; sponsorName?: string | null;
  pointsEnabled: boolean; basePoints: number; pointsMultiplier: number; styleTags: string[]; occasionTags: string[]; colorTags: string[]; theme: MomentTheme;
  time: MomentTimeView; participantCount?: number | null; groupId?: string | null; flairMode?: FlairMomentMode | null; cooperativeGoal?: number | null; badgeCode?: string | null;
  regional?: boolean; me?: Participation | null; memory?: MomentMemory | null;
}

export interface Interpretation { key: string; label?: string | null; styleTags: string[]; colorTags: string[] }
export interface MomentChallenge { id: string; code: string; name: string; description?: string | null; kind: MomentChallengeKind; points: number; styleTags: string[]; colorTags: string[]; occasionTags: string[]; params: Record<string, unknown>; active: boolean }

export interface MomentMatchResult { score: number; parts: Record<string, number>; interpretation?: string | null; reasons: string[] }
export interface MatchExplanation { kind: string; values: string[] }
export interface PointsLine { action: string; points: number; ref: string; label: string }
export interface MomentScores { moment?: number | null; hype?: number | null; contextualHype?: number | null; reuse?: number | null; rediscovery?: number | null }

export interface Submission {
  id: string; schemeId: string; challengeId?: string | null; match?: number | null; matchDetail?: Partial<MomentMatchResult>; wardrobeOnly: boolean; rediscovered: number;
  votes: number; votedByMe: boolean; submittedAt: string; mine: boolean; scheme?: SchemeView; contextualHype?: number | null;
}

export interface MemoryLook { submissionId: string; schemeId: string; votes: number; match?: number | null; title?: string; coverImageUrl?: string | null; user?: UserCard | null }
export interface MomentMemory {
  endedAt?: string; participants?: number; looks?: number; votes?: number; goalReached?: boolean; winner?: MemoryLook | null; mostCreative?: MemoryLook | null;
  mostElegant?: MemoryLook | null; mostTrend?: MemoryLook | null; mostOriginal?: MemoryLook | null; mostTheme?: MemoryLook | null; interpretations?: { key: string; count: number }[];
}

export interface MomentDetail extends MomentCard {
  interpretations: Interpretation[]; challenges: MomentChallenge[]; rules: Record<string, unknown>; settings: Record<string, unknown>; requiredItems: string[]; suggestedItems: string[];
  sourceUrl?: string | null; sourceNote?: string | null; bonusRules: Record<string, number>; sensitive: boolean; competitive: boolean; cooperative: boolean; isCreator: boolean; isMember: boolean;
  stats: { participants?: number | null; looks?: number | null; goal?: number; goalFraction?: number }; mySubmissions?: Submission[]; group?: { id: string; name: string; color?: string | null };
  participants?: { user: UserCard; status: ParticipationStatus; ranking?: number | null }[]; trending?: Trending;
}

export interface Trending { styles: { key: string; count: number }[]; colors: { key: string; count: number }[]; interpretations: { key: string; count: number }[]; looks: { schemeId: string; title?: string; coverImageUrl?: string | null; votes: number; match?: number | null; contextualHype?: number | null }[]; basis: number }

export interface GroupSummary { id: string; name: string; color?: string | null; code?: string; activeCount: number; upcomingCount: number }
export interface MomentsHome { now: string; country?: string | null; active: MomentCard[]; upcoming: MomentCard[]; featured?: MomentCard | null; mine?: MineSummary; group?: GroupSummary | null; principle?: string }
export interface MineSummary { saved: number; participated: number; completed: number; points: number }
export interface MyMoments { now: string; saved: MomentCard[]; active: MomentCard[]; completed: MomentCard[]; badges: { code: string; grantedAt: string }[]; summary: MineSummary }
export interface CalendarMonth { year: number; month: number; days: number; items: MomentCard[] }
export interface MomentsCalendar { now: string; timezone: string; year: number; months: CalendarMonth[] }
export interface TimelineEntry { momentId: string; slug: string; name: string; type: MomentType; theme: MomentTheme; localStart: string; localEnd: string; status: ParticipationStatus; outcome: Outcome; ranking?: number | null; percentile?: number | null; badgeCode?: string | null; publicOnProfile: boolean; pointsEarned?: number }
export interface MomentsTimeline { visible: boolean; years: { year: number; items: TimelineEntry[] }[] }
export interface GroupMoments extends GroupSummary { upcoming: MomentCard[]; active: MomentCard[]; history: MomentCard[]; members: number; modes: FlairMomentMode[] }
export interface Leaderboard { competitive: boolean; items: { position: number; submissionId: string; schemeId: string; votes: number; match?: number | null; byDimension: Record<string, number>; you: boolean; user?: UserCard | null; title?: string; coverImageUrl?: string | null }[]; dimensions?: VoteDimension[]; cooperative?: { goal: number; looks: number } }
export interface MomentContext { type: "PIECE" | "SCHEME"; id: string; globalHype?: number | null; moments: { momentId: string; slug: string; name: string; icon?: string | null; match?: number | null; interpretation?: string | null; contextualHype?: number | null }[] }
export interface Replay { year: number; moments: number; completed: number; looks: number; stylesTried: number; rediscoveredPieces: number; points: number; bestMonth?: number | null; favoriteMoment?: string | null; peakHype?: { hype: number; moment?: string | null } | null }
export interface CandidateLook { id: string; title: string; coverImageUrl?: string | null; status: string; visibility: string; createdAt?: string | null; sent: boolean }

export const VOTE_DIMENSIONS: VoteDimension[] = ["TREND", "ELEGANT", "CREATIVE", "ORIGINAL", "THEME"];
export const FLAIR_MODES: FlairMomentMode[] = ["BATTLE", "TOURNAMENT", "GROUP_CHALLENGE", "COOPERATIVE", "MOMENT", "TEAM_VS_TEAM", "LOOK_LEAGUE"];
export const MOMENT_TYPES: MomentType[] = ["SEASONAL", "CULTURAL", "EVENT", "FASHION_EVENT", "COMMUNITY", "CHALLENGE", "PRIVATE_GROUP", "PERSONAL", "BRAND_EVENT", "FLAIR_EVENT"];
export const MOMENT_NATURES: MomentNature[] = ["CULTURAL", "SEASONAL", "COMMERCIAL", "RELIGIOUS", "FASHIONAI", "PRIVATE"];
export const CHALLENGE_KINDS: MomentChallengeKind[] = ["STYLE", "COLOR", "THEME", "NO_BUY", "REDISCOVERY", "ONE_PIECE_MANY_LOOKS", "EXPERIMENTAL", "REMIX"];
