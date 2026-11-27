/**
 * Texturas procedurais dos materiais naturais e de tecido: madeira, mármore, pedra, pedra portuguesa, concreto,
 * reboco, asfalto molhado, veludo, tecido, listrado, lã e as amostras do ateliê. Desenhadas em canvas, sem imagem.
 */
import type { MaterialDesc } from "@/lib/flair/nucleos/scene/types";
import { clareia, escurece, fundo, linhas, manchas, mistura, pontilhado, type Ctx, type Sorteio } from "@/components/flair/nucleos/scene/texture-tools";

export type Desenho = (g: Ctx, s: number, m: MaterialDesc, r: Sorteio) => void;

/** Tábuas ao longo de v, cada uma num tom, com veio e emendas. */
export const madeira: Desenho = (g, s, m, r) => {
  const veio = m.cor2 ?? escurece(m.cor, 0.3);
  const tabuas = 6;
  const w = s / tabuas;
  for (let i = 0; i < tabuas; i++) {
    g.fillStyle = mistura(m.cor, veio, r() * 0.35);
    g.fillRect(i * w, 0, w, s);
    g.fillStyle = escurece(veio, 0.4);
    g.fillRect(i * w, 0, 2, s);
    g.fillRect(i * w, r() * s, w, 2);
  }
  linhas(g, s, r, 260, true, veio, 0.22);
  manchas(g, s, r, 10, clareia(m.cor, 0.5), 0.08, 0.2);
};

/** Fundo com nuvens e veios que atravessam a placa. */
export const marmore: Desenho = (g, s, m, r) => {
  const veio = m.cor2 ?? escurece(m.cor, 0.3);
  fundo(g, s, m.cor);
  manchas(g, s, r, 26, clareia(m.cor, 0.6), 0.25, 0.3);
  manchas(g, s, r, 14, veio, 0.12, 0.3);
  for (let i = 0; i < 9; i++) {
    let x = r() * s;
    let y = 0;
    g.strokeStyle = veio;
    g.globalAlpha = 0.18 + r() * 0.3;
    g.lineWidth = 0.6 + r() * 2.4;
    g.beginPath();
    g.moveTo(x, y);
    while (y < s) {
      x += (r() - 0.5) * s * 0.12;
      y += s * (0.04 + r() * 0.08);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
};

/** Blocos de cantaria em fiadas, com rejunte. */
export const pedra: Desenho = (g, s, m, r) => {
  const rejunte = m.cor2 ?? escurece(m.cor, 0.3);
  fundo(g, s, rejunte);
  const fiadas = 4;
  const h = s / fiadas;
  for (let f = 0; f < fiadas; f++) {
    let x = f % 2 === 0 ? 0 : -s * 0.18;
    while (x < s) {
      const w = s * (0.28 + r() * 0.2);
      g.fillStyle = mistura(m.cor, r() > 0.5 ? clareia(m.cor, 0.5) : rejunte, r() * 0.3);
      g.fillRect(x + 3, f * h + 3, w - 6, h - 6);
      x += w;
    }
  }
  pontilhado(g, s, r, 2600, 0.05, 3);
};

/** Calçada de Copacabana: ondas escuras sobre o claro e o desenho miúdo do mosaico. */
export const pedraPortuguesa: Desenho = (g, s, m, r) => {
  const escura = m.cor2 ?? "#22222A";
  fundo(g, s, m.cor);
  const faixas = 4;
  const passo = s / faixas;
  g.fillStyle = escura;
  for (let f = 0; f < faixas; f++) {
    g.beginPath();
    for (let x = 0; x <= s; x += 8) g.lineTo(x, f * passo + passo * 0.25 * Math.sin((x / s) * Math.PI * 4));
    for (let x = s; x >= 0; x -= 8) g.lineTo(x, f * passo + passo * 0.5 + passo * 0.25 * Math.sin((x / s) * Math.PI * 4));
    g.closePath();
    g.fill();
  }
  g.strokeStyle = "rgba(120,120,120,0.28)";
  g.lineWidth = 1;
  const pedrinha = s / 64;
  for (let i = 0; i <= 64; i++) {
    g.beginPath();
    g.moveTo(i * pedrinha, 0);
    g.lineTo(i * pedrinha, s);
    g.moveTo(0, i * pedrinha);
    g.lineTo(s, i * pedrinha);
    g.stroke();
  }
  pontilhado(g, s, r, 1800, 0.05);
};

/** Concreto: manchas de cura, poros e a marca da forma. */
export const concreto: Desenho = (g, s, m, r) => {
  fundo(g, s, m.cor);
  manchas(g, s, r, 40, escurece(m.cor, 0.5), 0.1, 0.3);
  manchas(g, s, r, 30, clareia(m.cor, 0.5), 0.1, 0.25);
  pontilhado(g, s, r, 2200, 0.07, 2);
  g.fillStyle = "rgba(0,0,0,0.1)";
  g.fillRect(0, s * 0.5, s, 2);
  g.fillRect(s * 0.5, 0, 2, s);
};

/** Reboco: grão fino e leves variações de tom. */
export const reboco: Desenho = (g, s, m, r) => {
  fundo(g, s, m.cor);
  manchas(g, s, r, 24, escurece(m.cor, 0.35), 0.07, 0.35);
  manchas(g, s, r, 24, clareia(m.cor, 0.6), 0.09, 0.3);
  pontilhado(g, s, r, 4200, 0.035, 2);
};

/** Asfalto molhado: grão, poças escuras e o reflexo do neon em faixas verticais. */
export const asfalto: Desenho = (g, s, m, r) => {
  fundo(g, s, m.cor);
  pontilhado(g, s, r, 9000, 0.09, 2);
  manchas(g, s, r, 9, "#000000", 0.5, 0.22);
  const reflexos = [m.cor2 ?? "#FF3EA5", "#2FE6FF", m.cor2 ?? "#FF3EA5", "#2FE6FF"];
  reflexos.forEach((cor, i) => {
    const x = s * (0.12 + 0.25 * i + r() * 0.06);
    const w = s * 0.07;
    const grad = g.createLinearGradient(x - w, 0, x + w, 0);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.5, cor);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = 0.2;
    g.fillStyle = grad;
    g.fillRect(x - w, 0, 2 * w, s);
  });
  g.globalAlpha = 1;
};

/** Veludo em pregas: faixas verticais de luz e sombra, com o pelo. */
export const veludo: Desenho = (g, s, m, r) => {
  const sombra = m.cor2 ?? escurece(m.cor, 0.5);
  const pregas = 4;
  for (let x = 0; x < s; x++) {
    const k = 0.5 + 0.5 * Math.sin((x / s) * Math.PI * 2 * pregas);
    g.fillStyle = mistura(sombra, m.cor, k * k);
    g.fillRect(x, 0, 1, s);
  }
  linhas(g, s, r, 300, true, clareia(m.cor, 0.4), 0.1);
  pontilhado(g, s, r, 1500, 0.04);
};

/** Trama de tecido: fios nos dois sentidos. */
export const tecido: Desenho = (g, s, m, r) => {
  fundo(g, s, m.cor);
  const fio = m.cor2 ?? escurece(m.cor, 0.35);
  g.fillStyle = fio;
  for (let i = 0; i < s; i += 4) {
    g.globalAlpha = 0.2;
    g.fillRect(i, 0, 1, s);
    g.fillRect(0, i, s, 1);
  }
  g.globalAlpha = 1;
  pontilhado(g, s, r, 900, 0.05);
};

/** Listras largas de duas cores (toldo), com a trama por cima. */
export const listras: Desenho = (g, s, m, r) => {
  const faixas = 8;
  for (let i = 0; i < faixas; i++) {
    g.fillStyle = i % 2 === 0 ? m.cor : (m.cor2 ?? clareia(m.cor, 0.8));
    g.fillRect((i * s) / faixas, 0, s / faixas, s);
  }
  linhas(g, s, r, 200, false, "#000000", 0.08);
};

/** Lã: fios curtos em todas as direções. */
export const la: Desenho = (g, s, m, r) => {
  fundo(g, s, m.cor);
  const outra = m.cor2 ?? escurece(m.cor, 0.2);
  g.lineWidth = 1.5;
  for (let i = 0; i < 5200; i++) {
    const x = r() * s;
    const y = r() * s;
    const a = r() * Math.PI * 2;
    g.strokeStyle = r() > 0.5 ? outra : clareia(m.cor, 0.3);
    g.globalAlpha = 0.3;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
    g.stroke();
  }
  g.globalAlpha = 1;
};

/** Amostras de tecido: faixas das cores do FashionAI e vizinhas, com trama. */
export const amostras: Desenho = (g, s, m, r) => {
  const cores = [m.cor, m.cor2 ?? "#1F7A76", "#FBE7EE", "#E0A526", "#27345E", "#F1EADC"];
  cores.forEach((cor, i) => {
    g.fillStyle = cor;
    g.fillRect((i * s) / cores.length, 0, s / cores.length + 1, s);
  });
  linhas(g, s, r, 160, false, "#000000", 0.1);
  linhas(g, s, r, 160, true, "#FFFFFF", 0.08);
};
