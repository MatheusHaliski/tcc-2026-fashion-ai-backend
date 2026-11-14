/**
 * Texturas procedurais dos materiais construídos: tijolo, ladrilho xadrez, metal escovado, piso emborrachado, laca,
 * fachada com janelas, painel de LED, rede e céu. Desenhadas em canvas, sem imagem.
 */
import type { Desenho } from "@/components/flair/nucleos/scene/textures-natural";
import { clareia, escurece, fundo, linhas, manchas, mistura, pontilhado } from "@/components/flair/nucleos/scene/texture-tools";

/** Tijolos em amarração, cada um num tom, com rejunte fundo. */
export const tijolo: Desenho = (g, s, m, r) => {
  const rejunte = m.cor2 ?? escurece(m.cor, 0.6);
  fundo(g, s, rejunte);
  const fiadas = 8;
  const h = s / fiadas;
  const w = s / 4;
  for (let f = 0; f < fiadas; f++) {
    const desloca = f % 2 === 0 ? 0 : -w / 2;
    for (let i = 0; i < 5; i++) {
      g.fillStyle = mistura(m.cor, r() > 0.5 ? escurece(m.cor, 0.5) : clareia(m.cor, 0.3), r() * 0.45);
      g.fillRect(desloca + i * w + 3, f * h + 3, w - 6, h - 6);
    }
  }
  pontilhado(g, s, r, 3800, 0.07, 3);
  manchas(g, s, r, 8, "#000000", 0.18, 0.3);
};

/** Xadrez de duas cores com rejunte fino e um brilho em cada peça. */
export const ladrilho: Desenho = (g, s, m, r) => {
  const outra = m.cor2 ?? escurece(m.cor, 0.7);
  const lado = s / 2;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const cor = (i + j) % 2 === 0 ? m.cor : outra;
      const grad = g.createLinearGradient(i * lado, j * lado, (i + 1) * lado, (j + 1) * lado);
      grad.addColorStop(0, clareia(cor, 0.12));
      grad.addColorStop(1, escurece(cor, 0.1));
      g.fillStyle = grad;
      g.fillRect(i * lado, j * lado, lado, lado);
    }
  }
  g.fillStyle = mistura(m.cor, outra, 0.5);
  g.fillRect(0, lado - 1, s, 3);
  g.fillRect(lado - 1, 0, 3, s);
  g.fillRect(0, 0, s, 2);
  g.fillRect(0, 0, 2, s);
  pontilhado(g, s, r, 600, 0.03);
};

/** Metal escovado: riscos finos numa direção só. */
export const metal: Desenho = (g, s, m, r) => {
  fundo(g, s, m.cor);
  linhas(g, s, r, 520, false, "#FFFFFF", 0.16);
  linhas(g, s, r, 420, false, "#000000", 0.14);
};

/** Piso emborrachado: grânulos claros e escuros no tom do piso. */
export const borracha: Desenho = (g, s, m, r) => {
  fundo(g, s, m.cor);
  pontilhado(g, s, r, 5200, 0.07, 2);
  manchas(g, s, r, 12, clareia(m.cor, 0.5), 0.06, 0.3);
};

/** Laca: quase lisa, com um véu de luz e microgrão (o brilho vem do material). */
export const laca: Desenho = (g, s, m, r) => {
  const grad = g.createLinearGradient(0, 0, s, s);
  grad.addColorStop(0, clareia(m.cor, 0.08));
  grad.addColorStop(0.5, m.cor);
  grad.addColorStop(1, escurece(m.cor, 0.1));
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  pontilhado(g, s, r, 500, 0.02, 1);
};

/** Fachada com janelas: parede escura e uma grade de janelas, parte acesa. */
export const janelas: Desenho = (g, s, m, r) => {
  fundo(g, s, m.cor);
  const acesa = m.cor2 ?? "#FFD98A";
  const colunas = 5;
  const linhasDeJanela = 7;
  const w = s / colunas;
  const h = s / linhasDeJanela;
  for (let i = 0; i < colunas; i++) {
    for (let j = 0; j < linhasDeJanela; j++) {
      g.fillStyle = r() > 0.45 ? mistura(acesa, "#FFFFFF", r() * 0.3) : escurece(m.cor, 0.4);
      g.fillRect(i * w + w * 0.22, j * h + h * 0.2, w * 0.56, h * 0.55);
    }
  }
};

/** Painel de LED: matriz de pontos com um desenho de luz em ondas. */
export const led: Desenho = (g, s, m, r) => {
  const aceso = m.cor2 ?? "#FF4FA3";
  fundo(g, s, m.cor);
  const pontos = 48;
  const passo = s / pontos;
  const fase = r() * 6;
  for (let i = 0; i < pontos; i++) {
    for (let j = 0; j < pontos; j++) {
      const onda = 0.5 + 0.5 * Math.sin(i * 0.32 + fase) * Math.cos(j * 0.27 - fase) + 0.25 * Math.sin((i + j) * 0.18);
      const k = Math.max(0, Math.min(1, onda));
      g.fillStyle = mistura(m.cor, mistura(aceso, "#FFFFFF", k * 0.35), k);
      g.beginPath();
      g.arc(i * passo + passo / 2, j * passo + passo / 2, passo * 0.36, 0, Math.PI * 2);
      g.fill();
    }
  }
};

/** Rede: malha em losango sobre fundo transparente. */
export const rede: Desenho = (g, s, m) => {
  g.clearRect(0, 0, s, s);
  g.strokeStyle = m.cor;
  g.lineWidth = Math.max(2, s / 90);
  const malhas = 6;
  const passo = s / malhas;
  for (let i = -malhas; i <= 2 * malhas; i++) {
    g.beginPath();
    g.moveTo(i * passo, 0);
    g.lineTo(i * passo + s, s);
    g.moveTo(i * passo, 0);
    g.lineTo(i * passo - s, s);
    g.stroke();
  }
};

/** Céu: o horizonte claro embaixo, o alto em cima e estrelas quando é noite. */
export const ceu: Desenho = (g, s, m, r) => {
  const horizonte = m.cor2 ?? clareia(m.cor, 0.5);
  const grad = g.createLinearGradient(0, s, 0, 0);
  grad.addColorStop(0, horizonte);
  grad.addColorStop(0.38, m.cor);
  grad.addColorStop(1, m.cor);
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  const noite = parseInt(m.cor.slice(1, 3), 16) + parseInt(m.cor.slice(3, 5), 16) + parseInt(m.cor.slice(5, 7), 16) < 150;
  if (!noite) {
    manchas(g, s, r, 9, "#FFFFFF", 0.16, 0.2);
    return;
  }
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`;
    g.fillRect(r() * s, r() * s * 0.7, 1 + r() * 1.5, 1 + r() * 1.5);
  }
};
