import path from "node:path";
import { Readable } from "node:stream";
import { staticMediaRelativePath } from "@/lib/media/static-media";
import { projectRoot, untracedFs } from "@/lib/server/untraced-fs";

/**
 * Serve a mídia estática de `media/` do disco fora da Vercel (dev, CI, `next start`): o next.config.ts reescreve
 * `/aura/...` etc. para cá quando não há origem externa (lib/media/static-media.ts). Na Vercel a pasta não existe no
 * bundle (outputFileTracingExcludes) e a rota responde 404; os rewrites de lá apontam para o CDN.
 */
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4", ".webm": "video/webm", ".gif": "image/gif", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml", ".json": "application/json",
  ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".glb": "model/gltf-binary",
};

// projectRoot/untracedFs: o rastreamento de arquivos do Next não pode arrastar media/ (nem o projeto) para a função
const ROOT = path.resolve(projectRoot, process.env.STATIC_MEDIA_DIR || "media");

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (process.env.VERCEL) return new Response(null, { status: 404 });
  const rel = staticMediaRelativePath((await ctx.params).path ?? []);
  if (!rel) return new Response(null, { status: 404 });
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) return new Response(null, { status: 404 });
  const info = await untracedFs.promises.stat(file).catch(() => null);
  if (!info?.isFile()) return new Response(null, { status: 404 });

  const headers = new Headers({
    "content-type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
    "accept-ranges": "bytes",
    "cache-control": "no-cache",
  });
  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  let start = 0, end = info.size - 1, status = 200;
  if (range && info.size > 0) {
    if (range[1]) { start = Number(range[1]); end = range[2] ? Math.min(Number(range[2]), end) : end; }
    else if (range[2]) { start = Math.max(0, info.size - Number(range[2])); }      // bytes=-N: os últimos N bytes
    if (start > end || start >= info.size) {
      headers.set("content-range", `bytes */${info.size}`);
      return new Response(null, { status: 416, headers });
    }
    status = 206;
    headers.set("content-range", `bytes ${start}-${end}/${info.size}`);
  }
  headers.set("content-length", String(end - start + 1));
  if (req.method === "HEAD") return new Response(null, { status, headers });
  const stream = Readable.toWeb(untracedFs.createReadStream(file, { start, end })) as ReadableStream;
  return new Response(stream, { status, headers });
}
