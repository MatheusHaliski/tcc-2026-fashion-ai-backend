"use client";
import { useEffect, useState } from "react";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useAuth } from "@/lib/auth/session";
import { label } from "@/lib/api/taxonomy";
import { Badge, Button } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { HAND_SLOTS, type HandPiece, type HandSlot, type MirrorPhase } from "@/lib/room3d/mirror-session";

/**
 * Painel da prova no espelho, ao lado da cena do quarto (RF27 ↔ RF28): no quarto, a ajuda de primeiro uso e o botão de
 * abrir à mão; chegando/saindo, só o estado; na prova, as "roupas em mãos" por lugar do corpo (parte de cima, parte de
 * baixo, calçado e acessório) com miniatura, nome, categoria e o estado do asset (modelo 3D, molde 3D, só 2D, pendente),
 * e as ações Vestir (peça na mão), Tirar (vestida), Trocar (guarda-roupa) e Voltar ao quarto. Mensagens descrevem o que
 * aconteceu, sem opinar sobre a roupa.
 */
export interface MirrorHandsProps {
  phase: MirrorPhase; hands: Record<HandSlot, HandPiece[]>; busy: HandSlot | null; error: string | null;
  changed?: { slot: HandSlot; name: string } | null; reduced?: boolean;
  onWear: (p: HandPiece) => void; onRemove: (p: HandPiece) => void; onSwap: (slot: HandSlot) => void; onBack: () => void; onOpen: () => void;
}

/** Ajuda de primeiro uso: aparece até a pessoa pedir "Não mostrar novamente" (por usuário, neste aparelho). */
export function useMirrorHelp() {
  const { user } = useAuth(); const key = `fai:room-mirror-help:v1:${user?.id ?? "local"}`;
  const [hidden, setHidden] = useState(true);                      // escondida até ler o storage: não pisca
  useEffect(() => { try { setHidden(localStorage.getItem(key) === "hidden"); } catch { setHidden(false); } }, [key]);
  const hide = () => { try { localStorage.setItem(key, "hidden"); } catch { /* sem storage: só nesta visita */ } setHidden(true); };
  return { hidden, hide };
}

export function MirrorHands({ phase, hands, busy, error, changed, reduced, onWear, onRemove, onSwap, onBack, onOpen }: MirrorHandsProps) {
  const { t } = useI18n(); const help = useMirrorHelp();
  const slotName = (s: HandSlot) => t(`room.mirror.slot.${s}`);
  if (phase === "room") {
    return (
      <div className="mirror-hands is-room" data-phase={phase}>
        {!help.hidden && (
          <div className="mirror-hands-help" role="note">
            <p className="font-semibold">{t("room.mirror.help")}</p>
            <p className="type-caption text-muted">{t("room.mirror.help_more")}</p>
            <Button size="sm" variant="ghost" onClick={help.hide}>{t("room.mirror.dont_show")}</Button>
          </div>
        )}
        <Button size="sm" onClick={onOpen}><FaiIcon id="ACT-32" size={20} decorative />{t("room.mirror.open")}</Button>
      </div>
    );
  }
  if (phase === "approach" || phase === "exit") {
    return <p className="mirror-hands is-transition" role="status" data-phase={phase}>{t(phase === "approach" ? "room.mirror.approach" : "room.mirror.exit")}</p>;
  }
  return (
    <section className="mirror-hands is-tryon" data-phase={phase} data-reduced={reduced ? "true" : undefined} aria-label={t("room.mirror.hands")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{t("room.mirror.hands")}</h3>
        <Button size="sm" onClick={onBack}>{t("room.mirror.back")}</Button>
      </div>
      {HAND_SLOTS.map((slot) => (
        <div key={slot} className="mirror-hands-slot">
          <div className="flex items-center justify-between gap-2">
            <p className="type-caption font-medium uppercase">{slotName(slot)}</p>
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => onSwap(slot)} aria-label={`${t("room.mirror.swap")} · ${slotName(slot)}`}>{t("room.mirror.swap")}</Button>
          </div>
          {busy === slot && <p className="type-caption" role="status">{t("room.mirror.changing", { slot: slotName(slot) })}</p>}
          {hands[slot].length === 0 && busy !== slot && <p className="type-caption text-muted">{t("room.mirror.empty_slot")}</p>}
          <ul className="grid gap-1">
            {hands[slot].map((p) => (
              <li key={p.id} className="mirror-hands-piece" data-worn={p.worn ? "true" : "false"}>
                <img src={mediaUrl(p.thumbnailUrl ?? p.imageUrl)} alt="" className="h-10 w-10 shrink-0 rounded bg-surface-2 object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="type-body-sm font-medium truncate">{p.name}</p>
                  <p className="type-caption text-muted truncate">{p.category ? label(p.category) : "—"} · {p.worn ? t("room.mirror.worn") : t("room.mirror.in_hand")}</p>
                  <Badge tone={p.asset === "PENDING" ? "mark" : p.asset === "IMAGE_2D" ? "chalk" : undefined}>{t(`room.mirror.asset.${p.asset}`)}</Badge>
                </div>
                {p.worn
                  ? <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => onRemove(p)} aria-label={`${t("room.mirror.remove")} · ${p.name}`}>{t("room.mirror.remove")}</Button>
                  : <Button size="sm" variant="primary" disabled={busy !== null} onClick={() => onWear(p)} aria-label={`${t("room.mirror.wear")} · ${p.name}`}>{t("room.mirror.wear")}</Button>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {changed && !busy && <p className="type-body-sm" role="status">{t("room.mirror.changed", { name: changed.name })}</p>}
      {error !== null && !busy && <p className="type-caption error-text" role="alert">{t("room.mirror.failed", { reason: error || t("common.erro") })}</p>}
    </section>
  );
}
