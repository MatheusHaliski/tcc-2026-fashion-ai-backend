"use client";
/**
 * A jogada no elenco, direta: há sempre uma vaga em destaque e a bandeja mostra as cartas dela. Um toque numa carta
 * põe na vaga e o destaque passa para a próxima vaga vazia; arrastar leva a carta a qualquer vaga; arrastar de uma
 * vaga a outra troca, e de uma vaga para a bandeja tira. Teclado e controle pelos mesmos comandos dos núcleos:
 * setas ou direcional escolhem a vaga (ou a carta, com a bandeja em foco), Espaço ou A entra na bandeja e põe a carta,
 * Backspace ou B sai da bandeja ou tira a carta, Z desfaz, Enter ou Start entrega, O ou Select mostra os requisitos.
 */
import { useEffect, useMemo, useState } from "react";
import type { useElenco } from "@/components/flair/elencos/use-elenco";
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";
import { useArrastar } from "@/components/flair/montagem/use-arrastar";
import { ordemDeLeitura, vagaVizinha } from "@/lib/flair/elencos/board";
import { por as porNaMesa, proximaVazia } from "@/lib/flair/montagem/mesa";
import { opcoesDaVaga, type Opcao } from "@/lib/flair/montagem/opcoes";
import type { Comando } from "@/lib/flair/nucleos/controls";

export function useElencoJogo(m: ReturnType<typeof useElenco>) {
  const tx = useElencoText();
  const vagas = useMemo(() => ordemDeLeitura(m.elenco?.vagas ?? []), [m.elenco]);
  const ordem = useMemo(() => vagas.map((v) => v.chave), [vagas]);
  const [vaga, setVaga] = useState("");
  const [aberta, setAberta] = useState(true);
  const [naBandeja, setNaBandeja] = useState(false);
  const [foco, setFoco] = useState(0);
  const [requisitos, setRequisitos] = useState(true);
  const [aviso, setAviso] = useState("");
  const atual = vagas.find((v) => v.chave === vaga) ?? vagas.find((v) => !m.cartas[v.chave]) ?? vagas[0];
  const carta = (id?: string) => m.banco.find((c) => c.id === id);
  const opcoes = useMemo(() => {
    if (!atual || !m.elenco) return [];
    const vizinhas = m.elenco.linhas.filter((l) => l.a === atual.chave || l.b === atual.chave).map((l) => carta(m.cartas[l.a === atual.chave ? l.b : l.a]));
    return opcoesDaVaga(m.banco, atual.chave, atual.posicao, m.cartas, vizinhas.filter((c) => !!c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual, m.elenco, m.banco, m.cartas]);
  const fresca = JSON.stringify(m.conferidas) === JSON.stringify(m.cartas);
  const pronto = !!m.conferencia?.ok && fresca && !m.entregando && !m.resultado;
  const nomeDaVaga = (chave: string) => tx.posicao(vagas.find((v) => v.chave === chave)?.posicao ?? "");

  const selecionar = (chave: string) => {
    setVaga(chave);
    setAberta(true);
    setNaBandeja(false);
    setFoco(0);
  };
  /** Põe a carta na vaga (se couber) e leva o destaque para a próxima vaga vazia. */
  const porCarta = (chave: string, cardId: string) => {
    const c = carta(cardId);
    const destino = vagas.find((v) => v.chave === chave);
    if (!c || !destino) return;
    if (c.position !== destino.posicao) {
      setAviso(tx.t("flair.mesa.rejected", { nome: c.name, posicao: tx.posicao(c.position), pede: tx.posicao(destino.posicao) }));
      return;
    }
    m.por(chave, cardId);
    setAviso(tx.t("flair.mesa.placed", { nome: c.name, vaga: nomeDaVaga(chave) }));
    const depois = porNaMesa({ cartas: m.cartas, passado: [] }, chave, cardId).cartas;
    const proxima = proximaVazia(ordem, depois, chave);
    setVaga(proxima ?? chave);
    setFoco(0);
    if (!proxima) setNaBandeja(false);
  };
  const tirar = (chave: string) => {
    const c = carta(m.cartas[chave]);
    if (!c) return;
    m.tirar(chave);
    setVaga(chave);
    setAviso(tx.t("flair.mesa.removed", { nome: c.name, vaga: nomeDaVaga(chave) }));
  };
  const desfazer = () => {
    if (!m.podeDesfazer) return;
    m.desfazer();
    setAviso(tx.t("flair.mesa.undone"));
  };
  const escolher = (o: Opcao) => atual && porCarta(atual.chave, o.card.id);
  const pegar = useArrastar((cardId, alvo, origem) => (alvo ? porCarta(alvo, cardId) : origem && tirar(origem)));

  const onComando = (c: Comando) => {
    if (!atual) return;
    const dir = c.dir ?? 1;
    const emFoco = aberta && naBandeja;
    if (c.acao === "NAVEGAR" && emFoco) setFoco((f) => Math.min(Math.max(0, opcoes.length - 1), Math.max(0, f + (c.eixo === "y" ? dir * 4 : dir))));
    else if (c.acao === "NAVEGAR") setVaga(vagaVizinha(vagas, atual.chave, dir, c.eixo ?? "x"));
    else if (c.acao === "VESTIR" && emFoco && opcoes[foco]?.cabe) escolher(opcoes[foco]);
    else if (c.acao === "VESTIR") {
      setAberta(true);
      setNaBandeja(true);
      setFoco(0);
    } else if (c.acao === "TIRAR" && emFoco) setNaBandeja(false);
    else if (c.acao === "TIRAR") tirar(atual.chave);
    else if (c.acao === "VER_OBJETIVO") setRequisitos((r) => !r);
    else if (c.acao === "ENTREGAR" && pronto) void m.entregar();
  };

  // Z (ou Ctrl+Z) desfaz a última jogada
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const campo = (e.target as HTMLElement | null)?.tagName;
      if (e.key.toLowerCase() === "z" && !e.altKey && campo !== "INPUT" && campo !== "TEXTAREA") desfazer();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  return {
    vagas,
    atual,
    opcoes,
    aberta,
    foco: aberta && naBandeja ? foco : null,
    requisitos,
    aviso,
    pronto,
    selecionar,
    escolher,
    tirar,
    desfazer,
    pegar,
    onComando,
    fechar: () => setAberta(false),
  };
}
