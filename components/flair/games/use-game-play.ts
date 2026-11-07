"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useToast } from "@/components/ui";
import { OWN_READING } from "@/lib/flair/cbc";
import { lockFromError, type GameAccess, type GameCheck, type GameDetail, type GameSubmitResult } from "@/lib/flair/games";
import type { FlairCollection } from "@/components/flair/flair-collection";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";

const CHECK_DEBOUNCE_MS = 450;

/**
 * Estado de uma partida do FLAIR 3D MAKE UP, a mesma lógica do CbcPlay contra /api/flair/games/{slug}: detalhe, banco de
 * cartas (só com acesso liberado), vagas preenchidas, leitura, conferência automática no servidor (debounce de 450 ms,
 * a resposta mais recente vence), entrega e recarga. Bloqueio: `access.allowed` do detalhe decide; um 403 do servidor
 * em check/submit vira `lock` com os detalhes da resposta (fail closed — o cliente nunca compara nível local).
 */
export function useGamePlay(slug: string) {
  const toast = useToast();
  const detail = useApi<GameDetail>((signal) => api.get(`/api/flair/games/${slug}`, { signal }), [slug]);
  const d = detail.data;
  const [lock, setLock] = useState<GameAccess | null>(null);
  const allowed = !!d?.access?.allowed && !lock;
  const bank = useApi<FlairCollection>((signal) => api.get("/api/me/flair/cards", { signal }), [allowed], { enabled: allowed });
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [reading, setReading] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [check, setCheck] = useState<GameCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GameSubmitResult | null>(null);
  const [rewardOpen, setRewardOpen] = useState(false);

  const cards = useMemo(() => Object.fromEntries((bank.data?.cards ?? []).map((c) => [c.id, c])), [bank.data]);
  const available = useMemo(() => (bank.data?.cards ?? []).filter((c) => c.state === "AVAILABLE"), [bank.data]);
  const interpretation = reading ?? d?.suggestedInterpretation ?? OWN_READING;
  const filled = Object.keys(placed).length;
  const readOnly = !!d && (d.status === "ENDED" || !!d.mine?.done);
  const requiredSlots = useMemo(() => (d?.slots ?? []).filter((s) => !s.optional).length, [d]);

  // conferência automática a cada mudança (sem gravar nada); 403 de nível vira bloqueio
  const seq = useRef(0);
  useEffect(() => {
    if (!d || readOnly || !allowed) return;
    if (filled === 0) { setCheck(null); return; }
    const my = ++seq.current; setChecking(true);
    const h = setTimeout(async () => {
      try { const r = await api.post<GameCheck>(`/api/flair/games/${slug}/check`, { slots: placed, interpretation }); if (my === seq.current) setCheck(r); }
      catch (e) { if (my !== seq.current) return; const l = lockFromError(e); if (l) setLock(l); else toast.fromError(e); }
      finally { if (my === seq.current) setChecking(false); }
    }, CHECK_DEBOUNCE_MS);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, interpretation, slug, readOnly, allowed, !!d]);

  const ev = check?.evaluation;
  const placedCards: Record<string, FlairCollectionCard | undefined> = Object.fromEntries(Object.entries(placed).map(([k, v]) => [k, cards[v]]));
  const canSubmit = allowed && !readOnly && d?.status === "OPEN" && !!ev?.ok && ev.complete && (check?.canSubmit ?? true) && !submitting;

  const place = (slot: string, cardId: string) => {
    setPlaced((p) => { const n = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== cardId)); n[slot] = cardId; return n; });
    setPicking(null);
  };
  const remove = (slot: string) => { setPlaced((p) => { const n = { ...p }; delete n[slot]; return n; }); setPicking(null); };
  const clear = () => setPlaced({});
  async function submit() {
    if (!allowed) return;
    setSubmitting(true);
    try {
      const r = await api.post<GameSubmitResult>(`/api/flair/games/${slug}/submit`, { slots: placed, interpretation });
      setResult(r); setRewardOpen(true); detail.reload(); bank.reload();
    } catch (e) { const l = lockFromError(e); if (l) setLock(l); else toast.fromError(e); }
    finally { setSubmitting(false); }
  }

  return {
    detail, d, bank, available, lock, access: lock ?? d?.access ?? null, allowed, readOnly,
    placed, placedCards, filled, requiredSlots, place, remove, clear,
    reading, setReading, interpretation, picking, setPicking,
    check, checking, canSubmit, submitting, submit, result, rewardOpen, setRewardOpen,
  };
}
