"use client";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import type { BgConfig } from "@/components/background-studio";
import { AuraMetamorphose } from "@/components/hype/aura-metamorphose";
import { ArtVideo } from "@/components/card-art";
import { Button } from "@/components/ui";

interface OwnedArt { code: string; name: string; config: Pick<BgConfig,"auraMetamorphose"|"auraMetamorphosePreset"|"compositionPreset">; source: string; expiresAt?: string | null; }
export function MetamorphoseInventory({ value, onChange }: { value: BgConfig; onChange: (p: Partial<BgConfig>) => void }) {
 const {t}=useI18n();
 const {data,loading,error,reload}=useApi<OwnedArt[]>(signal=>api.get("/api/me/arts/metamorphoses",{signal}),[]);
 const arts=(data??[]).filter(a=>!a.expiresAt||Date.parse(a.expiresAt)>Date.now());
 return <section aria-label={t("metamorphoseInventory.title")}>
  <p className="type-body-sm">{t("metamorphoseInventory.help")}</p>
  <Button onClick={()=>onChange({auraMetamorphose:"OFF",auraMetamorphosePreset:null,auraEntitlementCode:null,...(value.compositionPreset?.family==="METAMORPHOSE"?{compositionPreset:null}:{})})}>{t("fashionAura.remove")}</Button>
  {loading&&<p role="status">{t("fashionAura.loading")}</p>}
  {error&&<div role="alert"><p>{t("fashionAura.error")}</p><Button onClick={reload}>{t("sealHypeIssuer.retry")}</Button></div>}
  {!loading&&!error&&!arts.length&&<p role="status">{t("metamorphoseInventory.empty")}</p>}
  {!loading&&!error&&<div className="opt-grid">{arts.map(art=><button key={art.code} type="button" className="opt-tile" aria-pressed={value.auraEntitlementCode===art.code}
   onClick={()=>onChange({auraMetamorphose:art.config.auraMetamorphose??"OFF",auraMetamorphosePreset:art.config.auraMetamorphosePreset??null,compositionPreset:art.config.compositionPreset??null,auraEntitlementCode:art.code,aura:null,aiArt:null,uploadUrl:null})}>
   <span className="opt-thumb relative overflow-hidden">{art.config.compositionPreset?.video?<ArtVideo src={art.config.compositionPreset.video} poster={art.config.compositionPreset.image}/>:art.config.compositionPreset?<img src={art.config.compositionPreset.image} alt=""/>:<AuraMetamorphose mode={art.config.auraMetamorphose} presetId={art.config.auraMetamorphosePreset} preview/>}</span>
   <span className="opt-name">{art.name}</span>
  </button>)}</div>}
  <Link href="/arts-store">{t("metamorphoseInventory.store")}</Link>
 </section>;
}
