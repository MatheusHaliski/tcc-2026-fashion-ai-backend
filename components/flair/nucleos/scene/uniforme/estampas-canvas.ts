/**
 * O desenho de cada estampa do uniforme (lib/flair/nucleos/uniforme/desenho.ts) num canvas com fundo transparente: o
 * número da camisa, o escudo do clube inventado, a estrela do figurino, o raio, a asa e as listras. Formas geométricas
 * próprias, sem logo nem escudo real. Vira textura de uma malha colada na roupa (pecas-do-uniforme.ts).
 */
import * as THREE from "three";
import type { Estampa } from "@/lib/flair/nucleos/uniforme/desenho";

const LADO = 256;

function estrela(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, pontas = 5) {
  g.beginPath();
  for (let i = 0; i < pontas * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / pontas;
    const raio = i % 2 === 0 ? r : r * 0.45;
    g.lineTo(cx + Math.cos(a) * raio, cy + Math.sin(a) * raio);
  }
  g.closePath();
}

function escudo(g: CanvasRenderingContext2D, [borda, fundo, detalhe]: Estampa["cores"]) {
  const forma = () => {
    g.beginPath();
    g.moveTo(40, 30);
    g.lineTo(216, 30);
    g.lineTo(216, 120);
    g.quadraticCurveTo(216, 200, 128, 236);
    g.quadraticCurveTo(40, 200, 40, 120);
    g.closePath();
  };
  forma();
  g.fillStyle = fundo;
  g.fill();
  g.save();
  forma();
  g.clip();
  // a faixa diagonal e a meia-lua: o escudo do clube inventado
  g.fillStyle = borda;
  g.beginPath();
  g.moveTo(40, 150);
  g.lineTo(216, 60);
  g.lineTo(216, 100);
  g.lineTo(40, 190);
  g.closePath();
  g.fill();
  g.restore();
  estrela(g, 128, 78, 26);
  g.fillStyle = detalhe;
  g.fill();
  forma();
  g.lineWidth = 14;
  g.strokeStyle = borda;
  g.stroke();
}

function raio(g: CanvasRenderingContext2D) {
  g.beginPath();
  g.moveTo(150, 24);
  g.lineTo(70, 140);
  g.lineTo(124, 140);
  g.lineTo(98, 232);
  g.lineTo(190, 106);
  g.lineTo(134, 106);
  g.closePath();
}

function asa(g: CanvasRenderingContext2D) {
  g.beginPath();
  g.moveTo(128, 200);
  for (let i = 0; i < 4; i++) {
    const y = 70 + i * 32;
    g.quadraticCurveTo(30 + i * 10, y - 20, 18 + i * 14, y + 6);
  }
  g.lineTo(128, 120);
  for (let i = 3; i >= 0; i--) {
    const y = 70 + i * 32;
    g.lineTo(238 - i * 14, y + 6);
    g.quadraticCurveTo(226 - i * 10, y - 20, 128, 200 - i * 4);
  }
  g.closePath();
}

/** O emblema do herói: o losango de contraste com a forma por cima. */
function emblema(g: CanvasRenderingContext2D, forma: Estampa["forma"], [cor, , fundo]: Estampa["cores"]) {
  g.beginPath();
  g.moveTo(128, 8);
  g.lineTo(248, 128);
  g.lineTo(128, 248);
  g.lineTo(8, 128);
  g.closePath();
  g.fillStyle = fundo;
  g.fill();
  g.lineWidth = 12;
  g.strokeStyle = cor;
  g.stroke();
  if (forma === "RAIO") raio(g);
  else if (forma === "ASA") asa(g);
  else estrela(g, 128, 132, 84);
  g.fillStyle = cor;
  g.fill();
}

/** A textura da estampa (canvas 256 × 256, fundo transparente). */
export function texturaDaEstampa(e: Estampa): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = LADO;
  cv.height = LADO;
  const g = cv.getContext("2d");
  if (g) {
    const [cor, segunda, contorno] = e.cores;
    if (e.forma === "NUMERO") {
      g.font = `900 ${e.texto && e.texto.length > 1 ? 190 : 220}px "Arial Black", Arial, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineJoin = "round";
      g.lineWidth = 18;
      g.strokeStyle = segunda;
      g.strokeText(e.texto ?? "", 128, 138);
      g.fillStyle = cor;
      g.fillText(e.texto ?? "", 128, 138);
    } else if (e.forma === "ESCUDO") escudo(g, e.cores);
    else if (e.forma === "LISTRAS") {
      for (let x = 0; x < LADO; x += 64) {
        g.fillStyle = cor;
        g.fillRect(x + 8, 0, 22, LADO);
      }
    } else if (e.selo) {
      emblema(g, e.forma, e.cores);
    } else {
      estrela(g, 128, 132, 110);
      g.fillStyle = cor;
      g.fill();
      g.lineWidth = 10;
      g.strokeStyle = contorno;
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
