/*
 * Avatar 3D — locomoção: temporários compartilhados e funções escalares (curvas, mistura, hash determinístico).
 * Os temporários são um conjunto só para todos os módulos locomotion-*.ts (a cena roda numa thread).
 */
import * as THREE from "three";

/* ---------- temporários (um conjunto só: o JavaScript da cena roda numa thread) ---------- */
export const Q1 = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), Q3 = new THREE.Quaternion(), Q4 = new THREE.Quaternion();
export const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), V4 = new THREE.Vector3(), V5 = new THREE.Vector3(), V6 = new THREE.Vector3();
export const M1 = new THREE.Matrix4(), M2 = new THREE.Matrix4();
export const CHAIN = new Int16Array(24);
export const D = Math.PI / 180;

export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const hash = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
/** pulso 0→1→0 entre a e b (subida e descida suaves de largura e) */
export const pulse = (a: number, b: number, e: number, x: number) => smooth(a, a + e, x) * (1 - smooth(b - e, b, x));

/* ---------- temporários das poses (alvos de mão e pé) ---------- */
export const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
