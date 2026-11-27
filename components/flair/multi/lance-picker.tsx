"use client";
/**
 * O lance do turno da vez: na Batalha de Looks, o look do desafio (uma carta por vaga, pela posição da carta); no Dress
 * Fighter e no Fashion Sports, uma carta (ou nenhuma, quando o jogo deixa passar). Cartas já jogadas ficam de fora
 * quando o jogo não as repete; a peça que desfilou no turno anterior da Batalha chega cansada (aviso na carta).
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { NucleoCard } from "@/components/flair/nucleos/nucleo-card";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { lanceCompleto, vagaDaCarta } from "@/lib/flair/multi/lance";
import type { Turnos } from "@/lib/flair/multi/types";

interface Props {
  turnos: Turnos;
  cartas: FlairCollectionCard[];
  /** as cartas do turno anterior (cansadas na Batalha) */
  anteriores: string[];
  enviando: boolean;
  onLancar: (cartas: Record<string, string>) => void;
}

export function LancePicker({ turnos, cartas, anteriores, enviando, onLancar }: Props) {
  const tx = useNucleoText();
  const [lance, setLance] = useState<Record<string, string>>({});
  const umaCarta = turnos.vagas.length === 1;
  const disponiveis = useMemo(() => cartas.filter((c) => turnos.repete || !turnos.usadas.includes(c.id)), [cartas, turnos.repete, turnos.usadas]);
  function tocar(c: FlairCollectionCard) {
    const vaga = vagaDaCarta(c.position, turnos.vagas);
    if (!vaga) return;
    setLance((l) => (l[vaga] === c.id ? Object.fromEntries(Object.entries(l).filter(([v]) => v !== vaga)) : { ...l, [vaga]: c.id }));
  }
  const pronto = lanceCompleto(lance, turnos.minimo);
  return (
    <div className="fm-lance" data-testid="fm-lance">
      <ul className="fm-lance-cartas" aria-label={tx.t("flair3d.multi.lance.cartas")}>
        {disponiveis.map((c) => {
          const vaga = vagaDaCarta(c.position, turnos.vagas);
          const escolhida = vaga !== null && lance[vaga] === c.id;
          const cansada = !umaCarta && anteriores.includes(c.id);
          return (
            <li key={c.id}>
              <button type="button" className={escolhida ? "fm-carta is-on" : "fm-carta"} aria-pressed={escolhida} disabled={!vaga}
                onClick={() => tocar(c)} data-testid={`fm-carta-${c.id}`}>
                <NucleoCard card={c} selo={cansada ? tx.t("flair3d.multi.lance.cansada") : vaga ? tx.ou(`flair3d.ui.tab.${vaga}`, vaga) : null} semEfeito={!vaga || cansada} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="fm-lance-acoes">
        <p className="type-caption text-muted">
          {umaCarta ? (lance.CARTA ? tx.t("flair3d.multi.lance.umaEscolhida") : tx.t("flair3d.multi.lance.semCarta"))
            : tx.t("flair3d.multi.lance.vagas", { n: Object.keys(lance).length, total: turnos.vagas.length })}
        </p>
        <Button variant="primary" loading={enviando} disabled={!pronto} onClick={() => onLancar(lance)} data-testid="fm-lancar">
          {tx.t("flair3d.multi.lance.lancar", { n: turnos.vez })}
        </Button>
      </div>
    </div>
  );
}
