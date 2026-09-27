"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { retryImport } from "@/lib/chunk-recovery";
import { api, mediaUrl } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { Button, Dialog, Skeleton, Switch, useToast } from "@/components/ui";
import { useWebGL, type Look3d } from "@/components/three/common";
import { Cube3dIcon } from "@/components/generate-3d";
import { tr, useI18n } from "@/lib/i18n/i18n";

const LookViewer = dynamic(() => retryImport(() => import("@/components/three/look-viewer")), { ssr: false, loading: () => <div className="grid h-full place-items-center type-caption text-muted">{tr("mannequinPhoto.vestindo_o_manequim")}</div> });

/** Peças que ganham a foto com manequim sozinhas (RF4). Inferior, calçado e acessório aparecem na foto do look (RF5). */
export const MANNEQUIN_PHOTO_CATEGORIES = new Set(["upper_piece", "full_body_piece"]);

/**
 * Foto com meu manequim (card Trello · RF4/RF5): a peça superior/de corpo inteiro — ou o look inteiro — vestindo o
 * manequim da pessoa, com o rosto 3D feito da foto de perfil. Sem foto de perfil, veste o manequim padrão masc./fem.
 * (nunca um manequim fantasma). A imagem é renderizada aqui (Three.js) e guardada no servidor.
 */
export function MannequinPhotoButton({ kind, id, title, current, onSaved }: { kind: "piece" | "scheme"; id: string; title: string; current?: string | null; onSaved: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Cube3dIcon />{current ? t("mannequinPhoto.refazer_foto_com_meu_manequim") : t("mannequinPhoto.foto_com_meu_manequim")}</Button>
      {open && <MannequinPhotoDialog kind={kind} id={id} title={title} current={current} onClose={(saved) => { setOpen(false); if (saved) onSaved(); }} />}
    </>
  );
}

export function MannequinPhotoDialog({ kind, id, title, current, onClose }: { kind: "piece" | "scheme"; id: string; title: string; current?: string | null; onClose: (saved: boolean) => void }) {
  const { t } = useI18n();
  const { me, refreshMe } = useAuth(); const toast = useToast(); const webgl = useWebGL();
  const [look, setLook] = useState<Look3d | null>(null); const [err, setErr] = useState<string | null>(null);
  const [asCover, setAsCover] = useState(kind === "scheme");
  const [busy, setBusy] = useState(false); const [preview, setPreview] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let alive = true;
    api.get<Look3d>(kind === "scheme" ? `/api/schemes/${id}/look3d` : `/api/pieces/${id}/look3d`).then((l) => { if (!alive) return; setLook(l); }).catch((e) => alive && setErr(e?.message ?? t("mannequinPhoto.nao_foi_possivel_montar_o")));
    return () => { alive = false; };
  }, [kind, id]);
  const lookWithFace = look;
  async function shoot() {
    const c = canvas.current; if (!c) return;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));   // o quadro atual, já renderizado
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.93));
    if (!blob) { toast.error(t("mannequinPhoto.nao_foi_possivel_capturar_a")); return; }
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", blob, "manequim.jpg");
      const r = await api.upload<{ url: string; face: string }>(kind === "scheme" ? `/api/schemes/${id}/mannequin-photo?asCover=${asCover}` : `/api/pieces/${id}/mannequin-photo`, fd);
      setPreview(r.url); toast.success(kind === "scheme" && asCover ? t("mannequinPhoto.foto_com_manequim_salva_e") : t("mannequinPhoto.foto_com_manequim_salva"));
      refreshMe().catch(() => undefined);
    } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  const m = look?.mannequin;
  return (
    <Dialog open onClose={() => onClose(!!preview)} size="lg" title={t("mannequinPhoto.foto_com_meu_manequim_2", { title })}>
      {err && <p className="type-body text-muted" role="alert">{err}</p>}
      {!look && !err && <Skeleton className="h-[440px]" />}
      {lookWithFace && (
        <div className="grid gap-4 md:grid-cols-[1fr_270px]">
          <div className="h-[460px] overflow-hidden rounded-lg border border-line-soft">
            {webgl === false ? <p className="grid h-full place-items-center p-4 text-center type-body text-muted">{t("mannequinPhoto.este_navegador_nao_tem_webgl")}</p>
              : preview ? <img src={mediaUrl(preview)} alt={t("mannequinPhoto.no_manequim", { title })} className="h-full w-full object-contain bg-surface-2" />
              : <LookViewer look={lookWithFace} still background="#ECE7DE" framing={kind === "piece" && lookWithFace.pieces.every((x) => x.slot === "upper" || x.slot === "outer_layer") ? "upper" : "full"} onCanvas={(c) => { canvas.current = c; }} />}
          </div>
          <div className="min-w-0">
            <p className="label">{t("common.manequim")}</p>
            <p className="type-body-sm">{m?.sex === "MASCULINO" ? t("common.masculino") : t("common.feminino")} · {m?.head === "AVATAR" ? t("mannequinPhoto.rosto_do_avatar") : t("mannequinPhoto.cabeca_neutra")}</p>
            {m?.head !== "AVATAR" && me?.user.profileType !== "MARCA" && <p className="mt-1 type-caption text-muted"><Link href="/avatar" className="underline">{t("mannequinPhoto.crie_o_avatar")}</Link></p>}
            {kind === "scheme" && !preview && <div className="mt-3"><Switch checked={asCover} onChange={setAsCover} label={t("mannequinPhoto.usar_como_foto_do_post")} /></div>}
            <p className="mt-3 type-caption text-muted">{t("mannequinPhoto.arraste_para_girar_antes_de", { value: kind === "scheme" ? t("mannequinPhoto.o_manequim_veste_todas_as") : t("mannequinPhoto.pecas_inferiores_calcados_e_acessorios") })}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!preview ? <Button variant="primary" loading={busy} disabled={webgl === false} onClick={shoot}>{t("mannequinPhoto.gerar_foto")}</Button> : <Button onClick={() => setPreview(null)}>{t("common.gerar_de_novo")}</Button>}
              {(current || preview) && <Button variant="ghost" onClick={async () => { try { await api.delete(kind === "scheme" ? `/api/schemes/${id}/mannequin-photo` : `/api/pieces/${id}/mannequin-photo`); setPreview(null); toast.success(t("mannequinPhoto.foto_removida")); onClose(true); } catch (e) { toast.fromError(e); } }}>{t("common.remover_foto")}</Button>}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
