"use client";
/**
 * Acionamento pela pessoa, o único gesto com a carta que cada jogo permite fora da preparação (tabela "O que cada
 * carta faz na ação, e quando pode ser acionada"). Dress Fighter: entre os rounds, 1 carta Especial do deck por luta.
 * Fashion Sports: no intervalo, trocar no máximo 1 peça por uma carta do deck da mesma posição. A janela abre quando o
 * servidor deixa a partida EM_ACAO; a pessoa aciona ou segue, e é o servidor que joga a etapa seguinte (e recusa com
 * 422 a carta que não é Especial, a segunda Especial e a troca que não cabe).
 */
import type { ApiError } from "@/lib/api/client";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { AcionamentoTipo } from "@/lib/flair/nucleos/moments";

export interface AcionamentoPedido {
  tipo: AcionamentoTipo;
  /** carta Especial acionada ou carta que entra na troca; sem carta, a partida só segue */
  cardId?: string;
  /** vaga da troca do intervalo */
  vaga?: string;
}

interface Props {
  tipo: "ESPECIAL" | "TROCA";
  /** a janela do acionamento está aberta neste ponto da ação */
  aberta: boolean;
  /** já foi usado nesta partida (1 por luta, 1 por intervalo) */
  usado: boolean;
  /** cartas do deck da partida */
  cartas: FlairCollectionCard[];
  /** cartas vestidas por vaga (o look em cena) */
  vestidas: Record<string, string>;
  /** vagas do jogo (a troca só vale na vaga da posição da carta) */
  vagas: string[];
  /** o servidor está respondendo um acionamento */
  ocupado: boolean;
  /** recusa do servidor ao último acionamento */
  erro: ApiError | null;
  /** ausente quando o servidor não aceita acionamento: o painel só explica */
  onAcionar?: (pedido: AcionamentoPedido) => void;
}

export function NucleoTrigger({ tipo, aberta, usado, cartas, vestidas, vagas, ocupado, erro, onAcionar }: Props) {
  const tx = useNucleoText();
  const opcoes = tipo === "ESPECIAL"
    ? cartas.filter((c) => c.tier === "ESPECIAL")
    : cartas.filter((c) => vagas.includes(c.position) && vestidas[c.position] !== c.id);
  const pode = !!onAcionar && aberta && !usado && !ocupado;
  let aviso: string;
  if (!onAcionar) aviso = tx.t("flair3d.ui.trigger.unavailable");
  else if (ocupado) aviso = tx.t("flair3d.ui.trigger.sending");
  else if (usado) aviso = tx.t("flair3d.ui.trigger.used");
  else if (opcoes.length === 0) aviso = tx.t(`flair3d.ui.trigger.${tipo}.none`);
  else if (!aberta) aviso = tx.t(`flair3d.ui.trigger.${tipo}.wait`);
  else aviso = tx.t(`flair3d.ui.trigger.${tipo}.open`);

  const rotulo = (c: FlairCollectionCard) => {
    if (tipo === "ESPECIAL") return tx.t("flair3d.ui.trigger.ESPECIAL.use", { nome: c.name });
    const sai = cartas.find((x) => x.id === vestidas[c.position]);
    const vaga = tx.posicao(c.position);
    return sai
      ? tx.t("flair3d.ui.trigger.TROCA.swap", { vaga, entra: c.name, sai: sai.name })
      : tx.t("flair3d.ui.trigger.TROCA.put", { vaga, entra: c.name });
  };
  const pedido = (c: FlairCollectionCard): AcionamentoPedido => (tipo === "TROCA" ? { tipo, cardId: c.id, vaga: c.position } : { tipo, cardId: c.id });

  return (
    <section className="n3d-trigger" aria-label={tx.t("flair3d.ui.trigger.title")} data-testid="nucleo-trigger" data-open={aberta || undefined}>
      <h3 className="type-label">{tx.t(`flair3d.ui.trigger.${tipo}.name`)}</h3>
      <p className="n3d-trigger-note" role="status">{aviso}</p>
      {erro && (
        <p className="n3d-error" role="alert">
          {tx.ou(`flair3d.ui.trigger.error.${erro.code}`, tx.t("flair3d.ui.trigger.error.default", { msg: erro.message }))}
        </p>
      )}
      <div className="n3d-trigger-actions">
        {opcoes.map((c) => (
          <button key={c.id} type="button" className="btn btn-sm" disabled={!pode} onClick={() => onAcionar?.(pedido(c))}>
            {rotulo(c)}
          </button>
        ))}
        {aberta && onAcionar && (
          <button type="button" className="btn btn-sm btn-primary" disabled={ocupado} onClick={() => onAcionar({ tipo })}>
            {tx.t("flair3d.ui.trigger.skip")}
          </button>
        )}
      </div>
    </section>
  );
}
