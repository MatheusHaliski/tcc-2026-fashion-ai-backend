"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/session";
import { api } from "@/lib/api/client";
import type { SchemeView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { ActionMenu, Button, Dialog, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { useRemix } from "@/components/interactions";
import { Generate3DDialog } from "@/components/generate-3d";

/**
 * Menu ⋯ do post: salvar mora na linha de ações; aqui ficam as opções contextuais — remixar (quem não é o autor; no
 * look ampliado ele já está na linha de interações), ver o look no manequim 3D e, para quem publicou, editar e excluir.
 */
export function PostMenu({ scheme, remixInRow }: { scheme: SchemeView; remixInRow?: boolean }) {
  const { t } = useI18n(); const { user } = useAuth(); const toast = useToast(); const router = useRouter();
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false); const [view3d, setView3d] = useState(false);
  const { remix } = useRemix("SCHEME", scheme.id);
  const owner = !!user && (scheme.viewer?.canEdit || scheme.owner?.id === user.id);
  async function remove() {
    setBusy(true);
    try { await api.delete(`/api/schemes/${scheme.id}`); toast.success(t("schemeCard.excluido")); setConfirm(false); if (window.location.pathname.startsWith("/schemes/")) router.push("/lookbook"); else window.location.reload(); }
    catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  return (
    <>
      <ActionMenu className="c-menu" label={t("anatomy.menu.label")} items={[
        { label: t("interactions.remixAction"), onSelect: remix, hidden: owner || remixInRow, icon: <FaiIcon id="SOC-04" size={20} variant="glyph" decorative /> },
        { label: t("pieceDetail.manequim_3d"), onSelect: () => setView3d(true), icon: <FaiIcon id="ACT-20" size={20} variant="glyph" decorative /> },
        { label: t("anatomy.menu.edit"), href: `/schemes/${scheme.id}/edit`, hidden: !owner, icon: <FaiIcon id="SOC-11" size={20} variant="glyph" decorative /> },
        { label: t("common.delete"), onSelect: () => setConfirm(true), hidden: !owner, danger: true },
      ]} />
      {view3d && <Generate3DDialog targets={[{ kind: "scheme", id: scheme.id, title: scheme.title }]} onClose={() => setView3d(false)} />}
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={t("schemeCard.excluir_titulo")}
        footer={<><Button onClick={() => setConfirm(false)}>{t("common.cancel")}</Button><Button variant="danger" loading={busy} onClick={remove}>{t("common.delete")}</Button></>}>
        <p className="type-body">{t("schemeCard.excluir_texto")}</p>
      </Dialog>
    </>
  );
}
