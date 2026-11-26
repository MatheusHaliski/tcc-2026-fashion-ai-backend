"use client";
import { useState, type ReactNode } from "react";
import { Button, Dialog } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";

export function PiecePreviewDialog({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>{t("pieces.new.view_card_preview")}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title}>
        {children}
      </Dialog>
    </>
  );
}
