"use client";
/**
 * Antes de entrar no jogo: o single player continua o caminho padrão ("Treinar contra a Casa", a escolha de rodada e
 * de deck logo abaixo) e "Jogar contra alguém" abre o convite por busca na rede FAI para este jogo.
 */
import { useState } from "react";
import { Button } from "@/components/ui";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { ConvidarDialog } from "@/components/flair/multi/convidar-dialog";

export function MultiEntrada({ jogo, rodada }: { jogo: string; rodada?: string | null }) {
  const tx = useNucleoText();
  const [aberto, setAberto] = useState(false);
  return (
    <div className="fm-entrada" data-testid="fm-entrada">
      <p className="type-caption"><b>{tx.t("flair3d.multi.treinarCasa")}</b> <span className="text-muted">{tx.t("flair3d.multi.treinarCasaAjuda")}</span></p>
      <Button onClick={() => setAberto(true)} data-testid="fm-jogar-contra">{tx.t("flair3d.multi.jogarContraAlguem")}</Button>
      {aberto && <ConvidarDialog jogo={jogo} rodada={rodada} onClose={() => setAberto(false)} />}
    </div>
  );
}
