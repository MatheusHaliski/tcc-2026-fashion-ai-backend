"use client";
import { useRef, useState, type ReactNode } from "react";
import { Button, Overlay, useFocusTrap } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";

/**
 * Prévia do card da peça em modal, no mesmo formato do detalhe do feed/closet (.dialog.dialog-card): sem cabeçalho,
 * sem margem branca — o card ocupa o modal inteiro e a borda do card é a borda do modal. O título fica só como nome
 * acessível do diálogo. Fecha com Esc, clique fora ou o ✕ no canto superior direito do card (o canto esquerdo é do
 * botão Feed/Ampliado). {@code wide}: o Ampliado usa a largura do detalhe da peça.
 */
export function PieceCardPreviewDialog({ title, wide = false, children }: { title: string; wide?: boolean; children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open, () => setOpen(false));
  return (
    <>
      <Button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>{t("pieces.new.view_card_preview")}</Button>
      {open && (
        <Overlay>
          <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
            <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`dialog dialog-card pae-card-dialog ${wide ? "is-piece" : ""}`}>
              <button type="button" className="pae-card-dialog-close" aria-label={t("common.fechar")} title={t("common.fechar")} onClick={() => setOpen(false)}>✕</button>
              {children}
            </div>
          </div>
        </Overlay>
      )}
    </>
  );
}
