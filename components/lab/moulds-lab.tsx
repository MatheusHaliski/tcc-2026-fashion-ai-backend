"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { ACERVO, ACERVO_SEM_3D, acervoLook } from "@/lib/tryon/acervo";
import { label, subcategoryLabel } from "@/lib/api/taxonomy";
import { resolveEnvironment } from "@/lib/tryon/fitting-room";
import { useI18n } from "@/lib/i18n/i18n";
import { PageHeader, Select, Skeleton } from "@/components/ui";

const Scene = dynamic(() => import("@/components/three/fitting-room-scene"), { ssr: false, loading: () => <Skeleton className="h-96" /> });
const ENVIRONMENT = resolveEnvironment([]);
/** Uses the SAME skin, rig and garment builders as the live fitting room. Never labels a missing mould as worn. */
export default function MouldsLab() {
  const { t } = useI18n(); const [subcategory, setSubcategory] = useState(ACERVO[0].subcategory);
  const [sex, setSex] = useState<"FEMININO" | "MASCULINO">("FEMININO");
  const p = ACERVO.find(p => p.subcategory === subcategory)!;
  return <>
    <PageHeader title={t("roomAssets.mouldTitle")} lead={t("roomAssets.mouldSubtitle")} />
    <div className="mb-3 flex flex-wrap gap-2"><Select aria-label={t("roomAssets.body")} value={sex} onChange={e => setSex(e.target.value as typeof sex)}><option value="FEMININO">{label("FEMININO")}</option><option value="MASCULINO">{label("MASCULINO")}</option></Select>
      <Select aria-label={t("roomAssets.block")} value={subcategory} onChange={e => setSubcategory(e.target.value)}>{ACERVO.map(p => <option key={p.subcategory} value={p.subcategory}>{subcategoryLabel(p.subcategory)}</option>)}</Select></div>
    <div className="h-[36rem]"><Scene avatar={null} sex={sex} pieces={[acervoLook(p)]} environment={ENVIRONMENT} /></div>
    <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">{ACERVO.map(p => <li key={p.subcategory}><button className="surface grid w-full gap-1 p-2" type="button" aria-pressed={p.subcategory === subcategory} onClick={() => setSubcategory(p.subcategory)}><img className="h-24 w-full object-contain" src={acervoLook(p).imageUrl ?? undefined} alt="" loading="lazy" /><span className="type-caption">{subcategoryLabel(p.subcategory)}</span></button></li>)}</ul>
    <p className="type-body-sm text-muted mt-4">{t("roomAssets.accessoriesPending", { n: ACERVO_SEM_3D.length })}</p>
  </>;
}
