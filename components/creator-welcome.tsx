"use client";
import { PieceCreationGuide } from "@/components/piece-creation-guide";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Dialog } from "@/components/ui";
const WelcomeSuppressed = createContext(false);

export function SuppressCreatorWelcome({ children, active = true }: { children: ReactNode; active?: boolean }) {
  return <WelcomeSuppressed.Provider value={active}>{children}</WelcomeSuppressed.Provider>;
}

export function CreatorWelcome({ kind, onEntry = false }: { kind: "piece" | "scheme" | "seal" | "studio"; onEntry?: boolean }) {
  const { user } = useAuth(); const { t } = useI18n(); const [open, setOpen] = useState(false);
  const suppressed = useContext(WelcomeSuppressed);
  const key = `fai.creator.welcome.${kind}:${user?.id ?? "anon"}`;
  useEffect(() => { if (!user || suppressed) return; if (onEntry) { setOpen(true); return; } try { setOpen(localStorage.getItem(key) !== "seen"); } catch { setOpen(true); } }, [key, !!user, onEntry, suppressed]);
  const close = () => { if (!onEntry) { try { localStorage.setItem(key, "seen"); } catch {} } setOpen(false); };
  if (suppressed) return null;
  if(kind === "piece") return <>{!onEntry && <Button size="sm" onClick={()=>setOpen(true)}>{t("creatorWelcome.help")}</Button>}<PieceCreationGuide open={open} onClose={close}/></>;
  return <>{!onEntry && <Button size="sm" onClick={() => setOpen(true)}>{t("creatorWelcome.help")}</Button>}<Dialog open={open} onClose={close} title={t(`creatorWelcome.${kind}.title`)} footer={<Button onClick={close}>{t("common.close")}</Button>}><p className="type-body">{t(`creatorWelcome.${kind}.text`)}</p></Dialog></>;
}
