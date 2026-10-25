/*
 * MET Gala Heist v2 — áudio sintetizado (Web Audio, sem arquivos), com volumes separados (música, efeitos, vozes):
 *  - música da gala: acordes de jazz suaves (ii–V–I–VI) e baixo caminhando; com o alerta sobe uma camada de tensão
 *    (pulso grave e chimbal) e, na fuga, a camada de ação; tudo com crossfade;
 *  - multidão: murmúrio de vozes nas salas sociais (avenida, vestíbulo, salão, lounge), mais baixo nas outras;
 *  - efeitos posicionais: cada tiro, passo de segurança, porta ou garrafa soa do lado e na distância de onde veio;
 *  - reverberação pela sala (salão grande, galeria, salas pequenas, ar livre);
 *  - vozes: as falas podem ser lidas pela síntese de voz do navegador (opcional, desligada por padrão).
 * Só começa depois de um gesto da pessoa (regra dos navegadores).
 */
import type { RoomId, Vec } from "@/lib/heist/types";

const REVERB: Partial<Record<RoomId, { secs: number; wet: number }>> = {
  salao: { secs: 2.6, wet: 0.32 }, galeria: { secs: 2, wet: 0.28 }, vestibulo: { secs: 1.6, wet: 0.24 }, cofre: { secs: 1.4, wet: 0.22 },
  lounge: { secs: 0.9, wet: 0.14 }, bastidores: { secs: 0.8, wet: 0.12 }, servico: { secs: 0.7, wet: 0.16 }, seguranca: { secs: 0.4, wet: 0.08 },
  doca: { secs: 1.2, wet: 0.2 }, rua: { secs: 0.5, wet: 0.06 }, beco: { secs: 0.6, wet: 0.1 }, terraco: { secs: 0.3, wet: 0.04 }, beiral: { secs: 0.2, wet: 0.03 },
};
const CROWD: Partial<Record<RoomId, number>> = { rua: 0.7, vestibulo: 0.8, salao: 1, lounge: 0.85, galeria: 0.45, terraco: 0.3, bastidores: 0.2 };
// ii–V–I–VI em dó (Dm9, G13, Cmaj9, A7♭13), em Hz, e as fundamentais do baixo
const CHORDS = [[146.8, 174.6, 220, 261.6, 329.6], [196, 246.9, 293.7, 349.2, 329.6], [130.8, 164.8, 196, 246.9, 293.7], [110, 138.6, 196, 220, 277.2]];
const BASS = [[73.4, 82.4, 87.3, 98], [98, 110, 123.5, 98], [65.4, 73.4, 82.4, 87.3], [55, 61.7, 69.3, 73.4]];

export class HeistAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private layers: { calm: GainNode; tense: GainNode; action: GainNode } | null = null;
  private reverb: { conv: ConvolverNode; wet: GainNode; room: RoomId | null } | null = null;
  private crowd: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private siren: { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private beatAt = 0; private bar = 0; private beat = 0;
  private heartAt = 0;
  private listener = { x: 0, z: 0, yaw: 0 };
  vol = { music: 0.5, sfx: 0.8, voices: false, voice: 0.8 };
  locale = "pt-BR";

  start() {
    if (this.ctx || typeof window === "undefined") return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const c = new AC(); this.ctx = c;
    this.master = c.createGain(); this.master.gain.value = 1; this.master.connect(c.destination);
    this.music = c.createGain(); this.music.gain.value = this.vol.music * 0.5; this.music.connect(this.master);
    this.sfx = c.createGain(); this.sfx.gain.value = this.vol.sfx; this.sfx.connect(this.master);
    const conv = c.createConvolver(), wet = c.createGain(); wet.gain.value = 0.1; conv.connect(wet).connect(this.master);
    this.reverb = { conv, wet, room: null }; this.setRoom("rua");
    const mk = (v: number) => { const g = c.createGain(); g.gain.value = v; g.connect(this.music!); return g; };
    this.layers = { calm: mk(1), tense: mk(0), action: mk(0) };
    this.startCrowd();
    this.beatAt = c.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 120);
  }
  stop() {
    this.alarm(false); if (this.timer) clearInterval(this.timer); this.timer = null;
    try { this.crowd?.src.stop(); } catch { /* já parou */ }
    this.ctx?.close().catch(() => {}); this.ctx = null; this.crowd = null; this.layers = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }
  setMix(music: number, sfx: number, voices: boolean, voice: number) {
    this.vol = { music, sfx, voices, voice };
    const c = this.ctx; if (!c) return;
    this.music?.gain.setTargetAtTime(music * 0.5, c.currentTime, 0.1); this.sfx?.gain.setTargetAtTime(sfx, c.currentTime, 0.1);
    if (!voices) window.speechSynthesis?.cancel();
  }
  /** Onde a câmera está (para o lado e a distância dos sons). */
  setListener(x: number, z: number, yaw: number) { this.listener = { x, z, yaw }; }

  /** Sala atual: reverberação e multidão. */
  setRoom(room: RoomId) {
    const c = this.ctx, r = this.reverb; if (!c || !r || r.room === room) return;
    r.room = room;
    const cfg = REVERB[room] ?? { secs: 0.8, wet: 0.12 };
    r.conv.buffer = impulse(c, cfg.secs);
    r.wet.gain.setTargetAtTime(cfg.wet, c.currentTime, 0.4);
    if (this.crowd) this.crowd.gain.gain.setTargetAtTime(0.05 * (CROWD[room] ?? 0.05), c.currentTime, 0.8);
  }
  /** Intensidade da música: 0 calma, 1 tensão (alguém desconfiando/alerta), 2 ação (alarme e fuga). */
  setIntensity(level: number, exposure: number) {
    const c = this.ctx, L = this.layers; if (!c || !L) return;
    const tense = level >= 2 ? 0.25 : Math.min(1, Math.max(level >= 1 ? 0.8 : 0, exposure * 1.2));
    L.calm.gain.setTargetAtTime(level >= 2 ? 0.15 : 1 - tense * 0.55, c.currentTime, 0.6);
    L.tense.gain.setTargetAtTime(tense, c.currentTime, 0.5);
    L.action.gain.setTargetAtTime(level >= 2 ? 1 : 0, c.currentTime, 0.4);
  }

  /* ---------- música ---------- */
  private schedule() {
    const c = this.ctx; if (!c || !this.layers) return;
    const spb = 60 / 76;                                                   // 76 batidas por minuto
    while (this.beatAt < c.currentTime + 0.4) {
      const at = this.beatAt, chord = Math.floor(this.bar / 2) % 4, L = this.layers;
      // pad: acorde inteiro no começo de cada compasso
      if (this.beat === 0) for (const f of CHORDS[chord]) this.voice(L.calm, f, at, spb * 4.2, 0.022, "triangle", 900);
      // baixo caminhando (calma) e ostinato grave (tensão)
      this.voice(L.calm, BASS[chord][this.beat], at, spb * 0.9, 0.09, "triangle", 420);
      this.voice(L.tense, BASS[chord][0] / 2, at, spb * 0.45, 0.13, "sawtooth", 260);
      if (this.beat % 2 === 1) this.hat(L.tense, at, 0.03);
      // ação: pulso em colcheias e chimbal aberto
      this.voice(L.action, BASS[chord][0], at, spb * 0.22, 0.12, "square", 520);
      this.voice(L.action, BASS[chord][0], at + spb / 2, spb * 0.22, 0.1, "square", 520);
      this.hat(L.action, at + spb / 2, 0.05);
      this.beatAt += spb; this.beat = (this.beat + 1) % 4; if (this.beat === 0) this.bar++;
    }
  }
  private voice(out: AudioNode, freq: number, at: number, dur: number, gain: number, type: OscillatorType, cutoff: number) {
    const c = this.ctx!; const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = type; o.frequency.value = freq; f.type = "lowpass"; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(gain, at + Math.min(0.25, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(f).connect(g).connect(out); o.start(at); o.stop(at + dur + 0.05);
  }
  private hat(out: AudioNode, at: number, gain: number) {
    const c = this.ctx!; const len = Math.floor(c.sampleRate * 0.05), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); src.buffer = buf; f.type = "highpass"; f.frequency.value = 7000; g.gain.value = gain;
    src.connect(f).connect(g).connect(out); src.start(at);
  }
  private startCrowd() {
    const c = this.ctx!; const secs = 4, buf = c.createBuffer(1, c.sampleRate * secs, c.sampleRate), d = buf.getChannelData(0);
    // ruído com envelopes de sílaba (3–6 Hz) somados: soa como conversa distante, sem palavras
    let e = 0;
    for (let i = 0; i < d.length; i++) { const t = i / c.sampleRate; e = 0.55 + 0.25 * Math.sin(t * 2 * Math.PI * 3.1) * Math.sin(t * 2 * Math.PI * 0.7) + 0.2 * Math.sin(t * 2 * Math.PI * 5.3 + 1); d[i] = (Math.random() * 2 - 1) * Math.max(0, e); }
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const filter = c.createBiquadFilter(); filter.type = "bandpass"; filter.frequency.value = 700; filter.Q.value = 0.8;
    const gain = c.createGain(); gain.gain.value = 0.035;
    src.connect(filter).connect(gain).connect(this.sfx!); src.start();
    this.crowd = { src, gain, filter };
  }

  /* ---------- efeitos ---------- */
  /** Saída de um efeito: com `pos`, vai para o lado de onde veio e cai com a distância; parte vai para a reverberação. */
  private out(pos?: Vec): AudioNode | null {
    const c = this.ctx; if (!c || !this.sfx) return null;
    const g = c.createGain(); g.gain.value = 1;
    if (pos) {
      const dx = pos.x - this.listener.x, dz = pos.z - this.listener.z, d = Math.hypot(dx, dz);
      const rel = Math.atan2(dx, dz) - this.listener.yaw;
      const pan = c.createStereoPanner(); pan.pan.value = Math.max(-1, Math.min(1, -Math.sin(rel)));
      g.gain.value = 1 / (1 + d / 7);
      g.connect(pan).connect(this.sfx);
    } else g.connect(this.sfx);
    if (this.reverb) g.connect(this.reverb.conv);
    return g;
  }
  private noise(dur: number, gain: number, filter: number, type: BiquadFilterType = "lowpass", at = 0, pos?: Vec) {
    const c = this.ctx, out = this.out(pos); if (!c || !out) return;
    const len = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = filter;
    const g = c.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(out); src.start(c.currentTime + at);
  }
  private tone(freq: number, dur: number, gain: number, type: OscillatorType = "sine", at = 0, slide = 0, pos?: Vec) {
    const c = this.ctx, out = this.out(pos); if (!c || !out) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, c.currentTime + at + dur);
    g.gain.setValueAtTime(gain, c.currentTime + at); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
    o.connect(g).connect(out); o.start(c.currentTime + at); o.stop(c.currentTime + at + dur + 0.02);
  }

  play(id: string, gain = 1, pos?: Vec) {
    switch (id) {
      case "shot": this.noise(0.28, 0.9 * gain, 2400, "lowpass", 0, pos); this.tone(90, 0.18, 0.5 * gain, "sine", 0, -50, pos); break;
      case "shotFar": this.noise(0.35, 0.35 * gain, 900, "lowpass", 0, pos); break;
      case "silenced": this.noise(0.09, 0.35 * gain, 3200, "bandpass", 0, pos); break;
      case "hit": this.tone(160, 0.12, 0.45, "square", 0, -90, pos); break;
      case "hurt": this.noise(0.15, 0.5, 600); this.tone(70, 0.25, 0.4, "sine"); break;
      case "empty": this.tone(1800, 0.03, 0.2, "square"); break;
      case "reload": this.tone(900, 0.04, 0.2, "square"); this.tone(600, 0.05, 0.2, "square", 0.35); this.tone(1300, 0.04, 0.25, "square", 0.9); break;
      case "heal": this.tone(520, 0.2, 0.15, "triangle"); this.tone(780, 0.3, 0.12, "triangle", 0.15); break;
      case "detector": this.tone(1500, 0.18, 0.25, "square", 0, 0, pos); this.tone(1500, 0.18, 0.25, "square", 0.25, 0, pos); break;
      case "laser": this.tone(2200, 0.4, 0.2, "sawtooth", 0, -900, pos); break;
      case "locked": this.tone(220, 0.08, 0.25, "square"); this.tone(180, 0.1, 0.2, "square", 0.09); break;
      case "door": this.noise(0.3, 0.2, 500, "lowpass", 0, pos); break;
      case "cloth": this.noise(1.6, 0.18, 1800, "bandpass"); break;
      case "trade": case "buy": this.tone(660, 0.12, 0.18, "triangle"); this.tone(990, 0.2, 0.15, "triangle", 0.1); break;
      case "solved": this.tone(523, 0.15, 0.2, "triangle"); this.tone(659, 0.15, 0.2, "triangle", 0.12); this.tone(784, 0.3, 0.2, "triangle", 0.24); break;
      case "mistake": this.tone(160, 0.25, 0.25, "sawtooth"); break;
      case "key": this.tone(1200, 0.06, 0.15, "square"); break;
      case "glass": this.noise(0.4, 0.5, 5000, "highpass", 0, pos); break;
      case "throw": this.noise(0.15, 0.15, 900); break;
      case "vision": this.tone(300, 0.6, 0.15, "sine", 0, 600); break;
      case "slow": this.tone(400, 0.8, 0.18, "sine", 0, -250); break;
      case "melee": this.noise(0.12, 0.4, 700, "lowpass", 0, pos); break;
      case "down": this.noise(0.35, 0.4, 300, "lowpass", 0, pos); break;
      case "flash": this.noise(0.05, 0.15, 6000, "highpass", 0, pos); break;
      case "step": this.noise(0.05, 0.12 * gain, 1400, "bandpass", 0, pos); break;
      case "objective": this.tone(587, 0.18, 0.12, "triangle"); this.tone(880, 0.35, 0.12, "triangle", 0.14); break;
      case "detected": this.tone(740, 0.12, 0.2, "square"); this.tone(988, 0.2, 0.2, "square", 0.1); break;
      case "ui": this.tone(880, 0.04, 0.12, "triangle"); break;
    }
  }
  alarm(on: boolean) {
    const c = this.ctx; if (!c || !this.sfx) return;
    if (on && !this.siren) {
      const osc = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), gain = c.createGain();
      osc.type = "sawtooth"; osc.frequency.value = 760; lfo.frequency.value = 1.3; lg.gain.value = 260; gain.gain.value = 0.05;
      lfo.connect(lg).connect(osc.frequency); osc.connect(gain).connect(this.sfx); osc.start(); lfo.start();
      this.siren = { osc, lfo, gain };
    } else if (!on && this.siren) { this.siren.osc.stop(); this.siren.lfo.stop(); this.siren = null; }
  }
  /** Batimento com vida baixa: mais rápido quanto mais cansada. */
  heartbeat(now: number, tired: number) {
    if (tired <= 0.05 || !this.ctx) return;
    const period = 1.1 - tired * 0.45;
    if (now - this.heartAt < period) return;
    this.heartAt = now; this.tone(58, 0.12, 0.35 * tired, "sine"); this.tone(52, 0.14, 0.28 * tired, "sine", 0.16);
  }
  /** Fala lida pela síntese de voz do navegador (quando ligada): voz do idioma, mais grave para os seguranças. */
  speak(text: string, low: boolean) {
    if (!this.vol.voices || typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    if (synth.speaking && synth.pending) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = this.locale; u.volume = this.vol.voice; u.rate = 1.05; u.pitch = low ? 0.7 : 1.1;
    const v = synth.getVoices().find((x) => x.lang.toLowerCase().startsWith(this.locale.slice(0, 2).toLowerCase()));
    if (v) u.voice = v;
    synth.speak(u);
  }
}

/** Resposta ao impulso sintética: ruído com decaimento exponencial (estéreo, levemente diferente em cada lado). */
function impulse(c: AudioContext, secs: number): AudioBuffer {
  const len = Math.max(1, Math.floor(c.sampleRate * secs)), buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  return buf;
}
