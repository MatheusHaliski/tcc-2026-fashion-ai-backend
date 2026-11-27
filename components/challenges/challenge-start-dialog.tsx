"use client";
import { challengeLabel } from "@/components/challenges/challenge-detail-parts";
import { useState } from "react";
import { Button, Chip, Dialog } from "@/components/ui";
import { EscolherAdversario } from "@/components/flair/multi/escolher-adversario";
import { FaiIcon } from "@/components/fai-icon";
import { PiecePicker } from "@/components/pieces/piece-picker";
import type { Adversario } from "@/lib/flair/multi/types";
import { useI18n } from "@/lib/i18n/i18n";

export const MODE_ICON: Record<string, string> = { SOLO: "ACT-44", EQUIPE: "ACT-45", DUELO: "ACT-46", GRUPO: "ACT-45" };

/** Desafios cuja regra pede um conjunto fechado de peças do guarda-roupa (o servidor exige exatamente esse número). */
export const CHALLENGE_PIECE_COUNT: Record<string, number> = { TEN_X_TEN: 10, CAPSULE_SEASON: 33 };

export interface ChallengeStart {
  code: string;
  mode: string;
  params: Record<string, unknown>;
  invitees: string[];
}

/**
 * Janela "Começar" de um desafio: modo, convidados (busca na rede FAI) e, quando a regra pede (10×10, Temporada cápsula), a escolha das
 * peças. "Começar" só liga com o número exato de peças — o pedido nunca sai sem elas.
 */
export function ChallengeStartDialog({ template, onClose, onStart }: {
  template: { code: string; name: string; rule: string; modes: string[] };
  onClose: () => void;
  onStart: (start: ChallengeStart) => Promise<void> | void;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState(template.modes[0]);
  // convidados pela busca na rede FAI (nunca por texto digitado); a API continua recebendo ids
  const [invitees, setInvitees] = useState<Adversario[]>([]);
  const [pieceIds, setPieceIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const needed = CHALLENGE_PIECE_COUNT[template.code] ?? 0;
  const ready = pieceIds.length === needed;
  async function start() {
    setBusy(true);
    try {
      await onStart({
        code: template.code,
        mode,
        params: needed ? { piece_ids: pieceIds } : {},
        invitees: invitees.map((a) => a.id),
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onClose={onClose} title={template.name} size={needed ? "lg" : undefined}
      footer={<Button variant="primary" onClick={start} disabled={!ready} loading={busy}>{t("challenges.comecar")}</Button>}>
      <p className="type-body mb-3">{template.rule}</p>
      <p className="label">{t("challenges.modo")}</p>
      <div className="mb-3 flex gap-1.5">
        {template.modes.map((m) => (
          <Chip key={m} active={mode === m} onClick={() => setMode(m)}><FaiIcon id={MODE_ICON[m] ?? "ACT-43"} size={24} decorative />{challengeLabel(t, "mode", m)}</Chip>
        ))}
      </div>
      {mode !== "SOLO" && (
        <EscolherAdversario label={t("challenges.convidar_da_rede")} escolhidas={invitees} onChange={setInvitees} multiplo />
      )}
      {needed > 0 && <PiecePicker value={pieceIds} onChange={setPieceIds} total={needed} label={t("challenges.escolha_pecas", { total: needed })} />}
      {needed > 0 && !ready && <p className="type-caption text-muted mt-2" role="note">{t("challenges.faltam_pecas", { missing: needed - pieceIds.length })}</p>}
    </Dialog>
  );
}
