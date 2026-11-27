"use client";
/**
 * A jogada no elenco em quebra-cabeça: há sempre uma peça (vaga) em destaque e a bandeja mostra as cartas, as que
 * combinam com o que a peça pede primeiro. Um toque numa carta põe na vaga e o destaque passa para a próxima vaga
 * vazia; arrastar leva a carta a qualquer peça; arrastar de uma peça a outra troca, e de uma peça para a bandeja tira.
 * Teclado e controle pelos mesmos comandos dos núcleos: setas ou direcional escolhem a peça (ou a carta, com a bandeja
 * em foco), Espaço ou A entra na bandeja e põe a carta, Backspace ou B sai da bandeja ou tira a carta, Z desfaz,
 * Enter ou Start entrega, O ou Select mostra os requisitos.
 */
import { useEffect, useMemo, useState } from "react";
import type { useElenco } from "@/components/flair/elencos/use-elenco";
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";
import { useArrastar } from "@/components/flair/montagem/use-arrastar";
import { cartaCumpre } from "@/lib/flair/elencos/progresso";
import { por as porNaMesa, proximaVazia } from "@/lib/flair/montagem/mesa";
import { opcoesDaVaga, type Opcao } from "@/lib/flair/montagem/opcoes";
import type { Comando } from "@/lib/flair/nucleos/controls";

export function useElencoJogo(m: ReturnType<typeof useElenco>, colunas: number) {
  const tx = useElencoText();
  const vagas = useMemo(() => m.elenco?.vagas ?? [], [m.elenco]);
  const ordem = useMemo(() => vagas.map((v) => v.chave), [vagas]);
  const [vaga, setVaga] = useState("");
  const [aberta, setAberta] = useState(true);
  const [naBandeja, setNaBandeja] = useState(false);
  const [foco, setFoco] = useState(0);
  const [requisitos, setRequisitos] = useState(true);
  const [aviso, setAviso] = useState("");
  const atual = vagas.find((v) => v.chave === vaga) ?? vagas.find((v) => !m.cartas[v.chave]) ?? vagas[0];
  const indice = (chave: string) => ordem.indexOf(chave) + 1;
  // as cartas que combinam com o pedido da peça vêm primeiro, marcadas com o atributo pedido
  const opcoes = useMemo(() => {
    if (!atual) return [];
    const campos = Object.keys(atual.pede ?? {}).map((c) => ({ color: "COR", style: "ESTILO", occasion: "OCASIAO" })[c] ?? c);
    return opcoesDaVaga(m.banco, atual.chave, atual.posicao, m.cartas, [])
      .map((o) => ({ ...o, comum: campos.length && cartaCumpre(o.card, atual.pede) ? (campos as Opcao["comum"]) : [] }))
      .sort((a, b) => b.comum.length - a.comum.length);
  }, [atual, m.banco, m.cartas]);
  const pronto = !!m.conferencia?.ok && !m.entregando && !m.resultado?.ok;
  /** Põe a carta na peça e leva o destaque para a próxima peça vazia. */
  const porCarta = (chave: string, cardId: string) => {
    const c = m.banco.find((x) => x.id === cardId);
    if (!c || !ordem.includes(chave)) return;
    m.por(chave, cardId);
    setAviso(tx.t("flair3d.elencos.placed", { nome: c.name, n: indice(chave) }));
    const depois = porNaMesa({ cartas: m.cartas, passado: [] }, chave, cardId).cartas;
    const proxima = proximaVazia(ordem, depois, chave);
    setVaga(proxima ?? chave);
    setFoco(0);
    if (!proxima) setNaBandeja(false);
  };
  const tirar = (chave: string) => {
    const c = m.banco.find((x) => x.id === m.cartas[chave]);
    if (!c) return;
    m.tirar(chave);
    setVaga(chave);
    setAviso(tx.t("flair3d.elencos.removed", { nome: c.name, n: indice(chave) }));
  };
  const desfazer = () => {
    if (!m.podeDesfazer) return;
    m.desfazer();
    setAviso(tx.t("flair.mesa.undone"));
  };
  const selecionar = (chave: string) => {
    setVaga(chave);
    setAberta(true);
    setNaBandeja(false);
    setFoco(0);
  };
  const escolher = (o: Opcao) => atual && porCarta(atual.chave, o.card.id);
  const pegar = useArrastar((cardId, alvo, origem) => (alvo ? porCarta(alvo, cardId) : origem && tirar(origem)));
  const vizinha = (dir: number, eixo: "x" | "y") => {
    const i = ordem.indexOf(atual?.chave ?? "") + dir * (eixo === "y" ? colunas : 1);
    return ordem[Math.min(ordem.length - 1, Math.max(0, i))];
  };
  const onComando = (c: Comando) => {
    if (!atual) return;
    const dir = c.dir ?? 1;
    const emFoco = aberta && naBandeja;
    if (c.acao === "NAVEGAR" && emFoco) setFoco((f) => Math.min(Math.max(0, opcoes.length - 1), Math.max(0, f + (c.eixo === "y" ? dir * 4 : dir))));
    else if (c.acao === "NAVEGAR") setVaga(vizinha(dir, c.eixo ?? "x"));
    else if (c.acao === "VESTIR" && emFoco && opcoes[foco]) escolher(opcoes[foco]);
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
    indice,
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
