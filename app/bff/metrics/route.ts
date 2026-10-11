import { validVital } from "@/lib/performance/vitals";
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_RUM_ENABLED !== "true") return new Response(null, { status: 404 });
  if (request.headers.get("origin") !== new URL(request.url).origin || !request.headers.get("content-type")?.startsWith("application/json")) return new Response(null, { status: 403 });
  if (Number(request.headers.get("content-length")) > 1024) return new Response(null, { status: 413 });
  const reader = request.body?.getReader(); if (!reader) return new Response(null, { status: 400 });
  let bytes = 0; const chunks: Uint8Array[] = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 1024) { await reader.cancel(); return new Response(null, { status: 413 }); } chunks.push(value); }
  try {
    const body = new Uint8Array(bytes); let offset = 0; for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    const vital: unknown = JSON.parse(new TextDecoder().decode(body));
    if (!validVital(vital)) return new Response(null, { status: 400 });
    console.info(JSON.stringify({ event: "fashionai.web_vital", ...vital }));
    return new Response(null, { status: 204 });
  } catch { return new Response(null, { status: 400 }); }
}
