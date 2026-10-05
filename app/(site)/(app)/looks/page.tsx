"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { qs } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { RequireAuth } from "@/components/app-shell";
import { PageHeader, Tabs } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { MyLooks, parseLookKind, type LookKind } from "@/components/looks/my-looks";
import { SavedLooks } from "@/components/looks/saved-looks";

type Tab = "mine" | "saved";
const parseTab = (v: string | null): Tab => (v === "saved" || v === "salvos" ? "saved" : "mine");

/**
 * Meus looks (domínio Looks): a GESTÃO dos looks — origem (IA · manual · remix), estado (publicados, rascunhos,
 * favoritos, arquivados) e ocasião — e os looks salvos de outras pessoas. O Lookbook virou vitrine (só o que foi
 * publicado) e aponta para cá. Aba e origem ficam na URL (?tab=saved, ?kind=ia|manual|remix).
 */
function Looks() {
  const { t } = useI18n();
  const sp = useSearchParams(); const router = useRouter();
  const [tab, setTab] = useState<Tab>(() => parseTab(sp.get("tab")));
  const [kind, setKind] = useState<LookKind>(() => parseLookKind(sp.get("kind")));
  useEffect(() => { setTab(parseTab(sp.get("tab"))); setKind(parseLookKind(sp.get("kind"))); }, [sp]);
  const go = (nextTab: Tab, nextKind: LookKind) => {
    setTab(nextTab); setKind(nextKind);
    router.replace(`/looks${qs({ tab: nextTab === "saved" ? nextTab : "", kind: nextTab === "mine" ? nextKind : "" })}`, { scroll: false });
  };
  return (
    <>
      <PageHeader title={t("looks.title")} lead={t("looks.lead")}
        actions={<Link href="/schemes/new" className="btn btn-primary"><FaiIcon id="NAV-03" size={24} decorative />{t("scheme.create")}</Link>} />
      <Tabs label={t("looks.title")} value={tab} onChange={(next) => go(next, kind)} tabs={[
        { id: "mine", label: t("looks.title") }, { id: "saved", label: t("lookbook.saved") },
      ]} />
      {tab === "mine" && <MyLooks kind={kind} onKind={(next) => go("mine", next)} />}
      {tab === "saved" && <SavedLooks />}
    </>
  );
}
export default function LooksPage() { return <RequireAuth><Suspense><Looks /></Suspense></RequireAuth>; }
