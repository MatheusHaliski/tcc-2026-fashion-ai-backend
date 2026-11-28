export interface LegacyRedirect {
  source: string;
  destination: string;
  permanent: false;
  has?: { type: "query"; key: string; value: string }[];
}

const ACERVO = "/acervo";

export const LEGACY_REDIRECTS: LegacyRedirect[] = [
  { source: "/photos", destination: "/atelier", permanent: false },
  { source: "/atelier", has: [{ type: "query", key: "tab", value: "room" }], destination: ACERVO, permanent: false },
  ...["jogos", "3d", "aventura", "cartas", "carteira", "decks", "desafios", "elencos", "heist", "make-up", "missoes", "partidas"]
    .map((route): LegacyRedirect => ({ source: `/flair/${route}/:path*`, destination: "/flair", permanent: false })),
];
