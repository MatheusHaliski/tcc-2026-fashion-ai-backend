"use client";
/**
 * Dados de um Desafio de Montagem: o desafio, as cartas disponíveis, a mesa (cartas por vaga, com desfazer, guardada
 * neste aparelho), a leitura escolhida, a conferência e a entrega. O servidor é o juiz: cada mudança é conferida em
 * /check (sem gravar nada) e a resposta guarda as cartas que julgou (`de`); a entrega (/submit) é atômica.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useToast } from "@/components/ui";
import type { FlairCollection } from "@/components/flair/flair-collection";
import { useMesa } from "@/components/flair/montagem/use-mesa";
import { OWN_READING, type CbcCheck, type CbcDetail, type CbcSubmitResult } from "@/lib/flair/cbc";

export type CbcConferida = CbcCheck & { de: Record<string, string> };

export function useCbcMesa(slug: string) {
  const toast = useToast();
  const detail = useApi<CbcDetail>((signal) => api.get(`/api/flair/challenges/${slug}`, { signal }), [slug]);
  const bank = useApi<FlairCollection>((signal) => api.get("/api/me/flair/cards", { signal }), []);
  const d = detail.data;
  const available = useMemo(() => (bank.data?.cards ?? []).filter((c) => c.state === "AVAILABLE"), [bank.data]);
  const ordem = useMemo(() => (d?.slots ?? []).map((s) => s.key), [d]);
  const ids = useMemo(() => (bank.data ? available.map((c) => c.id) : null), [bank.data, available]);
  const mesa = useMesa(`cbc.${slug}`, ordem, ids);
  const placed = mesa.cartas;
  const [reading, setReading] = useState<string | null>(null);
  const [check, setCheck] = useState<CbcConferida | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CbcSubmitResult | null>(null);
  const [rewardOpen, setRewardOpen] = useState(false);
  const interpretation = reading ?? d?.suggestedInterpretation ?? OWN_READING;
  const filled = Object.keys(placed).length;
  const readOnly = !!d && (d.status === "ENDED" || !!d.mine?.done);

  // conferência automática no servidor a cada mudança (sem gravar nada); a resposta mais recente vence
  const seq = useRef(0);
  const chave = JSON.stringify(placed);
  useEffect(() => {
    if (!d || readOnly) return;
    if (filled === 0) {
      setCheck(null);
      return;
    }
    const my = ++seq.current;
    setChecking(true);
    const h = setTimeout(async () => {
      try {
        const r = await api.post<CbcCheck>(`/api/flair/challenges/${slug}/check`, { slots: placed, interpretation });
        if (my === seq.current) setCheck({ ...r, de: placed });
      } catch (e) {
        if (my === seq.current) toast.fromError(e);
      } finally {
        if (my === seq.current) setChecking(false);
      }
    }, 160);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, interpretation, slug, readOnly, !!d]);

  async function submit() {
    setSubmitting(true);
    try {
      const r = await api.post<CbcSubmitResult>(`/api/flair/challenges/${slug}/submit`, { slots: placed, interpretation });
      setResult(r);
      setRewardOpen(true);
      mesa.esquecer();
      detail.reload();
      bank.reload();
    } catch (e) {
      toast.fromError(e);
    } finally {
      setSubmitting(false);
    }
  }

  return {
    detail,
    bank,
    d,
    available,
    ordem,
    mesa,
    placed,
    interpretation,
    setReading,
    filled,
    readOnly,
    check,
    /** a conferência é das cartas que estão na mesa agora */
    fresca: !!check && JSON.stringify(check.de) === chave,
    checking,
    submitting,
    submit,
    result,
    rewardOpen,
    setRewardOpen,
  };
}

export type CbcMesa = ReturnType<typeof useCbcMesa>;
