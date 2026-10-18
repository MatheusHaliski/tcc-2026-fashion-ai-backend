"use client";
import { useState } from "react";
import { Button, Dialog } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";

/** Derived markers and issuer grants have different acquisition and expiry rules. */
export function HypeSealHelp() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return <><Button size="sm" variant="ghost" onClick={() => setOpen(true)}>{t("sealHypeHelp.open")}</Button>
    <Dialog open={open} onClose={() => setOpen(false)} title={t("sealHypeHelp.title")} footer={<Button onClick={() => setOpen(false)}>{t("common.close")}</Button>}>
      <div className="grid gap-4">
        <section><h3 className="type-h3">{t("sealHypeHelp.automatic.title")}</h3><p className="type-body mt-2">{t("sealHypeHelp.automatic.text")}</p><p className="type-body mt-2">{t("sealHypeHelp.automatic.expiry")}</p></section>
        <section><h3 className="type-h3">{t("sealHypeHelp.issuer.title")}</h3><p className="type-body mt-2">{t("sealHypeHelp.issuer.text")}</p><p className="type-body mt-2">{t("sealHypeHelp.issuer.expiry")}</p></section>
        <p className="type-body text-muted">{t("sealHypeHelp.freshness")}</p>
      </div>
    </Dialog>
  </>;
}
