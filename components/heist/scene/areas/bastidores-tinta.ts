/*
 * MET Gala Heist v2 — bastidores (Z11): a sala dos móveis e o material branco tingido por instância (com a cor em
 * hexadecimal), usados pelos arquivos de móveis dos bastidores. Saiu de bastidores-moveis.ts sem mudança.
 */
import * as THREE from "three";
import { solid } from "../interior-mats";

export const room = "bastidores";
export const COL = (h: string) => new THREE.Color(h);
export const TINT = () => solid("bk-tint", "#ffffff", { rough: 0.55 });
