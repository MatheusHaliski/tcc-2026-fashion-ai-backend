"use client";

import Link from "next/link";
import { RequireAuth } from "@/components/app-shell";
import { FittingAppointments } from "@/components/try-on/fitting-appointments";
import { PageHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";

export default function FittingAppointmentsPage() {
  const { t } = useI18n();
  return <RequireAuth><PageHeader title={t("fitting.title")} lead={t("fitting.lead")} kicker={t("nav.tryon")} actions={<Link href="/try-on" className="btn">{t("fitting.backToRoom")}</Link>} /><FittingAppointments /></RequireAuth>;
}
