"use client";
/**
 * Vagas de um Desafio de Montagem, em grade (nunca se sobrepõem, do celular ao computador): cada vaga é um botão com o
 * número, o que aceita, a carta posta e a sintonia que o servidor deu. Tocar põe a vaga em destaque (a bandeja mostra
 * as cartas dela); a carta posta pode ser arrastada para outra vaga (troca) ou para a bandeja (tira).
 */
import type { PointerEvent } from "react";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import type { CbcSlot } from "@/lib/flair/cbc";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { cn } from "@/components/ui";

interface Props {
  slots: CbcSlot[];
  placed: Record<string, FlairCollectionCard | undefined>;
  /** sintonia por vaga (0 a 3), só a que o servidor julgou para as cartas de agora */
  sintonia: Record<string, number> | null;
  selecionada?: string;
  labelOf: (slot: CbcSlot) => string;
  onVaga?: (slot: string) => void;
  pegar?: (cardId: string, origem: string | null) => (e: PointerEvent<HTMLElement>) => void;
}

export function CbcVagas({ slots, placed, sintonia, selecionada, labelOf, onVaga, pegar }: Props) {
  const { t } = useI18n();
  return (
    <ol className="cbv-slots" aria-label={t("cbc.slots_label")}>
      {slots.map((s, i) => {
        const c = placed[s.key];
        const n = c ? sintonia?.[s.key] : undefined;
        const label = labelOf(s);
        const pos = t(`cbc.position.${s.position}`);
        const state = !c ? t("cbc.slot.empty") : n == null ? t("flair.mesa.checking", { name: c.name }) : t("cbc.slot.filled", { name: c.name, sintonia: n });
        return (
          <li key={s.key}>
            <button type="button" data-slot={s.key} aria-label={`${label} · ${pos} · ${state}`} aria-current={selecionada === s.key || undefined}
              className={cn("cbv-slot", c && "is-filled", selecionada === s.key && "is-selected", n != null && n >= 2 && "is-lit")}
              onClick={() => onVaga?.(s.key)} disabled={!onVaga}>
              <span className="cbv-n" aria-hidden>{i + 1}</span>
              {c ? (
                <span key={c.id} className={cn("cbv-card", `tier-${c.tier.toLowerCase()}`)} onPointerDown={pegar ? pegar(c.id, s.key) : undefined}>
                  {c.imageUrl ? <img src={mediaUrl(c.imageUrl)} alt="" loading="lazy" decoding="async" draggable={false} /> : null}
                  <b className="tabular">{c.ovr}</b>
                </span>
              ) : <span className="cbv-empty" aria-hidden>+</span>}
              <span className="cbv-label">{label}</span>
              <span className="cbv-pos">{c ? c.name : pos}</span>
              {c && <span className="cbv-sync" aria-hidden>{n == null ? "···" : `${"●".repeat(n)}${"○".repeat(Math.max(0, 3 - n))}`}</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
