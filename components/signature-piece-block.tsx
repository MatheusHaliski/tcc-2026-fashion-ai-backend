"use client";
import { useState } from "react";
import Link from "next/link";
import { Badge, Button, Dialog } from "@/components/ui";
import { mediaUrl } from "@/lib/api/client";
import { signaturePieceApi, type SignaturePiece } from "@/lib/api/signature-piece";
import { label, subcategoryLabel } from "@/lib/api/taxonomy";
import { defaultGarmentUrl } from "@/lib/catalog/default-garment";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { SignaturePiecePicker } from "@/components/signature-piece-picker";
import { SignaturePieceHistory } from "@/components/signature-piece-history";

/**
 * Exercício 18 · Peça Assinatura no perfil. Quem visita vê só o que o servidor autorizou (peça e perfil visíveis para
 * essa pessoa); sem peça autorizada, o bloco não aparece. O dono vê a própria escolha mesmo privada, com o aviso de
 * quem mais a vê, e daqui troca a peça ou abre o histórico.
 */
export function SignaturePieceBlock({ username, self, signedIn }: { username: string; self: boolean; signedIn: boolean }) {
  const { t } = useI18n();
  const { data, reload } = useApi<{ signaturePiece: SignaturePiece | null }>((signal) => signaturePieceApi.ofProfile(username, !signedIn, signal), [username, signedIn]);
  const [picking, setPicking] = useState(false);
  const [history, setHistory] = useState(false);
  const piece = data?.signaturePiece ?? null;
  if (!data || (!piece && !self)) return null;
  return (
    <section className="surface mb-3 flex flex-wrap items-center gap-3 p-3" aria-label={t("signaturePiece.titulo")} data-signature-piece={piece?.id ?? ""}>
      {piece && (
        <Link href={`/pieces/${piece.id}`} className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-surface-2" aria-label={piece.name}>
          <img src={piece.imageUrl ? mediaUrl(piece.imageUrl) : defaultGarmentUrl(piece.category, piece.subcategory, piece.colorHex, piece.color, "WHOLE")} alt="" className="h-full w-full object-cover" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <p className="label mb-0">{t("signaturePiece.titulo")}</p>
        {piece
          ? <><p className="type-body font-medium truncate">{piece.name}{self && piece.visibility && piece.visibility !== "PUBLIC" && <Badge tone="chalk" className="ml-2">{t(`signaturePiece.selo.${piece.visibility}`)}</Badge>}</p>
              <p className="type-caption text-muted truncate">{[subcategoryLabel(piece.subcategory), label(piece.color), piece.brandName].filter(Boolean).join(" · ")}</p></>
          : <p className="type-body-sm text-muted">{t("signaturePiece.nenhuma")}</p>}
      </div>
      {self && <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={piece ? "default" : "primary"} onClick={() => setPicking(true)}>{piece ? t("signaturePiece.trocar") : t("signaturePiece.escolher")}</Button>
        <Button size="sm" onClick={() => setHistory(true)}>{t("signaturePiece.historico")}</Button>
      </div>}
      {self && <Dialog open={picking} onClose={() => setPicking(false)} title={t("signaturePiece.titulo")} size="lg">{picking && <SignaturePiecePicker onChanged={() => { reload(); setPicking(false); }} />}</Dialog>}
      {self && <Dialog open={history} onClose={() => setHistory(false)} title={t("signaturePiece.historico")}>{history && <SignaturePieceHistory />}</Dialog>}
    </section>
  );
}
