"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Dialog } from "@/components/ui";

type T = (key: string, params?: Record<string, unknown>) => string;

/** O servidor chama de AGUARDANDO o desafio que espera os convidados; "PENDENTE" é o nome antigo, ainda aceito. */
export const isWaiting = (state: string) => state === "AGUARDANDO" || state === "PENDENTE";

/** Nome do modo e do estado na tela ("Solo", "Ativo"); código sem tradução aparece como veio. */
export function challengeLabel(t: T, kind: "mode" | "state", code: string): string {
  const key = `challenges.${kind}.${code}`;
  const text = t(key);
  return text === key ? code : text;
}

interface ProgressLike { value?: number; target?: number; label?: string | null; fraction?: number; progress?: { value: number; target: number; label?: string } }

/** Progresso da pessoa: o servidor manda `value`, `target` e `label` direto em `me` (a tela lia `me.progress`, que não vem). */
export function progressOf(me?: ProgressLike | null): { value: number; target: number; label: string } | null {
  const p = me?.progress ?? (me?.value != null && me?.target != null ? { value: me.value, target: me.target, label: me.label ?? undefined } : null);
  return p ? { value: p.value, target: p.target, label: p.label ?? "" } : null;
}

interface NoteLike { text?: string; content?: string; createdAt?: string; at?: string }

/** Recado do mural: o servidor manda `content` e `at`. */
export const noteText = (n: NoteLike) => n.text ?? n.content ?? "";
export const noteDate = (n: NoteLike) => n.createdAt ?? n.at;

/** "Cancelar" do criador: pede confirmação antes de parar o desafio (antes cancelava no primeiro clique). */
export function CancelChallenge({ onConfirm }: { onConfirm: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>{t("common.cancel")}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("challenges.id.cancelar_titulo")} role="alertdialog"
        footer={<>
          <Button onClick={() => setOpen(false)}>{t("challenges.id.manter")}</Button>
          <Button variant="danger" onClick={() => { setOpen(false); onConfirm(); }}>{t("challenges.id.cancelar_desafio")}</Button>
        </>}>
        <p className="type-body">{t("challenges.id.cancelar_texto")}</p>
      </Dialog>
    </>
  );
}
