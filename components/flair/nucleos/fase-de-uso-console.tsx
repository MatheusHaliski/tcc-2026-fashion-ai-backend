"use client";
/**
 * A fase de uso dos jogos de zonas no perfil console (use-console-da-fase-de-uso.ts): HUD mínimo na cena — a deixa em
 * poucas palavras com as teclas (E e F), a carta armada e o atalho da roda —, a roda radial de cartas (X) e o cartão de
 * controles (?). O texto longo fica para o leitor de tela no painel da fase (desfile-hud.tsx).
 */
import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "@/components/three/common";
import { AjudaDeControles } from "@/components/flair/nucleos/console/ajuda-de-controles";
import { IconeConsole, type IconeConsoleNome } from "@/components/flair/nucleos/console/icone-console";
import { RodaRadial, type ItemDaRoda } from "@/components/flair/nucleos/console/roda-radial";
import { useTelaCheia } from "@/components/flair/nucleos/console/use-tela-cheia";
import { useConsoleDaFaseDeUso } from "@/components/flair/nucleos/use-console-da-fase-de-uso";
import type { Deixa } from "@/components/flair/nucleos/use-execucao-do-desfile";
import type { CartaDaMao } from "@/components/flair/nucleos/use-mao-de-uso";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

const ICONE: Record<string, IconeConsoleNome> = { EMBALO: "distracao", FOLEGO: "folego", ESCUDO: "escondido", METAMORFOSE: "disfarce" };
const AJUDA = ["MOVER", "INTERAGIR", "DISPARAR", "RODA", "PEGAR", "TELA_CHEIA", "AJUDA"];

interface Props {
  codigo: NucleoCodigo;
  ativo: boolean;
  deixa: Deixa | null;
  cartas: CartaDaMao[];
  armada: string | null;
  disponivel: (c: CartaDaMao) => boolean;
  armar: (id: string | null) => void;
}

/** A deixa em até seis palavras: "E passe · F drible", ou a condição do momento-chave e as duas opções. */
export function DeixaCurta({ codigo, deixa }: { codigo: NucleoCodigo; deixa: Deixa | null }) {
  const tx = useNucleoText();
  if (!deixa) return null;
  const chave = deixa.chave;
  const a = chave ? tx.t(`flair3d.uso.chave.curta.${chave.opcoes[0]}`) : tx.ou(`flair3d.uso.seguro.${codigo}`, tx.t("flair3d.uso.seguro.padrao"));
  const b = chave ? tx.t(`flair3d.uso.chave.curta.${chave.opcoes[1]}`) : tx.ou(`flair3d.uso.ousado.${codigo}`, tx.t("flair3d.uso.ousado.padrao"));
  return (
    <span className="n3d-curta" aria-hidden data-testid="deixa-curta" data-chave={chave ? "" : undefined}>
      {chave && <em>{tx.t(`flair3d.uso.chave.curta.${chave.condicao}`)}</em>}
      <kbd>E</kbd> {a} <kbd>F</kbd> {b}
    </span>
  );
}

export function ConsoleDaFaseDeUso({ codigo, ativo, deixa, cartas, armada, disponivel, armar }: Props) {
  const tx = useNucleoText();
  const reduzido = useReducedMotion();
  const palco = useRef<HTMLElement | null>(null);
  const marcador = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    palco.current = marcador.current?.closest<HTMLElement>("[data-testid=nucleo-game]") ?? null;
  }, []);
  const tela = useTelaCheia(palco);
  const c = useConsoleDaFaseDeUso({ codigo, ativo, deixa, cartas: cartas.length, armar: (i) => cartas[i] && disponivel(cartas[i]) && armar(cartas[i].id), alternarTelaCheia: tela.alternar });
  const itens = useMemo<ItemDaRoda[]>(
    () => cartas.map((k) => ({ id: k.id, nome: `${tx.t(`flair3d.uso.lance.${k.uso.lance}`)} · ${k.nome}`, icone: <IconeConsole nome={ICONE[k.uso.efeito] ?? "roda"} tamanho={28} />, habilitado: disponivel(k), equipado: k.id === armada })),
    [cartas, armada, disponivel, tx],
  );
  const naMao = cartas.find((k) => k.id === armada);
  return (
    <span ref={marcador} className="n3d-console" data-testid="console-da-fase" data-cartas={cartas.length}>
      <span className="n3d-console-dica" aria-hidden>
        {naMao ? <b>{tx.t(`flair3d.uso.lance.${naMao.uso.lance}`)}</b> : null}
        <kbd>X</kbd> {tx.t("flair3d.uso.console.cartas")} <kbd>?</kbd>
      </span>
      {c.roda.aberta && itens.length > 0 && (
        <RodaRadial itens={itens} foco={c.roda.foco} onFoco={c.setFoco} rotulo={tx.t("flair3d.uso.console.roda")} reduzido={reduzido}
          onEscolher={(i) => {
            if (cartas[i] && disponivel(cartas[i])) armar(cartas[i].id);
            c.fecharRoda();
          }} />
      )}
      {c.ajuda && <AjudaDeControles onFechar={c.fecharAjuda} acoes={AJUDA} />}
    </span>
  );
}
