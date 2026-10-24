import { api } from "./client";

export type FitPreference = "SLIM" | "REGULAR" | "LOOSE";
export type FitProtocol = "BODY_CIRCUMFERENCE_V1" | "GARMENT_CIRCUMFERENCE_V1" | "GARMENT_FLAT_WIDTH_V1" | "BODY_LENGTH_V1" | "GARMENT_LENGTH_V1";
export type FitRegion = "CHEST" | "WAIST" | "HIP" | "THIGH" | "INSEAM";
export type FitRating = "TIGHT" | "COMFORTABLE" | "LOOSE";
export interface FitMeasurement { region: FitRegion; protocol: FitProtocol; value: number; unit: "CM" | "IN" }
export interface FitProfile { version: number; measuredAt: string; source: "MANUAL"; measurements: FitMeasurement[] }
export interface FitDimension { region: FitRegion; protocol: FitProtocol; min: number; max: number; easeByPreference?: Partial<Record<FitPreference, { min: number; max: number }>> }
export interface FitChartData {
  type: "BODY_RANGE" | "GARMENT_MEASUREMENT"; family: "TSHIRT" | "JEANS"; market: string;
  sourceName: string; sourceUrl: string; sourceRevision: string; sourceDate: string; validUntil: string; sourceAuthorized: boolean;
  options: { label: string; order: number; measurements: FitDimension[] }[];
}
export interface FitChart { productId: string; version: number; revision: number; chart: FitChartData | null; canEdit: boolean }
export interface FitCandidate { sizeLabel: string; order: number; compatible: boolean; regions: { region: FitRegion; reason: string; chartProtocol: FitProtocol; inputProtocol?: FitProtocol | null }[] }
export interface FitFeedback { id: string; triedSize: string; regions: Partial<Record<FitRegion, FitRating>>; source: "SELF_REPORTED"; version: number }
export interface FitRecommendation {
  id: string; productId: string; stale: boolean; feedback: FitFeedback[];
  priorExperience: { sizeLabel: string; regions: Partial<Record<FitRegion, FitRating>>; recordedAt: string; chartRevision: number; explanation: string }[];
  result: { status: string; recommendedSize: string | null; candidates: FitCandidate[]; preference: FitPreference; preferenceApplied: boolean; preferenceExplanation: string;
    rulesVersion: string; chartRevision: number | null; profileVersion: number | null; sourceName: string | null; sourceRevision: string | null; sourceDate: string | null; expiresAt: string; qualitativeEvidence: string; missingInformation: { region: FitRegion; reason: string; requiredProtocol: FitProtocol }[] };
}
const productPath = (id: string) => `/api/catalog/products/${encodeURIComponent(id)}`;
export const fitApi = {
  chart: (id: string, signal?: AbortSignal) => api.get<FitChart>(`${productPath(id)}/size-chart`, { signal }),
  saveChart: (id: string, expectedVersion: number | null, chart: FitChartData) => api.put<FitChart>(`${productPath(id)}/size-chart`, { expectedVersion, chart }),
  profile: async (signal?: AbortSignal) => (await api.get<FitProfile | null>("/api/me/fit-measurements", { signal })) ?? null,
  saveProfile: (expectedVersion: number | null, measuredAt: string, measurements: FitMeasurement[]) => api.put<FitProfile>("/api/me/fit-measurements", { expectedVersion, measuredAt, measurements }),
  deleteProfile: (version: number) => api.delete(`/api/me/fit-measurements?expectedVersion=${version}`),
  recommend: (id: string, preference: FitPreference, requestKey: string) => api.post<FitRecommendation>(`${productPath(id)}/size-recommendations`, { preference, requestKey }),
  feedback: (id: string, experienceKey: string, triedSize: string, regions: Partial<Record<FitRegion, FitRating>>) => api.post<FitFeedback>(`/api/size-recommendations/${encodeURIComponent(id)}/feedback`, { experienceKey, triedSize, regions }),
  deleteFeedback: (id: string) => api.delete(`/api/fit-feedback/${encodeURIComponent(id)}`),
};
