/**
 * Endereços antigos que saíram do app e para onde levam (next.config.ts › redirects). A Cidade de Vidro (/flair/jogos,
 * os capítulos do desenho anterior ao FLAIR 3D) saiu em 15/11/2026 (docs/flair/ENDPOINTS_FLAIR.md): o resto vai ao
 * FLAIR 3D. O Quarto 3D saiu no mesmo dia (docs/quarto/RETIRADA_DO_QUARTO_3D.md): os links do quarto (a Suíte de Vidro
 * e a aba Quarto do Atelier, `/atelier?tab=room…`) vão ao ACERVO, o lugar para ver o guarda-roupa em perspectiva.
 * `/room` continua como página que redireciona (app/(site)/(app)/room/page.tsx), porque o Espelho e "Mostrar no quarto"
 * dependem dos parâmetros. Ordem importa: a primeira regra que casa vale. O Next repassa a query string ao destino.
 */
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
  { source: "/flair/jogos", has: [{ type: "query", key: "district", value: "SUITE" }], destination: ACERVO, permanent: false },
  { source: "/flair/jogos/a01-espelho-partido", destination: ACERVO, permanent: false },
  { source: "/flair/jogos", destination: "/flair/3d", permanent: false },
  { source: "/flair/jogos/:path*", destination: "/flair/3d", permanent: false },
];
