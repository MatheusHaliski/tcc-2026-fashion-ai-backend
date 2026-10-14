"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Dialog } from "@/components/ui";
export function CreatorWelcome({ kind }: { kind: "piece" | "seal" | "studio" }) {
  const { user } = useAuth(); const { t } = useI18n(); const [open, setOpen] = useState(false);
  const key = `fai.creator.welcome.${kind}:${user?.id ?? "anon"}`;
  useEffect(() => { if (!user) return; try { setOpen(localStorage.getItem(key) !== "seen"); } catch { setOpen(true); } }, [key, !!user]);
  const close = () => { try { localStorage.setItem(key, "seen"); } catch {} setOpen(false); };
  return <><Button size="sm" onClick={() => setOpen(true)}>{t("creatorWelcome.help")}</Button><Dialog open={open} onClose={close} title={t(`creatorWelcome.${kind}.title`)} footer={<Button onClick={close}>{t("common.close")}</Button>}><p className="type-body">{t(`creatorWelcome.${kind}.text`)}</p></Dialog></>;
}
