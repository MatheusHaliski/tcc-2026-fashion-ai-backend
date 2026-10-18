"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Chip, Dialog, Select } from "@/components/ui";
import type { Look3dPiece } from "@/components/three/common";
import { DEFAULT_PIECES } from "@/lib/avatar3d/human/default-outfit";
import { useI18n } from "@/lib/i18n/i18n";
import { OUTFIT_PRESETS, OUTFIT_ZONES, PRESET_COLORS, ZONE_CATEGORIES, withRoomOutfit, type OutfitPreset, type OutfitZone, type RoomOutfit } from "@/lib/room3d/room-outfit";

export interface OutfitPiece { id: string; name: string; category: string }

/**
 * Roupa padrão do quarto (aba Configurações > Roupa do avatar): o conjunto do FashionAI e, em cada zona, uma peça do
 * guarda-roupa no lugar da peça do conjunto; a prévia mostra o avatar vestido antes de salvar.
 */
export function RoomOutfitDialog({ open, onClose, outfit, pieces, owned, onSave, renderPreview }: {
  open: boolean; onClose: () => void; outfit: RoomOutfit; pieces: OutfitPiece[];
  owned: (id: string) => Look3dPiece | null; onSave: (o: RoomOutfit) => Promise<void>;
  renderPreview?: (look: Look3dPiece[]) => ReactNode;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<RoomOutfit>(outfit);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setDraft(outfit); }, [open, outfit]);
  const look = useMemo(() => withRoomOutfit([], draft, owned), [draft, owned]);
  const swatches = (p: OutfitPreset) => (p === "classico" ? [DEFAULT_PIECES.upper.colorHex, DEFAULT_PIECES.lower.colorHex, DEFAULT_PIECES.feet.colorHex] : PRESET_COLORS[p]) as string[];
  const setZone = (z: OutfitZone, id: string) => setDraft((d) => { const choice = { ...d.choice }; if (id) choice[z] = id; else delete choice[z]; return { ...d, choice }; });
  const save = async () => { setBusy(true); try { await onSave(draft); onClose(); } finally { setBusy(false); } };
  return (
    <Dialog open={open} onClose={onClose} size="lg" title={t("room.settings.outfit.dialog_title")}
      footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button variant="primary" loading={busy} onClick={() => { void save(); }}>{t("room.settings.outfit.save")}</Button></>}>
      <div className="room-outfit">
        <div className="room-outfit-form">
          <p className="type-body-sm text-muted">{t("room.settings.outfit.dialog_lead")}</p>
          <div role="radiogroup" aria-label={t("room.settings.outfit.preset")} className="room-outfit-presets">
            {OUTFIT_PRESETS.map((p) => (
              <Chip key={p} role="radio" aria-checked={draft.preset === p} onClick={() => setDraft((d) => ({ ...d, preset: p }))}>
                <span className="room-outfit-swatches" aria-hidden>{swatches(p).map((c, i) => <i key={i} style={{ background: c }} />)}</span>
                {t(`room.settings.outfit.preset_${p}`)}
              </Chip>
            ))}
          </div>
          {OUTFIT_ZONES.map((z) => {
            const options = pieces.filter((p) => ZONE_CATEGORIES[z].includes(p.category));
            return (
              <label key={z} className="room-settings-field"><span>{t(`room.settings.outfit.zone_${z}`)}</span>
                <Select aria-label={t(`room.settings.outfit.zone_${z}`)} value={draft.choice[z] ?? ""} onChange={(e) => setZone(z, e.target.value)}>
                  <option value="">{t("room.settings.outfit.from_preset")}</option>
                  {options.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </label>
            );
          })}
        </div>
        {renderPreview && <figure className="room-outfit-preview" aria-label={t("room.settings.outfit.preview")}>{renderPreview(look)}</figure>}
      </div>
    </Dialog>
  );
}
