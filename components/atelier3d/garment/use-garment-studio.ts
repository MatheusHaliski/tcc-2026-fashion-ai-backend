"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LoadedAsset, SceneDocument } from "@/lib/atelier3d/document";
import { garmentTargets } from "@/lib/atelier3d/garment/targets";
import type { AccessoryKind } from "@/lib/atelier3d/garment/state";
import type { SculptMode, Falloff } from "@/lib/atelier3d/garment/sculpt";

export type StudioTab = "material" | "paint" | "print" | "shape" | "extras";
export type StudioMode = "none" | "paint" | "sculpt" | "decal" | "accessory";
export type LightPreset = "neutral" | "studio" | "warm";
export interface PaintBrush { color: string; size: number; opacity: number; hardness: number; erase: boolean; layer: string | null }
export interface SculptBrush { mode: SculptMode; radius: number; strength: number; falloff: Falloff; mirror: boolean }
export interface DecalTool { image: string | null; size: number; rotation: number; opacity: number; selected: string | null }
export interface AccessoryTool { kind: AccessoryKind; size: number; color: string }

export interface GarmentStudio {
  tab: StudioTab;
  setTab: (tab: StudioTab) => void;
  scope: "part" | "all";
  setScope: (scope: "part" | "all") => void;
  targets: string[];
  mode: StudioMode;
  setMode: (mode: StudioMode) => void;
  paint: PaintBrush;
  setPaint: (change: Partial<PaintBrush>) => void;
  sculpt: SculptBrush;
  setSculpt: (change: Partial<SculptBrush>) => void;
  decal: DecalTool;
  setDecal: (change: Partial<DecalTool>) => void;
  accessory: AccessoryTool;
  setAccessory: (change: Partial<AccessoryTool>) => void;
  light: LightPreset;
  setLight: (light: LightPreset) => void;
  mannequin: boolean;
  setMannequin: (value: boolean) => void;
  keepColor: boolean;
  setKeepColor: (value: boolean) => void;
  /** Documento provisório (traço em andamento, controle deslizante arrastando); null = o do histórico. */
  draft: SceneDocument | null;
  preview: (doc: SceneDocument) => void;
  commit: (doc: SceneDocument) => void;
  cancel: () => void;
  error: string | null;
  fail: (code: string | null) => void;
  /** Registrado pelo viewport: captura a imagem atual do canvas. */
  captureRef: React.MutableRefObject<(() => string | null) | null>;
}

function usePatch<T>(initial: T): [T, (change: Partial<T>) => void] {
  const [value, setValue] = useState(initial);
  const patch = useCallback((change: Partial<T>) => setValue((current) => ({ ...current, ...change })), []);
  return [value, patch];
}

/**
 * Estado das ferramentas de roupa. As edições continuam no documento do editor (histórico, salvar e
 * exportar); aqui ficam só a ferramenta ativa, os ajustes do pincel e o documento provisório.
 */
export function useGarmentStudio(asset: LoadedAsset | null, doc: SceneDocument, selected: string, onChange: (doc: SceneDocument) => void): GarmentStudio {
  const [tab, setTab] = useState<StudioTab>("material");
  const [scope, setScope] = useState<"part" | "all">("all");
  const [mode, setMode] = useState<StudioMode>("none");
  const [paint, setPaint] = usePatch<PaintBrush>({ color: "#c8423b", size: 32, opacity: 1, hardness: 0.6, erase: false, layer: null });
  const [sculpt, setSculpt] = usePatch<SculptBrush>({ mode: "pull", radius: 0.12, strength: 0.4, falloff: "smooth", mirror: true });
  const [decal, setDecal] = usePatch<DecalTool>({ image: null, size: 0.25, rotation: 0, opacity: 1, selected: null });
  const [accessory, setAccessory] = usePatch<AccessoryTool>({ kind: "button", size: 0.025, color: "#f4f1ea" });
  const [light, setLight] = useState<LightPreset>("studio");
  const [mannequin, setMannequin] = useState(false);
  const [keepColor, setKeepColor] = useState(false);
  const [draft, setDraft] = useState<SceneDocument | null>(null);
  const [error, fail] = useState<string | null>(null);
  const captureRef = useRef<(() => string | null) | null>(null);
  const base = useRef(doc);
  useEffect(() => {
    if (base.current !== doc) setDraft(null); // desfazer/refazer ou versão nova descartam o provisório
    base.current = doc;
  }, [doc]);
  const targets = useMemo(() => (asset ? garmentTargets(asset, selected, scope) : []), [asset, selected, scope]);
  const commit = useCallback((next: SceneDocument) => {
    setDraft(null);
    fail(null);
    if (next !== base.current) onChange(next);
  }, [onChange]);
  const preview = useCallback((next: SceneDocument) => setDraft(next), []);
  const cancel = useCallback(() => setDraft(null), []);
  const changeTab = useCallback((next: StudioTab) => {
    setTab(next);
    setMode("none");
  }, []);
  return {
    tab, setTab: changeTab, scope, setScope, targets, mode, setMode, paint, setPaint, sculpt, setSculpt,
    decal, setDecal, accessory, setAccessory, light, setLight, mannequin, setMannequin, keepColor, setKeepColor,
    draft, preview, commit, cancel, error, fail, captureRef,
  };
}
