/*
 * MET Gala Heist v2 — sons sintetizados (Web Audio, sem arquivos): tiro, tiro com silenciador, acerto, clique sem bala,
 * recarga, cura, detector, laser, sirene do alarme, batimento com vida baixa, porta, troca de roupa, compra e acerto/erro
 * de puzzle. Só começa depois de um gesto da pessoa (regra dos navegadores).
 */
export class HeistAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private siren: { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null;
  private heartAt = 0;
  volume = 0.7;

  start() {
    if (this.ctx || typeof window === "undefined") return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination);
  }
  stop() { this.alarm(false); this.ctx?.close().catch(() => {}); this.ctx = null; }
  setVolume(v: number) { this.volume = v; if (this.master) this.master.gain.value = v; }

  private noise(dur: number, gain: number, filter: number, type: BiquadFilterType = "lowpass", at = 0) {
    const c = this.ctx; if (!c || !this.master) return;
    const len = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = filter;
    const g = c.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(this.master); src.start(c.currentTime + at);
  }
  private tone(freq: number, dur: number, gain: number, type: OscillatorType = "sine", at = 0, slide = 0) {
    const c = this.ctx; if (!c || !this.master) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, c.currentTime + at + dur);
    g.gain.setValueAtTime(gain, c.currentTime + at); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
    o.connect(g).connect(this.master); o.start(c.currentTime + at); o.stop(c.currentTime + at + dur + 0.02);
  }

  play(id: string, gain = 1) {
    switch (id) {
      case "shot": this.noise(0.28, 0.9 * gain, 2400); this.tone(90, 0.18, 0.5 * gain, "sine", 0, -50); break;
      case "shotFar": this.noise(0.35, 0.35 * gain, 900); break;
      case "silenced": this.noise(0.09, 0.35 * gain, 3200, "bandpass"); break;
      case "hit": this.tone(160, 0.12, 0.45, "square", 0, -90); break;
      case "hurt": this.noise(0.15, 0.5, 600); this.tone(70, 0.25, 0.4, "sine"); break;
      case "empty": this.tone(1800, 0.03, 0.2, "square"); break;
      case "reload": this.tone(900, 0.04, 0.2, "square"); this.tone(600, 0.05, 0.2, "square", 0.35); this.tone(1300, 0.04, 0.25, "square", 0.9); break;
      case "heal": this.tone(520, 0.2, 0.15, "triangle"); this.tone(780, 0.3, 0.12, "triangle", 0.15); break;
      case "detector": this.tone(1500, 0.18, 0.25, "square"); this.tone(1500, 0.18, 0.25, "square", 0.25); break;
      case "laser": this.tone(2200, 0.4, 0.2, "sawtooth", 0, -900); break;
      case "locked": this.tone(220, 0.08, 0.25, "square"); this.tone(180, 0.1, 0.2, "square", 0.09); break;
      case "door": this.noise(0.3, 0.2, 500); break;
      case "cloth": this.noise(1.6, 0.18, 1800, "bandpass"); break;
      case "trade": case "buy": this.tone(660, 0.12, 0.18, "triangle"); this.tone(990, 0.2, 0.15, "triangle", 0.1); break;
      case "solved": this.tone(523, 0.15, 0.2, "triangle"); this.tone(659, 0.15, 0.2, "triangle", 0.12); this.tone(784, 0.3, 0.2, "triangle", 0.24); break;
      case "mistake": this.tone(160, 0.25, 0.25, "sawtooth"); break;
      case "key": this.tone(1200, 0.06, 0.15, "square"); break;
      case "glass": this.noise(0.4, 0.5, 5000, "highpass"); break;
      case "throw": this.noise(0.15, 0.15, 900); break;
      case "vision": this.tone(300, 0.6, 0.15, "sine", 0, 600); break;
      case "slow": this.tone(400, 0.8, 0.18, "sine", 0, -250); break;
      case "melee": this.noise(0.12, 0.4, 700); break;
      case "down": this.noise(0.35, 0.4, 300); break;
      case "flash": this.noise(0.05, 0.15, 6000, "highpass"); break;
      case "ui": this.tone(880, 0.04, 0.12, "triangle"); break;
    }
  }
  alarm(on: boolean) {
    const c = this.ctx; if (!c || !this.master) return;
    if (on && !this.siren) {
      const osc = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), gain = c.createGain();
      osc.type = "sawtooth"; osc.frequency.value = 760; lfo.frequency.value = 1.3; lg.gain.value = 260; gain.gain.value = 0.05;
      lfo.connect(lg).connect(osc.frequency); osc.connect(gain).connect(this.master); osc.start(); lfo.start();
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
}
