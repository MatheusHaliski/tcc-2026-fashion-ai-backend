"use client";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { Button, useToast } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { FaiNetworkPicker } from "@/components/flair/network/fai-network-picker";

interface InviteResult { invited: string[]; skipped: { username: string; reason: string }[] }

/**
 * Multiplayer assíncrono: convida até 5 pessoas da rede FAI para o mesmo modo (POST /api/flair/modes/invites). Nos
 * modos contra a IA, leva o placar a superar (`target`); nos confrontos diretos é um convite para jogar com você.
 */
export function ChallengeNetwork({ mode, target }: { mode: string; target?: number | null }) {
  const { t } = useI18n(); const toast = useToast();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    try {
      const r = await api.post<InviteResult>("/api/flair/modes/invites", { mode, usernames: people, target: target ?? null });
      if (r.invited.length) toast.success(t("flair.arena.convites_enviados", { n: r.invited.length }));
      if (r.skipped.length) toast.error(t("flair.arena.convites_pulados", { users: r.skipped.map((s) => `@${s.username}`).join(", ") }));
      setPeople([]); setOpen(false);
    } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  if (!open) return <Button size="sm" onClick={() => setOpen(true)}>{target != null ? t("flair.arena.desafiar_placar", { n: target }) : t("flair.arena.convidar_rede")}</Button>;
  return (
    <div className="surface p-3 grid gap-2">
      <FaiNetworkPicker id={`invite-${mode}`} label={t("flair.arena.quem_convidar")} value={people} onChange={setPeople} max={5} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" loading={busy} disabled={people.length === 0} onClick={send}>{t("flair.arena.enviar_convites")}</Button>
        <Button size="sm" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
      </div>
    </div>
  );
}
