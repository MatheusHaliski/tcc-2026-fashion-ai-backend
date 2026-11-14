"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { CATEGORY_LABEL, label, useTaxonomy } from "@/lib/api/taxonomy";
import { Button, cn } from "@/components/ui";
import type { PieceFormValue } from "@/components/piece-form";
import { FULL_BOX, cropBox, detectedPrefill, type BrandHint, type DetectedPiece, type MultiDetection } from "@/components/pieces/detected-piece";

/**
 * Peça detectada escolhida para seguir pelo criador em etapas (sem modal): o recorte (ou a foto inteira), o rascunho da
 * análise e os dados que a IA leu, para conferir em Dados → Mais detalhes → Arte → Revisar.
 */
export interface PhotoPick { key: string; file: File; preview: string; draftId: string; index: number; value: PieceFormValue; photo: number; piece: number; hint?: BrandHint | null }

export interface PhotoItem {
  id: string; file: File; preview: string;
  status: "idle" | "analyzing" | "ready" | "error" | "done";
  detection?: MultiDetection; error?: string; saved?: number;
}

/**
 * Peças achadas em cada foto, na própria página do criador: miniatura recortada, nome lido e "Usar esta peça". A escolhida
 * segue pelas etapas do criador; as já salvas ficam marcadas e a pessoa volta aqui para a próxima. Quando a leitura foi
 * local (sem IA online), um aviso diz isso e que tipo e nome ficam para a pessoa informar.
 */
export function DetectedPieces({ items, onPick, picked, savedKeys, onAvailable }: { items: PhotoItem[]; onPick: (p: PhotoPick) => void; picked: string | null; savedKeys: string[]; onAvailable?: (keys: string[]) => void }) {
  const { t } = useI18n(); const tax = useTaxonomy();
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const ready = items.filter((i) => i.detection);
  const entries = ready.flatMap((it) => {
    const photo = items.indexOf(it) + 1;
    const pieces = it.detection!.pieces.length ? it.detection!.pieces : [{ index: -1, box: FULL_BOX, confidence: 0 } as DetectedPiece];
    return pieces.map((p, n) => ({ key: `${it.id}#${p.index}`, it, p, photo, piece: n + 1 }));
  });
  const keys = entries.map((e) => e.key).join("|");
  useEffect(() => { onAvailable?.(keys ? keys.split("|") : []); }, [keys]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    entries.forEach((e) => {
      if (thumbs[e.key]) return;
      (e.p.index < 0 ? Promise.resolve(e.it.file as Blob) : cropBox(e.it.file, e.p.box, 240))
        .then((b) => { const u = URL.createObjectURL(b); urls.current.push(u); setThumbs((m) => ({ ...m, [e.key]: u })); }).catch(() => undefined);
    });
  }, [keys]); // eslint-disable-line react-hooks/exhaustive-deps
  async function use(e: (typeof entries)[number]) {
    const blob = e.p.index < 0 ? e.it.file : await cropBox(e.it.file, e.p.box);
    const file = blob instanceof File ? blob : new File([blob], `peca-${e.photo}-${e.piece}.${blob.type === "image/png" ? "png" : "jpg"}`, { type: blob.type });
    const preview = URL.createObjectURL(file); urls.current.push(preview);
    onPick({ key: e.key, file, preview, draftId: e.it.detection!.draftId, index: e.p.index, photo: e.photo, piece: e.piece,
      value: detectedPrefill(e.p, tax), hint: e.p.brandHint ?? null });
  }
  const local = ready.some((i) => i.detection!.source !== "ia");
  return (
    <section className="grid gap-2" aria-label={t("multiPiece.pecas_detectadas")}>
      <p className="font-medium">{t("multiPiece.pecas_detectadas")}</p>
      <p className="type-caption text-muted">{t("multiPiece.escolha_e_avance")}</p>
      {local && <p role="note" className="rounded-md bg-thread-soft p-3 type-body-sm" data-testid="local-reading-note">{t("multiPiece.leitura_local")}</p>}
      <ul className="grid gap-2 sm:grid-cols-2">
        {entries.map((e) => {
          const saved = savedKeys.includes(e.key), active = picked === e.key;
          return (
            <li key={e.key} className={cn("flex flex-wrap items-center gap-2 rounded border bg-surface p-2", active ? "border-ink" : "border-line-soft")} data-testid="detected-piece">
              {thumbs[e.key] ? <img src={thumbs[e.key]} alt="" className="h-14 w-14 shrink-0 rounded object-contain bg-surface-2" /> : <span className="h-14 w-14 shrink-0 rounded bg-surface-2" />}
              {/* o texto guarda uma largura mínima: sem espaço, o estado desce para a linha de baixo em vez de espremer o nome */}
              <div className="min-w-[6rem] flex-1" data-testid="detected-piece-text">
                <p className="type-body-sm font-medium truncate">{e.p.name || t("multiPiece.peca_n", { n: e.piece })}</p>
                <p className="type-caption text-muted">{t("multiPiece.foto_n", { n: e.photo })}{e.p.category ? ` · ${CATEGORY_LABEL[e.p.category] ?? label(e.p.category)}` : ""}</p>
              </div>
              {saved ? <span className="shrink-0 type-caption font-medium" data-testid="detected-piece-state">✓ {t("multiPiece.salva")}</span>
                : active ? <span className="shrink-0 type-caption font-medium" data-testid="detected-piece-state">{t("multiPiece.em_edicao")}</span>
                : <Button size="sm" className="shrink-0" onClick={() => void use(e)}>{t("multiPiece.usar_esta_peca")}</Button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
