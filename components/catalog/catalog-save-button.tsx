"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { useAuth } from "@/lib/auth/session";
import { useSavedCatalogProduct } from "@/lib/catalog/use-saved-catalog-product";
import { useI18n } from "@/lib/i18n/i18n";

export function CatalogSaveButton({ id, onChange }: { id: string; onChange?: (saved: boolean) => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { saved, toggle } = useSavedCatalogProduct(id);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const next = await toggle();
      if (next !== undefined) onChange?.(next);
    } catch (error) {
      toast.fromError(error);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <Button size="sm" aria-pressed={saved} loading={busy} onClick={() => void save()}>
      <FaiIcon id="SOC-06" size={20} active={saved} decorative />
      {t(saved ? "interactions.saved" : "interactions.save")}
    </Button>
  );
}
