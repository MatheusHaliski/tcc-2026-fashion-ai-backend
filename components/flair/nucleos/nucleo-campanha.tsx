"use client";
/**
 * A campanha do jogo, acima da escolha de rodada (ou do deck, nos jogos de uma rodada só) e no resultado: a frase da
 * história no ponto em que a pessoa está (abertura, transição que cita a última partida, fecho), as estrelas do jogo e
 * quantas rodadas já foram vencidas. Tudo vem do servidor (lib/flair/nucleos/progresso.ts); os textos, dos catálogos.
 */
import { cn } from "@/components/ui";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { fraseDoEnredo, type NucleoProgresso } from "@/lib/flair/nucleos/progresso";

interface Props {
  progresso: NucleoProgresso;
  /** mostra a trilha etapa a etapa (onde não há lista de rodadas: as modalidades do Fashion Sports) */
  lista?: boolean;
  /** dentro do resultado: sem título próprio nem a nota do servidor */
  compacta?: boolean;
}

type Texto = ReturnType<typeof useNucleoText>;

/** O nome da etapa da trilha: a rodada ou, nos jogos por resposta, a opção (a modalidade). */
export function nomeDaEtapaDaCampanha(tx: Texto, p: Pick<NucleoProgresso, "nucleo" | "porResposta">, codigo: string): string {
  return p.porResposta ? tx.ou(`flair3d.nucleo.${p.nucleo}.opcao.${codigo}`, codigo) : tx.rodadaNome(p.nucleo, codigo);
}

export function EstrelasDaRodada({ n, rotulo }: { n: number; rotulo: string }) {
  return (
    <span className="n3d-stars n3d-round-stars" role="img" aria-label={rotulo}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={cn("n3d-star", i <= n && "is-on")} aria-hidden>★</span>
      ))}
    </span>
  );
}

export function NucleoCampanha({ progresso, lista = false, compacta = false }: Props) {
  const tx = useNucleoText();
  const frase = fraseDoEnredo(progresso);
  const nome = (codigo: string | null) => (codigo ? nomeDaEtapaDaCampanha(tx, progresso, codigo) : "");
  const texto = tx.ou(frase.chave, "", { rodada: nome(frase.rodada), proxima: nome(frase.proxima), pontos: frase.pontos, estrelas: frase.estrelas, maximo: frase.maximo });
  const vencidas = tx.t(progresso.porResposta ? "flair3d.ui.campanha.vencidas.modalidades" : "flair3d.ui.campanha.vencidas", { vencidas: progresso.vencidas, total: progresso.total });
  return (
    <section className={cn("n3d-campanha", compacta && "is-compacta")} aria-labelledby="n3d-campanha-titulo" data-testid="nucleo-campanha" data-momento={frase.momento}>
      <h2 id="n3d-campanha-titulo" className={compacta ? "type-label" : "type-h3"}>{tx.t(compacta ? "flair3d.ui.campanha.noResultado" : "flair3d.ui.campanha.titulo")}</h2>
      {texto && (
        <>
          <p className="type-label">{tx.t(`flair3d.ui.campanha.momento.${frase.momento}`)}</p>
          <p className="n3d-campanha-enredo" data-testid="nucleo-enredo">{texto}</p>
        </>
      )}
      <p className="n3d-campanha-total tabular" data-testid="nucleo-campanha-total">
        <span className="n3d-star is-on" aria-hidden>★</span> {tx.t("flair3d.ui.campanha.estrelas", { estrelas: progresso.estrelas, maximo: progresso.maximo })} · {vencidas}
      </p>
      {lista && (
        <ol className="n3d-campanha-trilha" data-testid="nucleo-campanha-trilha">
          {progresso.rodadas.map((e) => (
            <li key={e.codigo} className={cn(e.vencida && "is-vencida")} data-etapa={e.codigo}>
              <span>{nome(e.codigo)}</span>
              <EstrelasDaRodada n={e.estrelas} rotulo={tx.t(e.vencida ? "flair3d.ui.campanha.etapa.vencida" : "flair3d.ui.campanha.etapa.aberta", { nome: nome(e.codigo), n: e.estrelas })} />
            </li>
          ))}
        </ol>
      )}
      {!compacta && <p className="type-caption text-muted">{tx.t("flair3d.ui.campanha.servidor")}</p>}
    </section>
  );
}
