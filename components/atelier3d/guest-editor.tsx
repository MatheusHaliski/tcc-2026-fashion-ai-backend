"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { Atelier3dEditor } from "./editor";
export function GuestEditor({ inviteId }: { inviteId: string }) {
  const { t } = useI18n();
  const [token, setToken] = useState<string | null>(null),
    [ready, setReady] = useState(false);
  useEffect(() => {
    const key = `atelier-guest:${inviteId}`;
    try {
      const fragment = location.hash.slice(1),
        saved = sessionStorage.getItem(key);
      if (fragment && /^[A-Za-z0-9_-]{43}$/.test(fragment)) {
        sessionStorage.setItem(key, fragment);
        setToken(fragment);
        history.replaceState(null, "", location.pathname + location.search);
      } else setToken(saved);
    } catch {
      setToken(null);
    }
    setReady(true);
  }, [inviteId]);
  if (!ready) return <p role="status">{t("common.loading")}</p>;
  if (!token) return <p role="alert">{t("atelier3d.guests.missingToken")}</p>;
  return (
    <>
      <p>{t("atelier3d.guests.session")}</p>
      <Atelier3dEditor guestId={inviteId} token={token} />
    </>
  );
}
