"use client";
/**
 * Um elenco (/flair/elencos/[elenco]), sem cenário 3D: o quebra-cabeça da cena dinâmica em cima, o tabuleiro embaixo
 * e a bandeja de cartas presa ao pé da tela (a vaga em destaque e as cartas dela, ao alcance do polegar). Pôr uma
 * carta é um toque (ou um arrasto até a vaga); a química, os requisitos e a entrega vêm do servidor. Teclado, toque e
 * gamepad pelo mesmo hook dos núcleos (ver use-elenco-jogo.ts).
 */
import { ElencoDelivered } from "@/components/flair/elencos/elenco-delivered";
import Link from "next/link";
import { EmptyState, PageHeader, SkeletonGrid, UiIcon } from "@/components/ui";
import { ElencoBoard } from "@/components/flair/elencos/elenco-board";
import { ElencoLegend } from "@/components/flair/elencos/elenco-legend";
import { ElencoJigsaw } from "@/components/flair/elencos/elenco-jigsaw";
import { ElencoRequirements } from "@/components/flair/elencos/elenco-requirements";
import { useElenco } from "@/components/flair/elencos/use-elenco";
import { useElencoJogo } from "@/components/flair/elencos/use-elenco-jogo";
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";
import { Bandeja } from "@/components/flair/montagem/bandeja";
import { useNucleoControls } from "@/components/flair/nucleos/use-nucleo-controls";
import { cenaDoElenco } from "@/lib/flair/cenas/catalogo";
import { estadoDasPecas, gradeDe, posicaoDaVaga } from "@/lib/flair/elencos/board";
import { elencoDaRota } from "@/lib/flair/elencos/formacoes";
import type { Comando } from "@/lib/flair/nucleos/controls";
import type { NucleoAcao } from "@/lib/flair/nucleos/types";

const ACOES: NucleoAcao[] = ["NAVEGAR", "VESTIR", "TIRAR", "ENTREGAR", "VER_OBJETIVO"];
const BOTOES: { id: string; cmd: Comando }[] = [
  { id: "prev", cmd: { acao: "NAVEGAR", dir: -1, eixo: "x" } },
  { id: "next", cmd: { acao: "NAVEGAR", dir: 1, eixo: "x" } },
  { id: "open", cmd: { acao: "VESTIR" } },
  { id: "remove", cmd: { acao: "TIRAR" } },
  { id: "requirements", cmd: { acao: "VER_OBJETIVO" } },
];

function Elenco({ codigo }: { codigo: string }) {
  const tx = useElencoText();
  const m = useElenco(codigo);
  const j = useElencoJogo(m);
  const { disparar } = useNucleoControls({ acoes: ACOES, onComando: j.onComando, ativo: !m.entregando });

  if (m.carregando || m.carregandoCartas) return <SkeletonGrid n={3} />;
  if (!m.elenco || !j.atual) return <EmptyState title={tx.t("flair3d.elencos.notFound")} />;
  const atual = j.atual;
  const grade = gradeDe(m.elenco.vagas);
  const entregue = !!m.resultado?.ok;
  const revelado = m.resultado?.ok
    ? {
        edicao: m.resultado.edicao,
        fotos: m.elenco.vagas.filter((v) => m.cartas[v.chave]).map((v) => {
          const card = m.banco.find((c) => c.id === m.cartas[v.chave]);
          return { chave: v.chave, ...posicaoDaVaga(v, grade), url: card?.imageUrl ?? null, nome: card?.name ?? "" };
        }),
      }
    : null;
  const bandeja = j.aberta && !entregue;
  return (
    <div className="el-game" data-testid="elenco-game">
      {m.offline && <p className="n3d-offline" role="status">{tx.t("flair3d.ui.offline")}</p>}
      <ElencoJigsaw cena={cenaDoElenco(codigo)} estados={estadoDasPecas(m.elenco.linhas, m.cartas, m.conferencia, m.conferidas)} revelado={revelado} />
      <ElencoBoard elenco={m.elenco} cartas={m.cartas} conferidas={m.conferidas} banco={m.banco} conf={m.conferencia} selecionada={atual.chave}
        onVaga={j.selecionar} pegar={entregue ? undefined : j.pegar} />
      <ElencoLegend />
      <ElencoRequirements requisitos={m.elenco.requisitos} conf={m.conferencia} aberto={j.requisitos} onToggle={() => disparar({ acao: "VER_OBJETIVO" })} />
      <div className="n3d-pad" role="toolbar" aria-label={tx.t("flair3d.ui.controls.toolbar")}>
        {BOTOES.map((b) => <button key={b.id} type="button" className="n3d-pad-btn" onClick={() => disparar(b.cmd)}>{tx.t(`flair3d.elencos.button.${b.id}`)}</button>)}
        <button type="button" className="n3d-pad-btn" onClick={j.desfazer} disabled={!m.podeDesfazer}>{tx.t("flair.mesa.undo")}</button>
      </div>
      <p className="mk-effect">{tx.t("flair3d.elencos.help")}</p>
      {m.erroConferir && <p className="n3d-error" role="alert">{tx.t("flair3d.elencos.checkError", { msg: m.erroConferir.message })}</p>}
      {m.erroEntrega && <p className="n3d-error" role="alert">{tx.t("flair3d.ui.submitError", { msg: m.erroEntrega.message })}</p>}
      {m.resultado?.ok && <ElencoDelivered nome={tx.elenco(codigo)} edicao={m.resultado.edicao} />}
      <button type="button" className="btn btn-primary n3d-submit" disabled={!j.pronto} onClick={() => void m.entregar()}>
        {tx.t(m.entregando ? "flair3d.ui.submitting" : "flair3d.elencos.submit")}
      </button>
      {bandeja && (
        <Bandeja vagaId={atual.chave} vaga={tx.posicao(atual.posicao)} aceita={tx.posicao(atual.posicao)} opcoes={j.opcoes} estrita foco={j.foco} temCarta={!!m.cartas[atual.chave]}
          podeDesfazer={m.podeDesfazer} onEscolher={j.escolher} onTirar={() => j.tirar(atual.chave)} onDesfazer={j.desfazer} onFechar={j.fechar}
          pegar={j.pegar} posicao={tx.posicao} atributo={tx.atributo} aviso={j.aviso} />
      )}
    </div>
  );
}

export function ElencoScreen({ elenco }: { elenco: string }) {
  const tx = useElencoText();
  const codigo = elencoDaRota(elenco);
  return (
    <>
      <div className="flair-section-head">
        <Link href="/flair/elencos" className="btn btn-sm"><UiIcon name="chevronLeft" size={18} />{tx.t("flair3d.elencos.back")}</Link>
        <PageHeader title={codigo ? tx.elenco(codigo) : tx.t("flair3d.elencos.title")} kicker={tx.t("flair3d.elencos.kicker")} />
      </div>
      {codigo ? <Elenco key={codigo} codigo={codigo} /> : <EmptyState title={tx.t("flair3d.elencos.notFound")} />}
    </>
  );
}
