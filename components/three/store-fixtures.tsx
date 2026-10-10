"use client";
import * as THREE from "three";
import { useCanvasTexture, useTex } from "@/components/three/common";
import type { SceneProduct } from "@/lib/scene3d/scene";

/* Photographic catalogue communication. This module does not create or certify
 * a 3D product asset from its catalogue image. */

/** Foto do produto (fundo transparente das fotos normalizadas) com altura fixa; sem foto, um volume neutro. */
export function ProductImage({ url, height, position = [0, 0, 0], rotationY = 0, fallback = "#D9D4CC" }: { url?: string | null; height: number; position?: [number, number, number]; rotationY?: number; fallback?: string }) {
  const tex = useTex(url);
  const img = tex?.image as HTMLImageElement | undefined;
  const aspect = img?.width ? img.width / Math.max(1, img.height) : 1;
  const w = Math.min(height * aspect, height * 1.8);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {tex ? (
        <mesh position={[0, height / 2, 0]}><planeGeometry args={[w, w / aspect]} /><meshBasicMaterial map={tex} transparent alphaTest={0.04} toneMapped={false} side={THREE.DoubleSide} /></mesh>
      ) : (
        <mesh position={[0, height * 0.3, 0]}><boxGeometry args={[height * 0.9, height * 0.6, height * 0.4]} /><meshStandardMaterial color={fallback} roughness={0.8} /></mesh>
      )}
    </group>
  );
}

/** Texto escuro ou claro conforme a luminância do fundo (placas legíveis em qualquer cor de marca). */
export function pickInk(bg: string): string {
  const c = new THREE.Color(bg); const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return l > 0.45 ? "#141414" : "#FFFFFF";
}

/** Photographs remain photographs: a fixed print with a mat, frame and product
 * caption. No billboards pretending to be hanging or pedestal-mounted garments.
 */
export function ReferenceGallery({ products, label, position }: { products: SceneProduct[]; label: string; position: [number, number, number] }) {
  const title = useCanvasTexture((g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = "#4A4741"; g.font = "500 48px Inter, Arial, sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(label, w / 2, h / 2, w * .94);
  }, 1024, 96, [label]);
  if (!products.length) return null;
  return <group name="catalog-reference-gallery" position={position}>
    <mesh position={[0, .66, 0]}><planeGeometry args={[1.45, .135]} /><meshBasicMaterial map={title} transparent toneMapped={false} /></mesh>
    {products.slice(0, 2).map((p, i) => <ReferencePrint key={`${p.id}:${p.imageUrl}`} product={p} position={[products.length === 1 ? 0 : -.39 + i * .78, 0, 0]} />)}
  </group>;
}
function ReferencePrint({ product, position }: { product: SceneProduct; position: [number, number, number] }) {
  const tex = useTex(product.imageUrl);
  const image = tex?.image as HTMLImageElement | undefined;
  const aspect = image?.width ? image.width / Math.max(1, image.height) : 1;
  const width = Math.min(.62, .77 * aspect), height = width / Math.max(.05, aspect);
  const caption = useCanvasTexture((g, w, h) => {
    g.fillStyle = "#F7F5F0"; g.fillRect(0, 0, w, h); g.fillStyle = "#33312C";
    g.font = "500 40px Inter, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    const name = product.name.length > 28 ? product.name.slice(0, 27) + "…" : product.name;
    g.fillText(name, w / 2, h / 2, w * .94);
  }, 768, 100, [product.name]);
  return <group name={`catalog-reference-${product.id}`} position={position}>
    <mesh castShadow><boxGeometry args={[.73, 1.12, .028]} /><meshStandardMaterial color="#55534F" roughness={.55} /></mesh>
    <mesh position={[0, 0, .015]}><planeGeometry args={[.69, 1.08]} /><meshStandardMaterial color="#F7F5F0" roughness={.95} /></mesh>
    {tex && <mesh position={[0, .09, .019]}><planeGeometry args={[width, height]} /><meshBasicMaterial map={tex} transparent toneMapped={false} /></mesh>}
    <mesh position={[0, -.45, .019]}><planeGeometry args={[.64, .085]} /><meshBasicMaterial map={caption} toneMapped={false} /></mesh>
  </group>;
}
