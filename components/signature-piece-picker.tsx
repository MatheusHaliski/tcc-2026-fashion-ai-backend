"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { api, type ApiError } from "@/lib/api/client";
import type { Page, PieceView } from "@/lib/api/types";
import { signaturePieceApi, type MySignaturePiece } from "@/lib/api/signature-piece";
import { defaultGarmentUrl } from "@/lib/catalog/default-garment";
import { pieceImageUrl } from "@/lib/pieces/piece-image";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";

/**
 * Exercício 18 · escolha da Peça Assinatura: só as peças do próprio guarda-roupa (as arquivadas não vêm na lista).
 * Antes de gravar, a tela diz quem vai ver a peça no perfil (a visibilidade é a da própria peça). A gravação leva a
 * revisão lida; se outra janela mudou a escolha, o servidor recusa e a tela recarrega em vez de sobrescrever.
 */
export function SignaturePiecePicker({ onChanged }: { onChanged?: (next: MySignaturePiece) => void }) {
  const { t } = useI18n();
  const mine = useApi<MySignaturePiece>((signal) => signaturePieceApi.mine(signal), []);
  const closet = useApi<Page<PieceView>>((signal) => api.get("/api/me/closet?size=100", { signal }), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const currentId = mine.data?.signaturePiece?.id ?? null;
  useEffect(() => { setSelected(currentId); }, [currentId]);

  if (mine.error || closet.error) return <ErrorState error={mine.error ?? closet.error} onRetry={() => { mine.reload(); closet.reload(); }} />;
  if (!mine.data || !closet.data) return <Skeleton className="h-40" />;
  const pieces = closet.data.items;
  if (!pieces.length) {
    return <EmptyState title={t("signaturePiece.sem_pecas")} action={<Link href="/pieces/new" className="btn btn-primary">{t("closet.addPiece")}</Link>} />;
  }
  const chosen = pieces.find((p) => p.id === selected) ?? null;
  const version = mine.data.version;
  async function run(action: () => Promise<MySignaturePiece>) {
    setBusy(true); setProblem(null);
    try { const next = await action(); mine.setData(next); onChanged?.(next); }
    catch (e) { setProblem((e as ApiError).message ?? t("signaturePiece.erro")); if ((e as ApiError).status === 409) mine.reload(); }
    finally { setBusy(false); }
  }
  return (
    <section aria-label={t("signaturePiece.titulo")} data-signature-picker>
      <p className="type-caption text-muted">{t("signaturePiece.dica")}</p>
      <div className="piece-picker mt-2" role="radiogroup" aria-label={t("signaturePiece.escolha")}>
        {pieces.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={selected === p.id} disabled={busy}
            className={`piece-picker-item ${selected === p.id ? "is-on" : ""}`} onClick={() => { setSelected(p.id); setProblem(null); }}>
            {p.defaultImage
              ? <img src={defaultGarmentUrl(p.category, p.subcategory, p.colorHex, p.color, "WHOLE")} alt="" loading="lazy" />
              : <img src={pieceImageUrl(p, 320)} alt="" loading="lazy" />}
            <span className="piece-picker-name">{p.name}</span>
          </button>
        ))}
      </div>
      {chosen && <p className="mt-2 rounded-md bg-thread-soft p-2 type-body-sm" role="note" data-visibility={chosen.visibility}>{t(`signaturePiece.visibilidade.${visibilityKey(chosen.visibility)}`, { name: chosen.name })}</p>}
      {problem && <p role="alert" className="mt-2 rounded-md bg-mark-soft p-2 type-body-sm">{problem}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" size="sm" loading={busy} disabled={!chosen || chosen.id === currentId} onClick={() => chosen && run(() => signaturePieceApi.choose(chosen.id, version))}>{t("signaturePiece.definir")}</Button>
        {currentId && <Button size="sm" disabled={busy} onClick={() => run(() => signaturePieceApi.clear(version))}>{t("signaturePiece.remover")}</Button>}
      </div>
    </section>
  );
}

const visibilityKey = (v: string) => (v === "PUBLIC" || v === "FOLLOWERS" ? v : "PRIVATE");
