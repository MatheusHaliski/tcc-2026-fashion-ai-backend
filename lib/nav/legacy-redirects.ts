/**
 * Endereços antigos que saíram do app e para onde levam (next.config.ts › redirects). A Cidade de Vidro (/flair/jogos,
 * os capítulos do desenho anterior ao FLAIR 3D) saiu em 15/11/2026 (docs/flair/ENDPOINTS_FLAIR.md): os links do quarto
 * (a Suíte de Vidro) vão ao quarto em 3D do Atelier; o resto, ao FLAIR 3D. Ordem importa: a primeira regra que casa vale.
 */
export interface LegacyRedirect {
  source: string;
  destination: string;
  permanent: false;
  has?: { type: "query"; key: string; value: string }[];
}

const ROOM_3D = "/atelier?tab=room&quarto=3d";

export const LEGACY_REDIRECTS: LegacyRedirect[] = [
  { source: "/photos", destination: "/atelier", permanent: false },
  { source: "/flair/jogos", has: [{ type: "query", key: "district", value: "SUITE" }], destination: ROOM_3D, permanent: false },
  { source: "/flair/jogos/a01-espelho-partido", destination: ROOM_3D, permanent: false },
  { source: "/flair/jogos", destination: "/flair/3d", permanent: false },
  { source: "/flair/jogos/:path*", destination: "/flair/3d", permanent: false },
];
