"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";

/** Evento da janela: algo mudou nas notificações (lidas, apagadas) e o sino do topo deve reler o número. */
export const NOTIFICATIONS_CHANGED = "fai:notifications-changed";

/** Avisa a casca do app de que o número de não lidas mudou (a página de notificações chama ao marcar como lida). */
export function notifyNotificationsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}

/**
 * Número de notificações não lidas do sino do topo: lê ao entrar, a cada troca de página, a cada minuto e quando a
 * página de notificações avisa que algo foi lido (antes o sino mostrava o número antigo até recarregar).
 */
export function useUnreadCount(enabled: boolean, pathname: string | null): number {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () => {
      api.get<{ unread: number }>("/api/notifications/unread-count")
        .then((r) => { if (alive) setUnread(r.unread); })
        .catch(() => undefined);
    };
    load();
    const timer = setInterval(load, 60000);
    window.addEventListener(NOTIFICATIONS_CHANGED, load);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED, load);
    };
  }, [enabled, pathname]);
  return unread;
}
