"use client";
/** A faixa da sala na tela do jogo (mesma semente): contra quem, o que falta e o link de volta para a sala. */
import Link from "next/link";
import { Avatar } from "@/components/ui";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { outraPessoa, rotaDaSala } from "@/lib/flair/multi/filtros";
import type { Sala } from "@/lib/flair/multi/types";

export function SalaFaixa({ sala }: { sala: Sala }) {
  const tx = useNucleoText();
  const outra = outraPessoa(sala);
  const terminou = !!sala.assincrono?.outro?.terminou;
  return (
    <aside className="fm-faixa" data-testid="fm-faixa" aria-label={tx.t("flair3d.multi.faixa.rotulo")}>
      <Avatar src={outra.avatarUrl} name={outra.nome ?? outra.username} size={28} />
      <span>{tx.t("flair3d.multi.faixa.contra", { outro: outra.username })}</span>
      <span className="text-muted">{terminou ? tx.t("flair3d.multi.assincrono.outroTerminou", { outro: outra.username }) : tx.t("flair3d.multi.faixa.mesmaSemente")}</span>
      <Link href={rotaDaSala(sala.id)} className="btn btn-sm">{tx.t("flair3d.multi.faixa.verSala")}</Link>
    </aside>
  );
}
