/**
 * DET-D04 — som de tecido e háptico no quarto: portas e gavetas têm um som curto pelo material (jeans ≠ seda) e uma
 * vibração leve no celular. Som desligado por padrão, háptico ligado (ETI-06); os dois ficam nas Configurações.
 * O som é sintetizado (ruído filtrado), sem arquivos de áudio: nada a baixar, e respeita "reduzir movimento".
 */
export type Fabric = "DENIM" | "SILK" | "WOOL" | "LEATHER" | "COTTON" | "WOOD" | "GLASS";
const PROFILE: Record<Fabric, { freq: number; q: number; dur: number; gain: number; type: BiquadFilterType }> = {
  DENIM: { freq: 900, q: 0.9, dur: 0.16, gain: 0.32, type: "bandpass" },     // áspero, curto
  SILK: { freq: 5200, q: 0.4, dur: 0.32, gain: 0.14, type: "highpass" },     // sussurro longo e agudo
  WOOL: { freq: 600, q: 0.5, dur: 0.22, gain: 0.2, type: "lowpass" },        // abafado
  LEATHER: { freq: 1500, q: 2.5, dur: 0.12, gain: 0.26, type: "bandpass" },  // rangido
  COTTON: { freq: 2200, q: 0.7, dur: 0.2, gain: 0.18, type: "bandpass" },
  WOOD: { freq: 320, q: 4, dur: 0.1, gain: 0.5, type: "bandpass" },          // toque de porta
  GLASS: { freq: 3400, q: 8, dur: 0.14, gain: 0.2, type: "bandpass" },
};

let ctx: AudioContext | null = null;

/** Tecido dominante pelas subcategorias das peças do módulo (o jeans soa diferente da seda). */
export function fabricOf(subcategories: string[], finishMaterial?: string | null): Fabric {
  const s = subcategories.join(" ").toLowerCase();
  if (/jeans|denim/.test(s)) return "DENIM";
  if (/seda|silk|cetim|satin/.test(s)) return "SILK";
  if (/tricot|sueter|sweater|cardigan|la\b|wool|casaco/.test(s)) return "WOOL";
  if (/couro|leather|jaqueta_couro|bota/.test(s)) return "LEATHER";
  if (subcategories.length) return "COTTON";
  return finishMaterial === "VIDRO" || finishMaterial === "ACRILICO" ? "GLASS" : "WOOD";
}

export function feel({ sound, haptics, fabric = "WOOD", reduceMotion = false }: { sound?: boolean; haptics?: boolean; fabric?: Fabric; reduceMotion?: boolean }) {
  if (haptics && !reduceMotion && typeof navigator !== "undefined" && "vibrate" in navigator) {
    try { navigator.vibrate(fabric === "WOOD" || fabric === "GLASS" ? 8 : 14); } catch { /* sem vibração */ }
  }
  if (!sound || typeof window === "undefined") return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (!AC) return;
    ctx ??= new AC(); if (ctx.state === "suspended") void ctx.resume();
    const p = PROFILE[fabric]; const now = ctx.currentTime;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * p.dur), ctx.sampleRate); const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource(); src.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = p.type; filter.frequency.value = p.freq; filter.Q.value = p.q;
    const gain = ctx.createGain(); gain.gain.setValueAtTime(p.gain, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + p.dur);
    src.connect(filter).connect(gain).connect(ctx.destination); src.start(now); src.stop(now + p.dur);
  } catch { /* áudio bloqueado pelo navegador */ }
}
