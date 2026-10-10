"use client";
import type { ReactNode } from "react";
import { Button, Input } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { useI18n } from "@/lib/i18n/i18n";

/** Anatomia compartilhada pelas conversas do Copilot e pelo criador de políticas de selo. */
export function CopilotChatMessage({ role, children }: { role: "user" | "copilot"; children: ReactNode }) {
  return <div className={`max-w-[85%] rounded-lg p-3 ${role === "user" ? "ml-auto bg-ink text-surface" : "bg-surface-2"}`}>{children}</div>;
}

export function CopilotChatComposer({ value, onChange, onSend, busy, placeholder, label, maxLength = 6000 }: {
  value: string; onChange: (value: string) => void; onSend: (message: string) => void; busy: boolean;
  placeholder: string; label?: string; maxLength?: number;
}) {
  const { t } = useI18n();
  return <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (!busy && value.trim()) onSend(value.trim()); }}>
    <Input aria-label={label ?? t("copilot.mensagem")} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} maxLength={maxLength} disabled={busy} />
    <Button type="submit" variant="primary" loading={busy} disabled={busy || !value.trim()}><FaiIcon id="ACT-13" size={24} decorative />{t("auth.send")}</Button>
  </form>;
}
