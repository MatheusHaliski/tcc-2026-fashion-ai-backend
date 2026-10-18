"use client";
import { useEffect, useState, type ReactNode } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mediaUrl } from "@/lib/api/client";

// In-flight downloads are shared as well as finished models. Purchases never generate or copy GLBs.
const models = new Map<string, Promise<THREE.Group>>();
function load(url: string) {
  let result = models.get(url);
  if (!result) {
    result = new GLTFLoader().loadAsync(url).then(g => g.scene).catch(e => { models.delete(url); throw e; });
    models.set(url, result);
    if (models.size > 16) models.delete(models.keys().next().value!);
  }
  return result;
}
/**
 * Fit uniformly, keeping depth and proportions ("contain"); "fill" scales each axis to the box, for models generated from
 * one photo, whose depth comes flattened (axis-aligned roots only). `rotationY` turns the fitted model (e.g. a model
 * exported facing the other way). Keep the existing functional object while loading or on failure.
 */
export function ApprovedAsset({ url, size, children, centered = false, fit = "contain", rotationY = 0 }: { url?: string | null; size: [number, number, number]; children: ReactNode; centered?: boolean; fit?: "contain" | "fill"; rotationY?: number }) {
  const [model, setModel] = useState<{ url: string; object: THREE.Object3D } | null>(null);
  const source = mediaUrl(url); const [w, h, d] = size;
  useEffect(() => {
    let alive = true;
    if (!source) return;
    load(source).then(root => {
      if (!alive) return;
      const object = clone(root); const bounds = new THREE.Box3().setFromObject(object);
      const extent = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
      const axes = new THREE.Vector3(w / Math.max(extent.x, .001), h / Math.max(extent.y, .001), d / Math.max(extent.z, .001));
      const scale = fit === "fill" ? axes : new THREE.Vector3().setScalar(Math.min(axes.x, axes.y, axes.z));
      object.scale.multiply(scale);
      object.position.sub(new THREE.Vector3(center.x, centered ? center.y : bounds.min.y, center.z).multiply(scale));
      object.rotation.y = rotationY;
      object.traverse(o => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).castShadow = true; (o as THREE.Mesh).receiveShadow = true; } });
      setModel({ url: source, object });
    }).catch(() => { if (alive) setModel(null); });
    return () => { alive = false; };
  }, [source, w, h, d, centered, fit, rotationY]);
  return model && model.url === source ? <primitive object={model.object} /> : <>{children}</>;
}
