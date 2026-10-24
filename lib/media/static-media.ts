/**
 * Mídia estática pesada (auras, materiais, peças padrão, fundos de chrome, demos do FLAIR): ~1 GB que vive em
 * `media/` em vez de `public/`, para não entrar em cada deployment da Vercel (Deployment Storage do plano Hobby).
 *
 * As URLs continuam as mesmas (`/aura/...`, `/assets_pecas/...`): o next.config.ts reescreve cada prefixo daqui para
 *  - a origem em STATIC_MEDIA_ORIGIN, quando definida (um bucket/CDN com a mesma árvore de `media/`);
 *  - senão, na Vercel, o CDN jsDelivr lendo este repositório público no commit exato do deploy (imutável, com cache);
 *  - senão (dev, CI, `next start` local), a rota /dev-media/*, que serve `media/` do disco.
 * A API Java recebe `media/` por cima de `/app/public` no Dockerfile.backend (ASSETS_PUBLIC_DIR), e em dev local lê
 * `media/` como segundo diretório (fashionai.assets.media-dir).
 */
export const STATIC_MEDIA_PREFIXES = [
  "aura",
  "aura_com_GIF",
  "aura_sem_GIF",
  "aura_com_material_com_GIF",
  "aura_com_material_mosaico_com_GIF",
  "assets_pecas",
  "bg_chrome",
  "material_com_GIF",
  "material_no_GIF",
  "flair/demos",
] as const;

/** Rota que serve `media/` do disco fora da Vercel (dev, CI, `next start`). */
export const DEV_MEDIA_ROUTE = "/dev-media";

const DEFAULT_REPO = { owner: "MatheusHaliski", slug: "tcc-2026-fashion-ai-backend" };

type Env = Record<string, string | undefined>;

/** Origem externa da mídia estática (sem barra final) ou undefined quando ela deve vir do disco. */
export function staticMediaOrigin(env: Env): string | undefined {
  const explicit = env.STATIC_MEDIA_ORIGIN?.trim().replace(/\/+$/, "");
  if (explicit) return explicit;
  const sha = env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (!sha) return undefined;
  const owner = env.VERCEL_GIT_REPO_OWNER?.trim() || DEFAULT_REPO.owner;
  const slug = env.VERCEL_GIT_REPO_SLUG?.trim() || DEFAULT_REPO.slug;
  return `https://cdn.jsdelivr.net/gh/${owner}/${slug}@${sha}/media`;
}

/** Rewrites do Next para cada prefixo de mídia: CDN/bucket quando há origem, senão a rota de disco. */
export function staticMediaRewrites(env: Env): { source: string; destination: string }[] {
  const origin = staticMediaOrigin(env);
  if (!origin && env.VERCEL) {
    throw new Error(
      "Mídia estática sem origem na Vercel: defina STATIC_MEDIA_ORIGIN ou faça o deploy pelo Git (VERCEL_GIT_COMMIT_SHA) — " +
        "a pasta media/ não entra no deployment (lib/media/static-media.ts).",
    );
  }
  return STATIC_MEDIA_PREFIXES.map((prefix) => ({
    source: `/${prefix}/:path*`,
    destination: origin ? `${origin}/${prefix}/:path*` : `${DEV_MEDIA_ROUTE}/${prefix}/:path*`,
  }));
}

/**
 * Caminho relativo seguro dentro de `media/` a partir dos segmentos da URL, ou null quando a URL sai da árvore
 * (`..`, barra invertida, segmento vazio) ou não começa por um prefixo de mídia conhecido.
 */
export function staticMediaRelativePath(segments: readonly string[]): string | null {
  if (!segments.length || segments.some((s) => !s || s === "." || s === ".." || /[\\\0]/.test(s))) return null;
  const rel = segments.join("/");
  return STATIC_MEDIA_PREFIXES.some((prefix) => rel.startsWith(`${prefix}/`)) ? rel : null;
}
