"use client";

import { useI18n } from "@/lib/i18n/i18n";
import type { AccessibilityInfo } from "@/lib/catalog/accessibility";
import { Badge } from "@/components/ui";

/** Ficha de acessibilidade de uso em linguagem concreta; declarado ≠ revisado ≠ sem informação; nada clínico. */
export function AccessibilityFacts({ info }: { info: AccessibilityInfo }) {
  const { t } = useI18n();
  return <div className="grid gap-1">
    <span className="flex flex-wrap items-center gap-2"><Badge tone={info.status === "REVIEWED" ? "chalk" : info.status === "DECLARED" ? "thread" : "mark"}>{t(`accessibility.status.${info.status}`)}</Badge>{info.declarationSource && <span className="type-caption text-muted">{t(`accessibility.source.${info.declarationSource}`)}</span>}</span>
    {info.status === "UNKNOWN" ? <p className="type-body-sm text-muted">{t("accessibility.unknownProduct")}</p>
      : info.descriptionKeys.length === 0 ? <p className="type-body-sm text-muted">{t("accessibility.nothingDeclared")}</p>
      : <ul className="flex flex-wrap gap-2 type-body-sm">{info.descriptionKeys.map((key) => <li key={key} className="chip">{t(`accessibility.desc.${key}`)}</li>)}</ul>}
    {info.notes && <p className="type-caption text-muted">{info.notes}</p>}
    <p className="type-caption text-muted">{t("accessibility.noClinicalClaim")}</p>
  </div>;
}
