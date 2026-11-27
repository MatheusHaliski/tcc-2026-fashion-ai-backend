"use client";
/**
 * A jogada num Desafio de Montagem, direta: há sempre uma vaga em destaque e a bandeja mostra as cartas dela. Um toque
 * numa carta põe na vaga e o destaque passa para a próxima vaga vazia; arrastar leva a carta a qualquer vaga; de uma
 * vaga a outra, troca; de uma vaga para a bandeja, tira. Z desfaz a última jogada. Enquanto o servidor não julga as
 * cartas que estão na mesa, a peça do quebra-cabeça da vaga fica "chegando" (sem sintonia): nunca um resultado errado.
 */
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { useArrastar } from "@/components/flair/montagem/use-arrastar";
import { useCbcLabels } from "@/components/flair/use-cbc-labels";
import type { CbcMesa } from "@/components/flair/use-cbc-mesa";
import type { PecaEstado } from "@/lib/flair/elencos/board";
import { por as porNaMesa, proximaVazia } from "@/lib/flair/montagem/mesa";
import { opcoesDaVaga, type Opcao } from "@/lib/flair/montagem/opcoes";

/** Peça do quebra-cabeça de cada vaga: vazia, chegando (sem julgamento) ou a sintonia que o servidor deu (0 a 3). */
export function pecasDoDesafio(slots: { key: string }[], placed: Record<string, string>, sintonia: Record<string, number> | null): PecaEstado[] {
  return slots.map((s) => {
    if (!placed[s.key]) return "coberta";
    const n = sintonia?.[s.key];
    if (n == null) return "chegando";
    return n >= 3 ? "verde" : n === 2 ? "laranja" : "vermelha";
  });
}

export function useCbcJogo(m: CbcMesa) {
  const { t } = useI18n();
  const { slotLabel } = useCbcLabels();
  const [vaga, setVaga] = useState("");
  const [aberta, setAberta] = useState(true);
  const [aviso, setAviso] = useState("");
  const d = m.d;
  const atual = d?.slots.find((s) => s.key === vaga) ?? d?.slots.find((s) => !m.placed[s.key]) ?? d?.slots[0];
  const carta = (id?: string) => m.available.find((c) => c.id === id);
  const nomeDaVaga = (slot: string) => (d ? slotLabel(d.scenario, d.slots.find((s) => s.key === slot) ?? { key: slot }) : slot);

  const opcoes = useMemo(() => {
    if (!atual) return [];
    const vizinhas = Object.entries(m.placed).filter(([k]) => k !== atual.key).map(([, id]) => carta(id));
    return opcoesDaVaga(m.available, atual.key, atual.position, m.placed, vizinhas.filter((c) => !!c), atual.accepts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual, m.available, m.placed]);

  const porCarta = (slot: string, cardId: string) => {
    const c = carta(cardId);
    if (!c || m.readOnly) return;
    m.mesa.por(slot, cardId);
    setAviso(t("flair.mesa.placed", { nome: c.name, vaga: nomeDaVaga(slot) }));
    const proxima = proximaVazia(m.ordem, porNaMesa({ cartas: m.placed, passado: [] }, slot, cardId).cartas, slot);
    setVaga(proxima ?? slot);
  };
  const tirar = (slot: string) => {
    const c = carta(m.placed[slot]);
    if (!c) return;
    m.mesa.tirar(slot);
    setVaga(slot);
    setAviso(t("flair.mesa.removed", { nome: c.name, vaga: nomeDaVaga(slot) }));
  };
  const desfazer = () => {
    if (!m.mesa.podeDesfazer) return;
    m.mesa.desfazer();
    setAviso(t("flair.mesa.undone"));
  };
  const pegar = useArrastar((cardId, alvo, origem) => (alvo ? porCarta(alvo, cardId) : origem && tirar(origem)));

  // Z desfaz; Delete tira a carta da vaga em destaque (Backspace e o controle ficam com use-cbc-controle.ts)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (e.altKey || alvo?.tagName === "INPUT" || alvo?.tagName === "TEXTAREA" || m.readOnly) return;
      if (e.key.toLowerCase() === "z") desfazer();
      else if (e.key === "Delete" && atual) tirar(atual.key);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  const sintonia = m.fresca && m.check ? Object.fromEntries(m.check.evaluation.slots.map((r) => [r.slot, r.sintonia])) : null;

  return {
    atual,
    opcoes,
    aberta,
    aviso,
    nomeDaVaga,
    pecas: d ? pecasDoDesafio(d.slots, m.placed, sintonia) : [],
    escolher: (o: Opcao) => atual && porCarta(atual.key, o.card.id),
    tirar,
    desfazer,
    pegar,
    selecionar: (slot: string) => {
      setVaga(slot);
      setAberta(true);
    },
    fechar: () => setAberta(false),
  };
}
