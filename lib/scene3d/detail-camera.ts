/*
 * Câmera de detalhe do provador: pontos de parada na SUPERFÍCIE do corpo do avatar (gola, ombro, peito/logo,
 * cintura, quadril/bolso, joelho, barra, calçado), calculados dos vértices do corpo composto — não de alturas fixas —
 * para qualquer estatura e compleição. "Percorrer" desliza a câmera entre eles (t contínuo); "Calçado" gruda no tênis.
 * Funções puras: a cena só aplica o resultado (fitting-room-scene.tsx).
 */
export type V3 = [number, number, number];
export type DetailMode = "corpo" | "calcado" | "percurso";
export const STOP_KEYS = ["gola", "ombro", "peito", "cintura", "quadril", "joelho", "barra", "calcado"] as const;
export type StopKey = typeof STOP_KEYS[number];
/**
 * `anchor` é o vértice do corpo (malha base) que segura a parada: a cena aplica a pele (esqueleto na pose de exibição)
 * nesse vértice e leva alvo e câmera junto — as paradas são achadas no corpo em repouso (pose "A").
 */
export interface DetailStop { key: StopKey; target: V3; eye: V3; anchor: number }
export interface DetailState { mode: DetailMode; t: number; stops: StopKey[] }

/** Só o que a busca precisa do corpo (BodyParam de garments.ts). */
export interface SurfaceParam { group: ArrayLike<number>; h: ArrayLike<number>; leg: ArrayLike<number>; torsoZ: number }

/** Distância da câmera à superfície: perto o bastante para ler costura, trama e logo; longe o bastante para o enquadramento. */
export const DETAIL_DISTANCE = 0.34;
const norm = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

/**
 * Paradas de cima para baixo. Cada uma é o vértice mais à frente (maior z) de uma faixa do corpo; a câmera fica na
 * frente dele (ou de lado, no ombro e no calçado), um pouco acima, olhando para o ponto. Faixa vazia = parada omitida.
 * O lado é o esquerdo da pessoa (x > 0), onde costumam ficar o logo do peito e o bolso da frente.
 */
export function surfaceStops(body: ArrayLike<number>, P: SurfaceParam, dist = DETAIL_DISTANCE): DetailStop[] {
  const n = P.group.length;
  type Keep = (v: number, x: number) => boolean;
  const at = (v: number): V3 => [body[v * 3], body[v * 3 + 1], body[v * 3 + 2]];
  /** vértice mais à frente (maior z) da faixa */
  const front = (keep: Keep): number => {
    let best = -1, bz = -Infinity;
    for (let v = 0; v < n; v++) { const x = body[v * 3]; if (!keep(v, x)) continue; const z = body[v * 3 + 2]; if (z > bz) { bz = z; best = v; } }
    return best;
  };
  /** vértice mais de fora (maior x) da faixa */
  const outer = (keep: Keep): number => {
    let best = -1, bx = -Infinity;
    for (let v = 0; v < n; v++) { const x = body[v * 3]; if (!keep(v, x) || x <= bx) continue; bx = x; best = v; }
    return best;
  };
  /** centro da faixa, ancorado no vértice dela mais perto do centro */
  const centroid = (keep: Keep): { at: V3; anchor: number } | null => {
    let s: V3 = [0, 0, 0], k = 0;
    for (let v = 0; v < n; v++) { const x = body[v * 3]; if (!keep(v, x)) continue; s = add(s, at(v)); k++; }
    if (!k) return null;
    const c: V3 = [s[0] / k, s[1] / k, s[2] / k];
    let anchor = -1, bd = Infinity;
    for (let v = 0; v < n; v++) { const x = body[v * 3]; if (!keep(v, x)) continue; const d = (x - c[0]) ** 2 + (body[v * 3 + 1] - c[1]) ** 2 + (body[v * 3 + 2] - c[2]) ** 2; if (d < bd) { bd = d; anchor = v; } }
    return { at: c, anchor };
  };
  const g = (v: number) => P.group[v], h = (v: number) => P.h[v], leg = (v: number) => P.leg[v];
  const stops: DetailStop[] = [];
  /** câmera na direção `dir` a partir do ponto, um pouco acima (lift), olhando para ele; faixa vazia = parada omitida */
  const push = (key: StopKey, anchor: number, dir: V3, lift: number, k = dist, target = anchor >= 0 ? at(anchor) : null) => {
    if (anchor < 0 || !target) return;
    stops.push({ key, target, eye: add(add(target, norm(dir), k), [0, lift, 0]), anchor });
  };
  push("gola", front((v, x) => g(v) === 1 && h(v) > 0.93 && h(v) < 1.04 && Math.abs(x) < 0.03), [0, 0, 1], 0.07);
  push("ombro", outer((v) => (g(v) === 1 || g(v) === 2) && h(v) > 0.9 && h(v) < 1.0), [1, 0, 0.9], 0.08);
  push("peito", front((v, x) => g(v) === 1 && h(v) > 0.66 && h(v) < 0.78 && x > 0.03 && x < 0.09), [0, 0, 1], 0.03);
  push("cintura", front((v, x) => g(v) === 1 && h(v) > 0.32 && h(v) < 0.44 && Math.abs(x) < 0.03), [0, 0, 1], 0.03);
  push("quadril", front((v, x) => (g(v) === 1 || g(v) === 3) && h(v) > -0.03 && h(v) < 0.09 && x > 0.05 && x < 0.13), [0.2, 0, 1], 0.02);
  push("joelho", front((v, x) => g(v) === 3 && leg(v) > 0.45 && leg(v) < 0.56 && x > 0), [0.15, 0, 1], 0.04);
  push("barra", front((v, x) => g(v) === 3 && leg(v) > 0.88 && leg(v) < 0.98 && x > 0), [0.25, 0, 1], 0.06);
  // calçado: o centro do pé esquerdo, visto da frente e de fora (onde fica a marca na lateral do tênis)
  const pe = centroid((v, x) => g(v) === 4 && x > 0);
  if (pe) push("calcado", pe.anchor, [0.8, 0, 1], 0.14, dist * 1.05, pe.at);
  return stops;
}

/** Leva a parada junto com o vértice âncora (do repouso para a pose em cena): alvo e câmera andam o mesmo tanto. */
export function moveStop(s: DetailStop, from: V3, to: V3): DetailStop {
  const d: V3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  return { ...s, target: add(s.target, d), eye: add(s.eye, d) };
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Pose do percurso para t contínuo (0 = primeira parada, n − 1 = última): desliza entre paradas vizinhas. */
export function travelPose(stops: DetailStop[], t: number): { target: V3; eye: V3 } | null {
  if (!stops.length) return null;
  const k = Math.min(stops.length - 1, Math.max(0, t)), i = Math.min(stops.length - 2, Math.floor(k)), f = stops.length > 1 ? smooth(k - Math.max(0, i)) : 0;
  if (stops.length === 1) return { target: stops[0].target, eye: stops[0].eye };
  const a = stops[Math.max(0, i)], b = stops[Math.max(0, i) + 1];
  return { target: lerp3(a.target, b.target, f), eye: lerp3(a.eye, b.eye, f) };
}

/** Roda/arrasto no percurso: devolve o novo t e se andou (no fim do percurso não anda — a página rola). */
export function wheelTravel(t: number, deltaY: number, count: number): { t: number; consumed: boolean } {
  const next = Math.min(Math.max(0, count - 1), Math.max(0, t + deltaY * 0.004));
  return { t: next, consumed: Math.abs(next - t) > 1e-6 };
}

/** Roda na órbita: aproxima/afasta exponencialmente; no limite na direção pedida, não consome (a página rola). */
export function wheelDolly(radius: number, deltaY: number, min: number, max: number): { radius: number; consumed: boolean } {
  const next = Math.min(max, Math.max(min, radius * Math.exp(deltaY * 0.0015)));
  return { radius: next, consumed: Math.abs(next - radius) > 1e-4 };
}

/** Parada mais próxima de t (rótulo do controle deslizante e dos chips). */
export const nearestStop = (stops: StopKey[], t: number): StopKey | null => stops[Math.min(stops.length - 1, Math.max(0, Math.round(t)))] ?? null;
