/** Avatar 3D (RF40) — cabelo: interpolação suave e ruídos determinísticos (sem sorteio a cada render). */
export const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Altura da linha do cabelo em função do ângulo em volta da cabeça (0 = frente, π = nuca). */
/** Ruído determinístico por ângulo (−1…1): linha do cabelo e pontas irregulares, sem sorteio a cada render. */
export const wobble = (x: number) => Math.sin(x * 23.1) * 0.5 + Math.sin(x * 41.7 + 1.3) * 0.3 + Math.sin(x * 7.3 + 0.4) * 0.2;
export const hash = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
