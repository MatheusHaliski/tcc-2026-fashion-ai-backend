"use client";
/**
 * O começo da partida sobre a faixa do deck (nunca sobre o palco): a premissa do jogo (a história em duas linhas, uma
 * vez por partida), depois a abertura do salão no caso da gala do Fashion Detective e o briefing da vez (tema, etapa,
 * oponente, look-alvo). Fecham no botão ou sozinhos.
 */
import { useEffect, useState } from "react";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { BatalhaPlacar } from "@/components/flair/nucleos/batalha-placar";
import { NucleoAvisoDaRodada } from "@/components/flair/nucleos/nucleo-aviso-da-rodada";
import { NucleoBriefing } from "@/components/flair/nucleos/nucleo-briefing";
import { NucleoCutscene } from "@/components/flair/nucleos/nucleo-cutscene";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { useNucleoBriefing } from "@/components/flair/nucleos/use-nucleo-briefing";
import { SALOES_DA_GALA } from "@/components/flair/nucleos/use-modo-por-cartas";
import { salaoDaVez } from "@/lib/flair/nucleos/detective";
import { viabilidade } from "@/lib/flair/nucleos/viabilidade";
import type { EfeitoItem, NucleoDefinicao, NucleoPartida, NucleoResultado } from "@/lib/flair/nucleos/types";

/** Quanto a premissa fica na tela, em ms, se a pessoa não fechar antes. */
export const PREMISSA_MS = 12000;

interface Props {
  definicao: NucleoDefinicao;
  partida?: NucleoPartida | null;
  tentativa?: NucleoResultado | null;
  apresentacao: ReturnType<typeof useNucleoBriefing>;
  cartas: FlairCollectionCard[];
  /** os selos de cada carta da partida: o aviso de rodada que o deck não cumpre */
  efeitos?: (cardId: string) => EfeitoItem[] | undefined;
}

export function NucleoApresentacao({ definicao, partida, tentativa, apresentacao, cartas, efeitos }: Props) {
  const tx = useNucleoText();
  const codigo = definicao.codigo;
  // a premissa abre a partida uma vez; a partida retomada no meio (tentativa já feita) não a repete; na gala do
  // Fashion Detective cada salão já abre com a cutscene dele
  const gala = codigo === "FASHION_DETECTIVE" && definicao.rodada === SALOES_DA_GALA;
  const [lida, setLida] = useState(!!tentativa || gala);
  const texto = tx.ou(`flair3d.narrativa.${codigo}.premissa`, "");
  useEffect(() => {
    if (lida || !texto) return;
    const timer = window.setTimeout(() => setLida(true), PREMISSA_MS);
    return () => window.clearTimeout(timer);
  }, [lida, texto, partida?.id]);
  const aviso = efeitos ? viabilidade(definicao.objetivo.regras.map((r) => r.codigo), cartas.map((c) => efeitos(c.id)), definicao.recursos.includes("MAQUIAGEM")) : null;
  // na Batalha, a comparação das rodadas já entregues fica à vista enquanto a pessoa monta o look da seguinte
  const avisoNaTela = <><NucleoAvisoDaRodada codigo={codigo} escopo="partida" viabilidade={aviso} />{codigo === "BATALHA_LOOKS" && <BatalhaPlacar anterior={tentativa} />}</>;
  // com um briefing (tema, etapa, oponente), a premissa abre o mesmo cartão; sem ele, ganha o cartão dela
  if (apresentacao.briefing) {
    const fechar = () => {
      setLida(true);
      apresentacao.fechar();
    };
    return (
      <>
        {gala && <NucleoCutscene salao={salaoDaVez(tentativa)} />}
        <NucleoBriefing briefing={apresentacao.briefing} cartas={cartas} aberto={apresentacao.aberto} onFechar={fechar} premissa={lida ? null : texto} aviso={avisoNaTela} />
      </>
    );
  }
  if (!lida && texto) {
    return (
      <section className="n3d-cutscene n3d-premissa" role="dialog" aria-label={tx.t("flair3d.narrativa.ui.comeco")} data-testid="nucleo-premissa">
        <p className="type-label">{tx.t("flair3d.narrativa.ui.comeco")}</p>
        <h3>{tx.nome(codigo)}</h3>
        <p>{texto}</p>
        {avisoNaTela}
        <button type="button" className="btn btn-sm btn-primary" onClick={() => setLida(true)}>{tx.t("flair3d.narrativa.ui.seguir")}</button>
      </section>
    );
  }
  // fechada a premissa, o aviso de rodada que o deck não cumpre continua à vista sobre a faixa do deck
  return (
    <>
      {gala && <NucleoCutscene salao={salaoDaVez(tentativa)} />}
      {avisoNaTela}
    </>
  );
}
