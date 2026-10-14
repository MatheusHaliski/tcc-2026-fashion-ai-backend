"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";

export function LegalBackLink() {
  const { t } = useI18n();
  return <Link className="font-semibold text-ink underline" href="/register">{t("legal.backToRegister")}</Link>;
}
