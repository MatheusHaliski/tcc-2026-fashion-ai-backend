"use client";
/**
 * A rodada zonas na tela da fase de uso (Flair3dMomentoChave e Flair3dCartaDeUso no servidor): a deixa do momento-chave
 * (o pênalti, a virada da música, o pit stop, a ameaça), com a condição e as duas opções nos dois botões, e a mão de
 * cartas do guarda-roupa, cada uma com o lance que a cor dela aciona, a faixa de Hype (a torcida) e a recarga da
 * Metamorfose. As teclas 1 a 6 armam a carta para a próxima marca. Só desenha: a nota é do servidor.
 */
import { useEffect, type CSSProperties } from "react";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { Deixa } from "@/components/flair/nucleos/use-execucao-do-desfile";
import type { CartaDaMao } from "@/components/flair/nucleos/use-mao-de-uso";
import { GLIFO, type BotaoDaExecucao } from "@/lib/flair/nucleos/movimento/execucao";
import type { LancesDoPedido } from "@/lib/flair/nucleos/movimento/lances-de-uso";

/** As duas opções do momento-chave: a primeira no botão do lance seguro, a segunda no do ousado. */
export function botoesDaChave(deixa: Deixa): [BotaoDaExecucao, BotaoDaExecucao] {
  return [deixa.botao, deixa.ousado ?? deixa.botao];
}

/** A deixa do momento-chave: a condição sorteada pelo servidor e as duas opções, com a janela da marca correndo. */
export function DeixaDaChave({ deixa }: { deixa: Deixa }) {
  const tx = useNucleoText();
  const chave = deixa.chave;
  if (!chave) return null;
  const janela = { "--n3d-janela": `${deixa.janelaMs}ms` } as CSSProperties;
  const botoes = botoesDaChave(deixa);
  return (
    <span key={deixa.marca} className="n3d-chave" aria-hidden data-testid="deixa-da-chave" data-momento={chave.momento}>
      <strong>{tx.t(`flair3d.uso.chave.momento.${chave.momento}`)}</strong>
      <em>{tx.t(`flair3d.uso.chave.condicao.${chave.condicao}`)}</em>
      <span className="n3d-lances">
        {chave.opcoes.map((opcao, i) => (
          <span key={opcao} className="n3d-lance">
            <span className="n3d-deixa" style={janela}>{GLIFO[botoes[i]]}</span>
            <small>{tx.t(`flair3d.uso.chave.opcao.${opcao}`)}</small>
          </span>
        ))}
      </span>
    </span>
  );
}

/** O texto da deixa do momento-chave para o leitor de tela. */
export function textoDaChave(tx: ReturnType<typeof useNucleoText>, deixa: Deixa): string {
  const chave = deixa.chave!;
  const [a, b] = botoesDaChave(deixa);
  return tx.t("flair3d.uso.chave.deixa", {
    momento: tx.t(`flair3d.uso.chave.momento.${chave.momento}`),
    condicao: tx.t(`flair3d.uso.chave.condicao.${chave.condicao}`),
    botaoA: GLIFO[a],
    opcaoA: tx.t(`flair3d.uso.chave.opcao.${chave.opcoes[0]}`),
    botaoB: GLIFO[b],
    opcaoB: tx.t(`flair3d.uso.chave.opcao.${chave.opcoes[1]}`),
  });
}

interface MaoProps {
  cartas: CartaDaMao[];
  lances: LancesDoPedido;
  armada: string | null;
  usos: ReadonlyMap<string, number>;
  marca: number;
  disponivel: (c: CartaDaMao, marca: number) => boolean;
  armar: (id: string | null) => void;
}

/** A mão de cartas da fase: armar uma carta para a próxima marca (clique ou tecla 1 a 6). */
export function MaoDeUso({ cartas, lances, armada, usos, marca, disponivel, armar }: MaoProps) {
  const tx = useNucleoText();
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (!Number.isInteger(i) || i < 0 || i >= cartas.length) return;
      if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
      if (disponivel(cartas[i], marca)) armar(cartas[i].id);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [cartas, marca, disponivel, armar]);
  if (lances.cartasMax <= 0) return null;
  const jogadas = usos.size;
  return (
    <span className="n3d-mao" data-testid="mao-de-uso">
      <small>{cartas.length ? tx.t("flair3d.uso.mao.titulo", { n: jogadas, max: lances.cartasMax }) : tx.t("flair3d.uso.mao.vazia")}</small>
      {cartas.map((c, i) => {
        const livre = disponivel(c, marca);
        const recarga = c.uso.efeito === "METAMORFOSE" && usos.has(c.id) && !livre;
        const doUniforme = !!c.uso.familia && lances.uniforme.includes(c.uso.familia);
        return (
          <button
            key={c.id}
            type="button"
            className="n3d-mao-carta"
            data-efeito={c.uso.efeito}
            data-armada={armada === c.id || undefined}
            data-uniforme={doUniforme || undefined}
            disabled={!livre}
            aria-pressed={armada === c.id}
            title={`${c.nome} · ${tx.t(`flair3d.uso.efeito.${c.uso.efeito}`)} · ${recarga ? tx.t("flair3d.uso.mao.recarga") : tx.t("flair3d.uso.mao.torcida", { faixa: tx.t(`hype.level.${c.uso.faixa}`) })}`}
            aria-label={`${i + 1}: ${tx.t(`flair3d.uso.lance.${c.uso.lance}`)} (${c.nome})`}
            onClick={() => armar(c.id)}
          >
            <kbd>{i + 1}</kbd>
            <b>{tx.t(`flair3d.uso.lance.${c.uso.lance}`)}</b>
            {recarga && <small>{tx.t("flair3d.uso.mao.recarga")}</small>}
          </button>
        );
      })}
    </span>
  );
}
