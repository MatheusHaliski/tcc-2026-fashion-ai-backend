"use client";
/**
 * Acionamento pela pessoa, o único gesto com a carta que cada jogo permite fora da preparação (tabela "O que cada
 * carta faz na ação, e quando pode ser acionada"). Dress Fighter: entre os rounds, 1 carta Especial do deck por luta.
 * Fashion Sports: no segundo tempo, cada troca de peça é um lance. Fashion Detective: no mercado, deixar 1 carta fora do
 * look no balcão em troca de estalecas do caso. A janela abre quando o
 * servidor deixa a partida EM_ACAO; a pessoa aciona ou segue, e é o servidor que joga a etapa seguinte (e recusa com
 * 422 a carta que não é Especial, a segunda Especial e a troca que não cabe).
 */
import type { ApiError } from "@/lib/api/client";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { efeitoDaCor } from "@/lib/flair/nucleos/card-fx";
import type { AcionamentoTipo } from "@/lib/flair/nucleos/moments";
import type { EstadoDaLuta } from "@/lib/flair/nucleos/luta";
import type { EfeitoItem } from "@/lib/flair/nucleos/types";

/** Quanto o balcão do mercado paga pela carta, pelo nível dela (o servidor decide; aqui é só o rótulo). */
export const ESTALECAS_DO_NIVEL: Record<string, number> = { BRONZE: 100, PRATA: 200, OURO: 350, ESPECIAL: 500 };

export interface AcionamentoPedido {
  tipo: AcionamentoTipo;
  /** carta Especial acionada ou carta que entra na troca; sem carta, a partida só segue */
  cardId?: string;
  /** vaga da troca do intervalo */
  vaga?: string;
  /** Fashion Detective: o que a pessoa faz no passo ("IR:meio", "ABRIR:MESA_DA_RECEPCAO"...) */
  alvo?: string;
}

interface Props {
  tipo: "ESPECIAL" | "TROCA" | "MERCADO" | "JOGADA" | "LANCE";
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
  /** a ação que a cor da carta dispara ao entrar (Fashion Sports), quando o servidor deu uma */
  acaoDe?: (cardId: string) => string | null;
  /** os selos de cada carta: na jogada de cena, a ação que a cor dela dispara */
  itens?: (cardId: string) => EfeitoItem[] | undefined;
  /** a jogada de cena: a cor que a cena pede (vale +10) e a ação dela */
  pedidoDaCena?: { familia?: string; acao?: string };
  /** a luta do Dress Fighter: a carta do último lance (não repete) e a leitura do próximo golpe da oponente */
  luta?: EstadoDaLuta | null;
  /** ausente quando o servidor não aceita acionamento: o painel só explica */
  onAcionar?: (pedido: AcionamentoPedido) => void;
}

export function NucleoTrigger({ tipo, aberta, usado, cartas, vestidas, vagas, ocupado, erro, acaoDe, itens, pedidoDaCena, luta, onAcionar }: Props) {
  const tx = useNucleoText();
  const noLook = new Set(Object.values(vestidas));
  let opcoes: FlairCollectionCard[];
  if (tipo === "ESPECIAL") opcoes = cartas.filter((c) => c.tier === "ESPECIAL");
  else if (tipo === "MERCADO" || tipo === "JOGADA") opcoes = cartas.filter((c) => !noLook.has(c.id));
  // na luta a mão é o deck inteiro (a peça inteira também), menos a carta do lance anterior
  else if (tipo === "LANCE") opcoes = cartas.filter((c) => c.id !== luta?.ultimaCarta);
  else opcoes = cartas.filter((c) => vagas.includes(c.position) && vestidas[c.position] !== c.id);
  const pode = !!onAcionar && aberta && !usado && !ocupado;
  let aviso: string;
  if (!onAcionar) aviso = tx.t("flair3d.ui.trigger.unavailable");
  else if (ocupado) aviso = tx.t("flair3d.ui.trigger.sending");
  else if (usado) aviso = tx.t("flair3d.ui.trigger.used");
  else if (opcoes.length === 0) aviso = tx.t(`flair3d.ui.trigger.${tipo}.none`);
  else if (!aberta) aviso = tx.t(`flair3d.ui.trigger.${tipo}.wait`);
  else if (tipo === "JOGADA" && pedidoDaCena?.familia) {
    const { familia, acao = "" } = pedidoDaCena;
    aviso = tx.t("flair3d.ui.trigger.JOGADA.pede", { familia: tx.familiaCor(familia.toUpperCase()).toLowerCase(), acao: tx.ou(`flair3d.ui.efeito.COR_${acao}`, acao) });
  }
  else if (tipo === "LANCE" && luta?.proximo) aviso = tx.t("flair3d.ui.trigger.LANCE.leitura", { golpe: tx.ou(`flair3d.ui.golpe.${luta.proximo}`, luta.proximo) });
  else aviso = tx.t(`flair3d.ui.trigger.${tipo}.open`);

  const rotulo = (c: FlairCollectionCard) => {
    if (tipo === "ESPECIAL") return tx.t("flair3d.ui.trigger.ESPECIAL.use", { nome: c.name });
    if (tipo === "MERCADO") return tx.t("flair3d.ui.trigger.MERCADO.use", { nome: c.name, n: ESTALECAS_DO_NIVEL[c.tier] ?? 100 });
    if (tipo === "LANCE") return rotuloDoLance(tx, c, efeitoDaCor(itens?.(c.id)));
    if (tipo === "JOGADA") {
      const cor = efeitoDaCor(itens?.(c.id));
      return cor ? tx.t("flair3d.ui.trigger.JOGADA.use", { nome: c.name, acao: tx.efeito(cor) }) : tx.t("flair3d.ui.trigger.JOGADA.semCor", { nome: c.name });
    }
    const sai = cartas.find((x) => x.id === vestidas[c.position]);
    const vaga = tx.posicao(c.position);
    const troca = sai
      ? tx.t("flair3d.ui.trigger.TROCA.swap", { vaga, entra: c.name, sai: sai.name })
      : tx.t("flair3d.ui.trigger.TROCA.put", { vaga, entra: c.name });
    const acao = acaoDe?.(c.id);
    return acao ? tx.t("flair3d.ui.trigger.TROCA.action", { troca, acao }) : troca;
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
          <button type="button" className="btn btn-sm btn-primary" disabled={ocupado} onClick={() => onAcionar({ tipo })} data-n3d-seguir>
            {tx.t(tipo === "LANCE" ? "flair3d.ui.trigger.LANCE.skip" : "flair3d.ui.trigger.skip")}
          </button>
        )}
      </div>
    </section>
  );
}

/** O botão da carta na luta: o nome e o golpe da cor dela (a Especial é o golpe especial; sem cor de golpe, o básico). */
function rotuloDoLance(tx: ReturnType<typeof useNucleoText>, c: FlairCollectionCard, cor: EfeitoItem | null): string {
  const golpe = c.tier === "ESPECIAL" ? "ESPECIAL" : cor ? cor.codigo.replace(/^COR_/, "") : "GOLPE_BASICO";
  return tx.t("flair3d.ui.trigger.LANCE.use", { nome: c.name, golpe: tx.ou(`flair3d.ui.golpe.${golpe}`, golpe) });
}
