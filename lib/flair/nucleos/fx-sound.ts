/**
 * Sons dos efeitos da partida, sintetizados com a Web Audio API (nenhum arquivo de áudio): tecido e metal ao vestir,
 * abafado para a carta que não pontua, um toque a cada passo da ação e o acorde do efeito especial. Cada som dura
 * menos de 1 segundo. As preferências (som e efeitos) ficam no aparelho; o som vem desligado por padrão (ETI-06).
 */
export type SomFx = "tecido" | "metal" | "abafado" | "passo" | "especial";

export interface FxPrefs {
  som: boolean;
  efeitos: boolean;
}

export const FX_PREFS_PADRAO: FxPrefs = { som: false, efeitos: true };
export const FX_PREFS_CHAVE = "fai.flair3d.fx";

export function lerFxPrefs(): FxPrefs {
  try {
    const bruto = window.localStorage.getItem(FX_PREFS_CHAVE);
    if (!bruto) return FX_PREFS_PADRAO;
    const lido = JSON.parse(bruto) as Partial<FxPrefs>;
    return { som: lido.som === true, efeitos: lido.efeitos !== false };
  } catch {
    return FX_PREFS_PADRAO;
  }
}

export function salvarFxPrefs(prefs: FxPrefs): void {
  try {
    window.localStorage.setItem(FX_PREFS_CHAVE, JSON.stringify(prefs));
  } catch {
    // sem armazenamento (modo privado): a preferência vale só nesta tela
  }
}

interface Ruido {
  tipo: BiquadFilterType;
  freq: number;
  q: number;
  dur: number;
  ganho: number;
}

const RUIDOS: Record<"tecido" | "abafado", Ruido> = {
  tecido: { tipo: "bandpass", freq: 2200, q: 0.7, dur: 0.22, ganho: 0.18 },
  abafado: { tipo: "lowpass", freq: 280, q: 0.6, dur: 0.18, ganho: 0.12 },
};

/** Notas (Hz) de cada som tonal: metal tilinta, o passo é um toque só e o especial sobe em acorde. */
const NOTAS: Record<"metal" | "passo" | "especial", number[]> = {
  metal: [1760, 2640],
  passo: [660],
  especial: [523, 659, 784],
};

let contexto: AudioContext | null = null;

function abrirContexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Classe = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Classe) return null;
  contexto ??= new Classe();
  if (contexto.state === "suspended") void contexto.resume();
  return contexto;
}

function tocarRuido(ctx: AudioContext, r: Ruido): void {
  const agora = ctx.currentTime;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * r.dur), ctx.sampleRate);
  const dados = buffer.getChannelData(0);
  for (let i = 0; i < dados.length; i++) {
    dados[i] = (Math.random() * 2 - 1) * (1 - i / dados.length);
  }
  const fonte = ctx.createBufferSource();
  fonte.buffer = buffer;
  const filtro = ctx.createBiquadFilter();
  filtro.type = r.tipo;
  filtro.frequency.value = r.freq;
  filtro.Q.value = r.q;
  const ganho = ctx.createGain();
  ganho.gain.setValueAtTime(r.ganho, agora);
  ganho.gain.exponentialRampToValueAtTime(0.0001, agora + r.dur);
  fonte.connect(filtro).connect(ganho).connect(ctx.destination);
  fonte.start(agora);
  fonte.stop(agora + r.dur);
}

function tocarNotas(ctx: AudioContext, notas: number[], forma: OscillatorType, dur: number): void {
  notas.forEach((freq, i) => {
    const inicio = ctx.currentTime + i * 0.09;
    const osc = ctx.createOscillator();
    osc.type = forma;
    osc.frequency.value = freq;
    const ganho = ctx.createGain();
    ganho.gain.setValueAtTime(0.12, inicio);
    ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
    osc.connect(ganho).connect(ctx.destination);
    osc.start(inicio);
    osc.stop(inicio + dur);
  });
}

/** Toca um som de efeito; devolve false quando está mudo ou o navegador não tem (ou bloqueou) o áudio. */
export function tocarFx(som: SomFx, ligado: boolean): boolean {
  if (!ligado) return false;
  try {
    const ctx = abrirContexto();
    if (!ctx) return false;
    if (som === "tecido" || som === "abafado") {
      tocarRuido(ctx, RUIDOS[som]);
    } else {
      tocarNotas(ctx, NOTAS[som], som === "metal" ? "triangle" : "sine", som === "metal" ? 0.35 : 0.25);
    }
    return true;
  } catch {
    return false;
  }
}
