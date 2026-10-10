import type { HypeGroupSummary } from "@/lib/hype/types";

/** Cabeçalho público de marca/celebridade retornado pelo feed RF14/RF22. */
export interface InstitutionalProfileSummary {
  id?: string | null;
  userId?: string | null;
  slug?: string | null;
  username?: string | null;
  name?: string | null;
  brandName?: string | null;
  stageName?: string | null;
  userAvatarUrl?: string | null;
  avatarUrl?: string | null;
  logoUrl?: string | null;
  officialPhotoUrl?: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  storeUrl?: string | null;
  category?: string | null;
  fashionCategory?: string | null;
  areas?: string[] | null;
  officialHashtag?: string | null;
  country?: string | null;
  verified?: boolean;
  status?: string | null;
  kind?: string | null;
  privateAccount?: boolean;
  visibility?: "PUBLIC" | "PRIVATE" | "FOLLOWERS" | null;
  followers?: number | null;
  following?: number | null;
  pieces?: number | null;
  schemes?: number | null;
  activeSeals?: number | null;
  seals?: number | null;
  affinity?: number | null;
  bonds?: number | null;
  hype?: HypeGroupSummary | null;
  /** Compatibilidade com respostas anteriores ao cabeçalho plano. */
  user?: { username: string; avatarUrl?: string | null } | null;
}

export interface InstitutionalFeed {
  brands?: InstitutionalProfileSummary[];
  celebrities?: InstitutionalProfileSummary[];
  orders: string[];
  order: string;
  empty?: string;
}
