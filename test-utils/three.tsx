/**
 * Cenas 3D nos testes: o renderizador de teste do React Three Fiber monta a cena em memória (sem GPU). O que só uma
 * GPU de verdade faz — gerar o mapa de ambiente da luz de estúdio (PMREM) — vira uma textura vazia.
 * Cada arquivo de teste 3D ainda precisa trocar o <Canvas> por um repasse (vi.mock de "@react-three/fiber").
 */
import type { ReactNode } from "react";
import { vi } from "vitest";
import * as THREE from "three";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import { I18nProvider } from "@/lib/i18n/i18n";

vi.spyOn(THREE.PMREMGenerator.prototype, "fromScene").mockImplementation(() => ({ texture: new THREE.Texture(), dispose() {} }) as unknown as THREE.WebGLRenderTarget);
vi.spyOn(THREE.PMREMGenerator.prototype, "fromEquirectangular").mockImplementation(() => ({ texture: new THREE.Texture(), dispose() {} }) as unknown as THREE.WebGLRenderTarget);

/** Monta a cena com o provedor de idioma (só contexto, nenhum elemento HTML). */
export const mount3d = (ui: ReactNode) => ReactThreeTestRenderer.create(<I18nProvider initial="pt-BR">{ui}</I18nProvider>);
/** Avança quadros (animações com useFrame) dentro do act. */
export const frames = (r: Awaited<ReturnType<typeof mount3d>>, n = 3) => ReactThreeTestRenderer.act(async () => { await r.advanceFrames(n, 0.016); });
/** Malhas da cena (inclusive instanciadas). */
export const meshes = (r: Awaited<ReturnType<typeof mount3d>>) => r.scene.findAll((n) => n.type === "Mesh" || n.type === "InstancedMesh" || n.type === "SkinnedMesh");
export { ReactThreeTestRenderer };

/**
 * Serve o corpo humano 3D (public/avatar3d/body/fai-body-v1.json/.bin) do disco para o fetch do carregador, como o
 * navegador buscaria do /public. Outras URLs: 404.
 */
export async function serveBodyAsset() {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  // no jsdom o import.meta.url não é file:, então o caminho parte da raiz do projeto
  const dir = join(process.cwd(), "public", "avatar3d", "body");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    const m = url.match(/avatar3d\/body\/([^/?]+\.(json|bin))/);
    if (!m) return new Response("{}", { status: 404 });
    const buf = readFileSync(join(dir, m[1]));
    return new Response(buf, { status: 200, headers: { "content-type": m[2] === "json" ? "application/json" : "application/octet-stream" } });
  }));
}

/**
 * Espera uma condição dando tempo dentro do act: o que chega por promessa (corpo 3D, texturas) só vira estado da cena
 * quando o renderizador de teste aplica as atualizações, e ele só faz isso dentro do act.
 */
export async function untilReady(check: () => boolean, timeoutMs = 10000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error("a cena 3D não ficou pronta a tempo");
    await ReactThreeTestRenderer.act(async () => { await new Promise((r) => setTimeout(r, 40)); });
  }
}
