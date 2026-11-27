/**
 * Around the World: o lugar de cada etapa (reauditoria de 25/11/2026: "Nova York, Paris, Tóquio, o elevador e o metrô
 * aparecem todos na calçada do Rio"). O servidor diz o código da etapa (REGIAO_PARIS, ANDAR_ROOFTOP, ESTACAO_SHOW) e a
 * cena troca de lugar: as sete outras regiões são a mesma rua com a pedra, a fachada, o toldo, o céu e a luz de cada
 * cidade, mais o que a identifica (o tijolo e o neon de Nova York, o arco da galeria de Milão, os letreiros de Tóquio);
 * os andares da torre são um saguão com a porta do elevador, e as estações, uma plataforma com a cor da linha. Todos
 * dividem as zonas, a faixa de caminhada, o mapa e as luzes com a rua do Rio (salas/around-the-world.ts).
 */
import { asfaltoMolhado, borracha, ceu, concreto, ladrilho, listrado, luz, madeira, marmore, metalPintado, pedra, pedraPortuguesa, reboco, tecido, tijolo, tinta } from "@/lib/flair/nucleos/scene/materials";
import { bancoEstofado, bancoRua } from "@/lib/flair/nucleos/scene/moveis/assentos";
import { cartaz, pedestaisComCordao, quadro } from "@/lib/flair/nucleos/scene/moveis/cenarios";
import { folhaPorta, portal, vasoAlto } from "@/lib/flair/nucleos/scene/moveis/loja";
import { neon, painelLed } from "@/lib/flair/nucleos/scene/moveis/palco";
import { luminariaDeTeto } from "@/lib/flair/nucleos/scene/moveis/set";
import { caixote, grade, parapeito, tambor } from "@/lib/flair/nucleos/scene/moveis/urbano";
import { lateraisDaRua, MATERIAIS_DO_RIO, ruaDaViagem, SALA_AROUND_THE_WORLD, type LugarDaViagem } from "@/lib/flair/nucleos/scene/salas/around-the-world";
import type { MaterialDesc, Movel, Sala } from "@/lib/flair/nucleos/scene/types";

type Materiais = Record<string, MaterialDesc>;

/** Uma região: a rua do Rio com os materiais trocados e os móveis que só ela tem. */
function regiao(materiais: Materiais, extras: Movel[], resto: Omit<LugarDaViagem, "materiais" | "laterais">): Sala {
  return ruaDaViagem({ materiais: { ...MATERIAIS_DO_RIO, ...materiais }, laterais: [...lateraisDaRua(), ...extras], ...resto });
}

const NOITE = { principal: { cor: "#C9D6FF", intensidade: 1.5, pos: [3.6, 6.6, 3.4] as [number, number, number] }, ambiente: { ceu: "#5A6AA8", chao: "#23252E", intensidade: 0.5 } };

const NOVA_YORK = regiao({
  portuguesa: pedraPortuguesa("#C9CACD", "#3A3B40"),
  calcada: pedra("#8D8E92", "#5F6066"),
  fachada: tijolo("#8A4B3A", "#4E2A20"),
  moldura: metalPintado("#1B1B1E"),
  toldo: listrado("#F2C230", "#1B1B1E"),
  ceu: ceu("#22355C", "#F2A65A"),
  neon: luz("#FF5A5A", 2.4),
}, [
  grade({ pos: [3.2, 0, -8.7] }, "ferro", 2.2, 2.2),
  tambor({ pos: [3.6, 0, -6.2] }, "ferro"),
  caixote({ pos: [-3.5, 0, 0.9] }, "madeira", 0.7),
  neon({ pos: [4.44, 3.5, -6.6], giro: -90 }, "neon", "ferro", 1.6, 0.7),
], { luzes: { ambiente: { ceu: "#F2C8A0", chao: "#5F6066", intensidade: 0.55 } }, luzDoLugar: "#FFB36B", fundo: "#E9B48A" });

const PARIS = regiao({
  calcada: pedra("#B8B4AA", "#8B877D"),
  fachada: reboco("#E6DFCF"),
  moldura: metalPintado("#1E1E22"),
  toldo: listrado("#1F2E4D", "#F3EEE0"),
  ceu: ceu("#7F9BB8", "#E9E4DA"),
  folhas: tinta("#3E7A3A"),
}, [
  vasoAlto({ pos: [-3.6, 0, 0.9] }, "ferro", "folhas"),
  vasoAlto({ pos: [3.6, 0, -6.3] }, "ferro", "folhas"),
  bancoRua({ pos: [-2.9, 0, -7.4], giro: 90 }, "madeira", "ferro", 1.4),
], { luzes: { ambiente: { ceu: "#DCE3EC", chao: "#B8B4AA", intensidade: 0.7 } }, fundo: "#E9E4DA" });

const MILAO = regiao({
  portuguesa: marmore("#F4F0E8", "#6E6658"),
  calcada: marmore("#D8D2C6", "#8E8778"),
  fachada: marmore("#EDE6DA", "#B9A98F"),
  moldura: metalPintado("#8A6A2A"),
  toldo: listrado("#7A1E2B", "#E9D7A6"),
  ceu: ceu("#6FA3D8", "#F3E2C2"),
}, [
  portal({ pos: [2.5, 0, -8.85] }, "moldura", 2.3, 3.2),
  pedestaisComCordao({ pos: [3.5, 0, -5.9], giro: 90 }, "moldura", "toldo", 3, 1.0),
], { luzDoLugar: "#FFE2A8", fundo: "#F3E2C2" });

const LAGOS = regiao({
  calcada: pedra("#C9A77A", "#9A7B52"),
  fachada: reboco("#D9772E"),
  moldura: metalPintado("#5A2E1A"),
  toldo: listrado("#1F9A4B", "#F2C230"),
  ceu: ceu("#E8743B", "#FFD9A0"),
}, [
  caixote({ pos: [3.5, 0, -6.1] }, "madeira", 0.8),
  caixote({ pos: [3.7, 0, -5.2] }, "madeira", 0.6),
  tambor({ pos: [-3.5, 0, 0.9] }, "moldura"),
  caixote({ pos: [-3.6, 0, -7.4] }, "madeira", 0.7),
], { luzes: { principal: { cor: "#FFC98A", intensidade: 2.1, pos: [3.6, 5.2, 3.4] }, ambiente: { ceu: "#FFD9A0", chao: "#C9A77A", intensidade: 0.65 } }, luzDoLugar: "#FFB36B", fundo: "#FFD9A0" });

const SEUL = regiao({
  portuguesa: pedraPortuguesa("#E9EBEF", "#6B7080"),
  calcada: pedra("#A9ADB5", "#7B7F88"),
  fachada: concreto("#D9DCE2"),
  moldura: metalPintado("#2B3A67"),
  toldo: listrado("#F5A9C8", "#FFFFFF"),
  ceu: ceu("#2B3A67", "#F5A9C8"),
  neon: luz("#FF7AC8", 2.4),
}, [
  neon({ pos: [4.44, 3.4, -6.6], giro: -90 }, "neon", "ferro", 1.4, 0.9, 2),
  neon({ pos: [-4.44, 3.6, -3.3], giro: 90 }, "neon", "ferro", 1.8, 0.6, 4),
  bancoRua({ pos: [-2.9, 0, 0.8], giro: 90 }, "madeira", "ferro", 1.4),
], { luzes: { ambiente: { ceu: "#F5C6DC", chao: "#7B7F88", intensidade: 0.6 } }, luzDoLugar: "#FF9AD5", fundo: "#F0B8D2" });

const TOQUIO = regiao({
  portuguesa: pedraPortuguesa("#B9BDC9", "#17181F"),
  calcada: asfaltoMolhado("#23252E", "#5A3A8A"),
  fachada: concreto("#2A2D3A"),
  moldura: metalPintado("#101014"),
  toldo: listrado("#D22B2B", "#F2F2F2"),
  ceu: ceu("#0B0E1F", "#3A2A66"),
  neon: luz("#39E6FF", 2.6),
}, [
  neon({ pos: [4.44, 3.4, -6.6], giro: -90 }, "neon", "ferro", 1.2, 1.2, 4),
  neon({ pos: [-4.44, 3.5, -3.3], giro: 90 }, "neon", "ferro", 1.9, 0.6, 5),
  neon({ pos: [4.44, 3.3, -1.0], giro: -90 }, "neon", "ferro", 0.8, 1.4, 2),
  painelLed({ pos: [2.5, 2.6, -8.9] }, "neon", "ferro", 2.4, 1.3, 0),
], { luzes: NOITE, luzDoLugar: "#FF4FD8", fundo: "#0B0E1F" });

const SYDNEY = regiao({
  calcada: pedra("#E3D3B0", "#BFAE88"),
  fachada: reboco("#F7F4EC"),
  moldura: metalPintado("#1E73BE"),
  toldo: listrado("#1E73BE", "#FFFFFF"),
  ceu: ceu("#2F8FE0", "#DDF1FB"),
  folhas: tinta("#2F8F5A"),
}, [
  vasoAlto({ pos: [-3.6, 0, 0.9] }, "moldura", "folhas"),
  vasoAlto({ pos: [3.6, 0, -6.3] }, "moldura", "folhas"),
  vasoAlto({ pos: [-3.6, 0, -7.4] }, "moldura", "folhas"),
], { luzes: { principal: { cor: "#FFFFFF", intensidade: 2.5, pos: [3.6, 6.6, 3.4] }, ambiente: { ceu: "#DDF1FB", chao: "#E3D3B0", intensidade: 0.8 } }, fundo: "#DDF1FB" });

/** O saguão de um andar da torre: a porta do elevador ao fundo, o banco, os quadros e a luz de teto, na cor do andar. */
function andar(piso: MaterialDesc, parede: MaterialDesc, cor: string): Sala {
  return ruaDaViagem({
    cobertura: "teto",
    materiais: {
      portuguesa: tecido(cor),
      calcada: piso,
      fachada: parede,
      moldura: metalPintado("#B9BEC6"),
      toldo: tecido(cor),
      ferro: metalPintado("#1F2226"),
      madeira: madeira("#9A6B3F", "#6B4526"),
      luz: luz("#FFF3C4", 1.8),
      ceu: reboco("#F0EEE8"),
    },
    laterais: [
      portal({ pos: [-2.2, 0, -8.85] }, "ferro", 2.3, 2.9),
      folhaPorta({ pos: [-2.2, 0, -8.9] }, "moldura", "ferro", null, 1.15, 2.9, 1),
      folhaPorta({ pos: [-2.2, 0, -8.9] }, "moldura", "ferro", null, 1.15, 2.9, -1),
      bancoEstofado({ pos: [-3.6, 0, -3.2], giro: 90 }, "toldo", "ferro", 1.6),
      bancoEstofado({ pos: [3.6, 0, -1.2], giro: -90 }, "toldo", "ferro", 1.6),
      quadro({ pos: [-4.44, 1.2, -5.6], giro: 90 }, "madeira", "toldo", 1.2, 1.5),
      quadro({ pos: [4.44, 1.2, -4.2], giro: -90 }, "madeira", "toldo", 1.5, 1.2),
      luminariaDeTeto({ pos: [0, 7.4, -5] }, "ferro", "luz", 3),
      luminariaDeTeto({ pos: [0, 7.4, 0] }, "ferro", "luz", 3),
    ],
    luzes: { ambiente: { ceu: "#FFF6E0", chao: "#6B6660", intensidade: 0.6 } },
    fundo: "#2A2622",
  });
}

/** O rooftop: o último andar, a céu aberto, à noite, com o parapeito e os letreiros da cidade. */
const ROOFTOP = regiao({
  portuguesa: tecido("#7A3FC4"),
  calcada: concreto("#4A4E58"),
  fachada: concreto("#2A2D3A"),
  ceu: ceu("#0B0E1F", "#3A2A66"),
  neon: luz("#FF4FD8", 2.4),
}, [
  parapeito({ pos: [-4.3, 0, 1.4], giro: 90 }, "fachada", "ferro", 2.6),
  neon({ pos: [4.44, 3.4, -6.6], giro: -90 }, "neon", "ferro", 1.6, 0.8, 3),
], { luzes: NOITE, luzDoLugar: "#FF4FD8", fundo: "#0B0E1F" });

/** A plataforma de uma estação do metrô: azulejo, a faixa de segurança, os bancos, os cartazes e a cor da linha. */
function estacao(cor: string): Sala {
  return ruaDaViagem({
    cobertura: "teto",
    materiais: {
      portuguesa: { ...ladrilho("#F2C230", "#1B1B1E"), repete: 0.4 },
      calcada: concreto("#9A9CA3"),
      fachada: { ...ladrilho("#F2F2EE", "#C9CCD2"), repete: 0.3 },
      toldo: tinta(cor),
      ferro: metalPintado("#1F2226"),
      madeira: borracha("#3A3D44"),
      luz: luz("#F2F6FF", 2),
      ceu: concreto("#6F7278"),
    },
    laterais: [
      bancoRua({ pos: [-2.9, 0, -3.2], giro: 90 }, "madeira", "ferro", 1.8),
      bancoRua({ pos: [2.9, 0, -0.8], giro: -90 }, "madeira", "ferro", 1.8),
      cartaz({ pos: [-4.44, 1.0, -1.5], giro: 90 }, "fachada", "toldo", 1.2, 1.6),
      cartaz({ pos: [-4.44, 1.0, -5.6], giro: 90 }, "fachada", "toldo", 1.2, 1.6),
      cartaz({ pos: [4.44, 1.0, -3.4], giro: -90 }, "fachada", "toldo", 1.6, 1.2),
      cartaz({ pos: [-2.2, 2.6, -8.94] }, "toldo", "fachada", 3.4, 0.7),
      grade({ pos: [3.2, 0, -8.7] }, "ferro", 2.2, 2.2),
      luminariaDeTeto({ pos: [-2.6, 7.4, -4] }, "ferro", "luz", 4),
      luminariaDeTeto({ pos: [2.6, 7.4, -4] }, "ferro", "luz", 4),
      luminariaDeTeto({ pos: [0, 7.4, 1] }, "ferro", "luz", 3),
    ],
    luzes: { principal: { cor: "#F2F6FF", intensidade: 2, pos: [3.6, 6.6, 3.4] }, ambiente: { ceu: "#F2F6FF", chao: "#6F7278", intensidade: 0.6 } },
    luzDoLugar: cor,
    fundo: "#1B1D22",
  });
}

/** O lugar de cada etapa da viagem, pelo código que o servidor dá. A região 1 é a sala do jogo. */
export const LUGARES_DA_VIAGEM: Record<string, Sala> = {
  REGIAO_RIO_DE_JANEIRO: SALA_AROUND_THE_WORLD,
  REGIAO_NOVA_YORK: NOVA_YORK,
  REGIAO_PARIS: PARIS,
  REGIAO_MILAO: MILAO,
  REGIAO_LAGOS: LAGOS,
  REGIAO_SEUL: SEUL,
  REGIAO_TOQUIO: TOQUIO,
  REGIAO_SYDNEY: SYDNEY,
  ANDAR_ACADEMIA: andar(borracha("#2A2D33"), concreto("#C9CCD2"), "#8BC53F"),
  ANDAR_ESCRITORIO: andar(tecido("#5E6672", "#4A515C"), madeira("#B08A5A", "#8A6A42"), "#1E4FBF"),
  ANDAR_RESTAURANTE: andar(madeira("#6B4526", "#4A2E18", 0.3), reboco("#3A1F24"), "#8E1B43"),
  ANDAR_ROOFTOP: ROOFTOP,
  ESTACAO_TRABALHO: estacao("#1E4FBF"),
  ESTACAO_ALMOCO: estacao("#F28C38"),
  ESTACAO_ACADEMIA: estacao("#1F9A4B"),
  ESTACAO_VERNISSAGE: estacao("#7A3FC4"),
  ESTACAO_SHOW: estacao("#E64C93"),
  ESTACAO_JANTAR: estacao("#C8283A"),
};
