"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { useAuth } from "@/lib/auth/session";
import { Button } from "@/components/ui";
import type { HandSlot, MirrorPhase } from "@/lib/room3d/mirror-session";

/**
 * Estado da prova no espelho, no painel ao lado da cena do quarto (RF27 ↔ RF28): no quarto, a ajuda de primeiro uso;
 * chegando/saindo, só o estado; na prova, "Voltar ao quarto" (que caminha para longe do espelho) e o que aconteceu na
 * última troca. As roupas em mãos não se repetem aqui: ficam nas células "Partes do look" do painel do Espelho e na folha
 * de cada parte (Vestir, Tirar, Tirar da lista, trocar pelo guarda-roupa). Mensagens descrevem, sem opinar sobre a roupa.
 */
export interface MirrorHandsProps {
  phase: MirrorPhase; busy: HandSlot | null; error: string | null;
  changed?: { slot: HandSlot; name: string } | null; reduced?: boolean;
  /** caminhada em andamento: o aviso fica na cena; saindo andando, a prova ainda aberta já diz "Saindo do espelho…" */
  walking?: "mirror" | "away" | null;
  onBack: () => void;
}

/** Ajuda de primeiro uso: aparece até a pessoa pedir "Não mostrar novamente" (por usuário, neste aparelho). */
export function useMirrorHelp() {
  const { user } = useAuth(); const key = `fai:room-mirror-help:v1:${user?.id ?? "local"}`;
  const [hidden, setHidden] = useState(true);                      // escondida até ler o storage: não pisca
  useEffect(() => { try { setHidden(localStorage.getItem(key) === "hidden"); } catch { setHidden(false); } }, [key]);
  const hide = () => { try { localStorage.setItem(key, "hidden"); } catch { /* sem storage: só nesta visita */ } setHidden(true); };
  return { hidden, hide };
}

export function MirrorHands({ phase, busy, error, changed, reduced, walking, onBack }: MirrorHandsProps) {
  const { t } = useI18n(); const help = useMirrorHelp();
  if (phase === "room") {
    if (help.hidden) return null;
    return (
      <div className="mirror-hands is-room" data-phase={phase}>
        <div className="mirror-hands-help" role="note">
          <p className="font-semibold">{t("room.mirror.help")}</p>
          <p className="type-caption text-muted">{t("room.mirror.help_more")}</p>
          <Button size="sm" variant="ghost" onClick={help.hide}>{t("room.mirror.dont_show")}</Button>
        </div>
      </div>
    );
  }
  if (phase === "approach" || phase === "exit") {
    if (phase === "exit" && walking === "away") return null;      // a cena já avisa "Saindo do espelho…"
    return <p className="mirror-hands is-transition" role="status" data-phase={phase}>{t(phase === "approach" ? "room.mirror.approach" : "room.mirror.exit")}</p>;
  }
  const slotName = (s: HandSlot) => t(`room.mirror.slot.${s}`);
  return (
    <section className="mirror-hands is-tryon" data-phase={phase} data-reduced={reduced ? "true" : undefined} aria-label={t("room.mirror.title")}>
      <div className="mirror-hands-bar">
        <p className="type-caption text-muted">{t(walking === "away" ? "room.mirror.exit" : "room.mirror.hands_hint")}</p>
        <Button size="sm" onClick={onBack}>{t("room.mirror.back")}</Button>
      </div>
      {busy && <p className="type-caption" role="status">{t("room.mirror.changing", { slot: slotName(busy) })}</p>}
      {changed && !busy && <p className="type-body-sm" role="status">{t("room.mirror.changed", { name: changed.name })}</p>}
      {error !== null && !busy && <p className="type-caption error-text" role="alert">{t("room.mirror.failed", { reason: error || t("common.erro") })}</p>}
    </section>
  );
}
