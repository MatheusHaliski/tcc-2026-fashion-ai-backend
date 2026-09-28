"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";

/** 404 do app: dentro do layout do app (tema, textos), com saída para o feed. */
export default function NotFound() {
  const { t } = useI18n();
  return (
    <main role="alert" className="surface mx-auto mt-10 max-w-lg p-6 text-center">
      <p className="type-label text-mark">404</p>
      <h1 className="type-h2 mt-1">{t("errors.notFoundTitle")}</h1>
      <p className="type-body mt-2 text-muted">{t("errors.notFoundHint")}</p>
      <Link href="/feed" className="btn mt-4">{t("common.voltar_ao_feed")}</Link>
    </main>
  );
}
