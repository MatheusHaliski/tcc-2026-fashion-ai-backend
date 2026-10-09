import type { UserCard } from "@/lib/api/types";

/** RF8: resumo público do cabeçalho, sem dados de cadastro ou publicações privadas. */
export interface PublicProfileSummary extends UserCard {
  coverUrl?: string | null;
  bio?: string | null;
  pronouns?: string | null;
  links?: { title?: string; url?: string }[];
  visibility?: "PUBLIC" | "FOLLOWERS" | "PRIVATE";
  contentVisible?: boolean;
  relation?: string;
  counters?: { pieces?: number; schemes?: number; followers?: number; following?: number };
}

export function publicProfileLinks(links: PublicProfileSummary["links"]) {
  return (links ?? []).flatMap((link) => {
    try {
      const url = new URL(link.url ?? "");
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return [];
      return [{ href: url.href, title: link.title?.trim() || url.hostname.replace(/^www\./, "") }];
    } catch { return []; }
  });
}
