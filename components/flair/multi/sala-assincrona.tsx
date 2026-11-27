"use client";
/**
 * A sala com a mesma semente em jogo: cada pessoa joga a própria partida, quando puder, na tela normal do jogo
 * (?sala=), com o mesmo sorteio da outra. A nota da outra pessoa só aparece quando as duas terminaram.
 */
import Link from "next/link";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { outraPessoa, rotaDoJogoNaSala } from "@/lib/flair/multi/filtros";
import type { Sala } from "@/lib/flair/multi/types";

export function SalaAssincrona({ sala }: { sala: Sala }) {
  const tx = useNucleoText();
  const a = sala.assincrono ?? {};
  const outra = outraPessoa(sala).username;
  return (
    <section className="fm-assincrona surface" data-testid="fm-assincrona">
      <p className="type-body">{tx.t("flair3d.multi.assincrono.explica")}</p>
      <div className="fm-assincrona-lados">
        <div>
          <p className="type-label">{tx.t("flair3d.multi.voce")}</p>
          {a.eu?.terminou
            ? <p className="type-title tabular" data-testid="fm-minha-nota">{tx.t("flair3d.multi.assincrono.nota", { n: a.eu.pontos ?? 0 })}</p>
            : (
              <Link href={rotaDoJogoNaSala(sala)} className="btn btn-primary" data-testid="fm-jogar-partida">
                {a.minhaPartida ? tx.t("flair3d.multi.assincrono.continuar") : tx.t("flair3d.multi.assincrono.jogar")}
              </Link>
            )}
        </div>
        <div>
          <p className="type-label">@{outra}</p>
          <p className="type-body" data-testid="fm-outro-status">
            {a.outro?.terminou ? tx.t("flair3d.multi.assincrono.outroTerminou", { outro: outra }) : tx.t("flair3d.multi.assincrono.outroJogando", { outro: outra })}
          </p>
        </div>
      </div>
    </section>
  );
}
