"use client";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/i18n";
import { CATEGORY_KEYS, label, useTaxonomy } from "@/lib/api/taxonomy";
import { useApi } from "@/lib/hooks/use-api";
import { lensApi } from "@/lib/lens/api";
import { LENS_PATTERNS } from "@/lib/lens/model";
import type { LensDetectionPatch, LensDetectionView } from "@/lib/lens/types";
import { Button, ChipMultiSelect, Dialog, Dropdown, Field, useToast } from "@/components/ui";
import { useLens } from "./lens-context";
import { LensMatchBadge, LensPortal } from "./lens-parts";

/**
 * Correção da leitura (§8.3): cada atributo é editável com as opções da taxonomia. Salvar grava a correção
 * (lens_feedback), marca a peça como corrigida e refaz na hora as correspondências — sem recarregar a página.
 */
export function LensCorrectDialog({ detection, open, onClose }: { detection: LensDetectionView; open: boolean; onClose: () => void }) {
  const { t } = useI18n(); const tax = useTaxonomy(); const toast = useToast();
  const { scan, updateDetection } = useLens();
  const initial = () => ({
    category: detection.category ?? "", subcategory: detection.subcategory ?? "", color: detection.colors[0]?.name ?? "",
    material: detection.material ?? "", pattern: (detection.pattern ?? "").toUpperCase(), styles: detection.styles.slice(0, 2),
  });
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setV(initial()); }, [open, detection.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const none = { id: "", label: t("lens.correct.unknown") };
  const withCurrent = (ids: string[], current: string) => (current && !ids.includes(current) ? [current, ...ids] : ids);
  const opts = (ids: string[], current: string, fmt: (id: string) => string = label) => [none, ...withCurrent(ids, current).map((id) => ({ id, label: fmt(id) }))];
  const subs = tax?.subcategories?.[v.category] ?? [];

  async function save() {
    const before = initial();
    const patch: LensDetectionPatch = {};
    (["category", "subcategory", "color", "material", "pattern"] as const).forEach((k) => { if (v[k] && v[k] !== before[k]) patch[k] = v[k]; });
    if (patch.pattern) patch.pattern = patch.pattern.toLowerCase();   // o backend grava o padrão em minúsculas (PatternAnalyzer)
    if (v.styles.join() !== before.styles.join()) patch.styles = v.styles;
    if (!Object.keys(patch).length) { onClose(); return; }
    setBusy(true);
    try {
      const updated = await lensApi.patchDetection(scan.id, detection.id, patch);
      updateDetection(updated, { refresh: true });
      toast.success(t("lens.correct.saved"));
      onClose();
    } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("lens.correct.title", { label: detection.label })}
      footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button variant="primary" loading={busy} onClick={save}>{t("lens.correct.save")}</Button></>}>
      <p className="type-body-sm text-muted mb-3">{t("lens.correct.hint")}</p>
      <div className="lens-correct-grid">
        <Pick label={t("common.category")} value={v.category} options={opts([...CATEGORY_KEYS], v.category)}
          onChange={(category) => setV((x) => ({ ...x, category, subcategory: category === x.category ? x.subcategory : "" }))} />
        <Pick label={t("common.subcategory")} value={v.subcategory} options={opts(subs, v.subcategory)} onChange={(subcategory) => setV((x) => ({ ...x, subcategory }))} />
        <Pick label={t("common.color")} value={v.color} options={opts(Object.keys(tax?.colors ?? {}), v.color)} onChange={(color) => setV((x) => ({ ...x, color }))} />
        <Pick label={t("common.material")} value={v.material} options={opts(tax?.materials ?? [], v.material)} onChange={(material) => setV((x) => ({ ...x, material }))} />
        <Pick label={t("lens.attr.pattern")} value={v.pattern} options={opts([...LENS_PATTERNS], v.pattern, (p) => ((LENS_PATTERNS as readonly string[]).includes(p) ? t(`lens.pattern.${p}`) : label(p)))} onChange={(pattern) => setV((x) => ({ ...x, pattern }))} />
      </div>
      <ChipMultiSelect legend={t("common.estilos")} max={2} value={v.styles} onChange={(styles) => setV((x) => ({ ...x, styles }))}
        options={(tax?.styles ?? []).map((s) => ({ id: s, label: label(s) }))} />
    </Dialog>
  );
}

/** Um atributo corrigível: rótulo visível ligado ao botão da lista (id). */
function Pick({ label: text, value, options, onChange }: { label: string; value: string; options: { id: string; label: string }[]; onChange: (v: string) => void }) {
  const id = useId();
  return <Field label={text} id={id}><Dropdown block id={id} value={value} options={options} onChange={onChange} /></Field>;
}

/** Botão "Corrigir" (verso do card e cabeçalho das abas com foco): abre a correção da leitura. */
export function LensCorrectButton({ detection, size = "sm", variant }: { detection: LensDetectionView; size?: "sm"; variant?: "ghost" | "default" }) {
  const { t } = useI18n(); const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant={variant} aria-haspopup="dialog" onClick={() => setOpen(true)}>{t("lens.correct.open")}</Button>
      {open && <LensPortal><LensCorrectDialog detection={detection} open={open} onClose={() => setOpen(false)} /></LensPortal>}
    </>
  );
}

/**
 * "Eu tenho": liga a peça detectada a uma peça do guarda-roupa (entre as parecidas) ou abre o cadastro pré-preenchido.
 * A foto da peça nova nunca é o recorte da foto de outra pessoa (o backend devolve o href sem imagem).
 */
export function LensOwnDialog({ detection, open, onClose }: { detection: LensDetectionView; open: boolean; onClose: () => void }) {
  const { t } = useI18n(); const toast = useToast(); const router = useRouter();
  const { scan, updateDetection, version } = useLens();
  const matches = useApi((signal) => lensApi.matches(scan.id, { detection: detection.id, scope: "MY_CLOSET" }, signal), [scan.id, detection.id, version], { enabled: open });
  const [busy, setBusy] = useState<string | null>(null);
  async function link(itemId?: string) {
    setBusy(itemId ?? "new");
    try {
      const r = await lensApi.own(scan.id, detection.id, itemId);
      updateDetection(r.detection);
      if (itemId) { toast.success(t("lens.own.linked")); onClose(); }
      else router.push(r.href);
    } catch (e) { toast.fromError(e); } finally { setBusy(null); }
  }
  const items = (matches.data?.items ?? []).slice(0, 6);
  return (
    <Dialog open={open} onClose={onClose} title={t("lens.own.title", { label: detection.label })}
      footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button variant="primary" loading={busy === "new"} onClick={() => link()}>{t("lens.own.new_piece")}</Button></>}>
      <p className="type-body-sm text-muted mb-3">{t("lens.own.hint")}</p>
      {matches.loading ? <p className="type-body-sm text-muted" aria-busy="true">{t("lens.loading_matches")}</p>
        : items.length ? (
          <ul className="lens-own-list">
            {items.map((m) => (
              <li key={m.targetId}>
                <button type="button" className="lens-own-item" onClick={() => link(m.targetId)} disabled={!!busy} aria-busy={busy === m.targetId || undefined}>
                  <span className="lens-own-name">{m.piece.name}</span>
                  <LensMatchBadge match={m} />
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="type-body-sm">{t("lens.closet.none")}</p>}
    </Dialog>
  );
}
