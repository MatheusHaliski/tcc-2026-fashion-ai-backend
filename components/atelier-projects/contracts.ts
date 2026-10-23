export type ProjectVisibility = 'PRIVATE' | 'FOLLOWERS' | 'PUBLIC';
export type ProjectState = 'DRAFT' | 'IN_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED_FOR_SHOWCASE' | 'ARCHIVED';
export type MemberRole = 'EDITOR' | 'REVIEWER' | 'VIEWER';
export const SPEC_FIELDS = ['family', 'modeling', 'fabric', 'colors', 'pockets', 'collar', 'sleeves', 'fastenings', 'finishes', 'printPlacement', 'frontView', 'backView', 'referenceNotes', 'notes'] as const;
export type SpecField = typeof SPEC_FIELDS[number];
export interface Measurement { point: string; protocol: string; centimeters: number }
export type Specification = Record<SpecField, string | null> & { measurements: Measurement[] };
export const EMPTY_SPEC: Specification = { family: '', modeling: '', fabric: '', colors: '', pockets: '', collar: '', sleeves: '', fastenings: '', finishes: '', printPlacement: '', frontView: '', backView: '', referenceNotes: '', notes: '', measurements: [] };
export interface ProjectSummary { id: string; ownerId: string; title: string; brief: string; visibility: ProjectVisibility; state: ProjectState; version: number; revisionNumber: number; latestRevisionId: string | null; updatedAt: string }
export interface ProjectMember { id: string; userId: string; username: string; role: MemberRole; status: 'INVITED' | 'ACCEPTED' | 'REVOKED'; expiresAt: string }
export interface Revision { id: string; parentRevisionId: string | null; sourceRevisionId: string | null; authorId: string; authorName: string; number: number; title: string; brief: string; specification: Specification; contributionLicense: string; createdAt: string; votingEndsAt: string | null; interestedCount: number; myInterest: boolean | null }
export interface ProjectComment { id: string; revisionId: string; authorId: string; authorName: string; anchor: string; body: string; createdAt: string }
export interface ProjectReview { id: string; revisionId: string; authorId: string; authorName: string; decision: 'REQUEST_CHANGES' | 'APPROVE_SHOWCASE'; notes: string; createdAt: string }
export interface ProjectDetail { project: ProjectSummary; specification: Specification; capabilities: { edit: boolean; manageMembers: boolean; review: boolean; vote: boolean }; members: ProjectMember[]; comments: ProjectComment[]; reviews: ProjectReview[]; latestRevision: Revision | null }
export interface Invitation { id: string; projectId: string; projectTitle: string; role: MemberRole; expiresAt: string }
export interface ProjectPage<T> { items: T[]; page: number; size: number; hasMore: boolean }
export interface TechPack { format: string; projectId: string; revision: Revision; reviews: ProjectReview[]; missingFields: string[]; reviewStatus: string; productionApproved: false; notice: string }
export interface ProjectDraft { title: string; brief: string; visibility: ProjectVisibility; specification: Specification; rightsAccepted: boolean }
export function draftFrom(detail: ProjectDetail): ProjectDraft { return { title: detail.project.title, brief: detail.project.brief, visibility: detail.project.visibility, specification: structuredClone(detail.specification), rightsAccepted: false }; }
export function changedFields(left: Specification, right: Specification): (SpecField | 'measurements')[] { return [...SPEC_FIELDS, 'measurements' as const].filter(key => JSON.stringify(left[key]) !== JSON.stringify(right[key])); }
