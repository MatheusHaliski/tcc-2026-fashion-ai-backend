"use client";
/**
 * O fim de um Desafio de Montagem dinâmico, dentro do modal de recompensa: "Parabéns, você completou!" e a fonte
 * inteira em movimento — o vídeo da cena (sem som, em laço, com controles, quadro cheio na proporção do próprio vídeo,
 * sem faixas) ou o símbolo FAI animado. Com "reduzir movimento", o vídeo não começa sozinho (fica o pôster) e o
 * símbolo fica parado. Cenário sem quebra-cabeça dinâmico: nada.
 */
import { useI18n } from "@/lib/i18n/i18n";
import { useMovimentoReduzido } from "@/components/flair/cenas/use-cena-viva";
import { QuebraCabecaVivo } from "@/components/flair/montagem/quebra-cabeca-vivo";
import { quebraCabecaDinamico } from "@/lib/flair/montagem/dinamico/catalogo";

export function MontagemFinal({ cenario, nome }: { cenario: string; nome: string }) {
  const { t } = useI18n();
  const reduzido = useMovimentoReduzido();
  const qc = quebraCabecaDinamico(cenario);
  if (!qc) return null;
  const proporcao = { ["--qc-ar" as string]: `${qc.largura / 100}` };
  return (
    <div className="qc-final" data-testid="montagem-final">
      <p className="type-h3">{t("cbc.dinamico.complete.title")}</p>
      {qc.fonte.tipo === "video" ? (
        <video key={reduzido ? "parado" : "tocando"} className="qc-final-video" style={proporcao} src={qc.fonte.src} poster={qc.fonte.poster}
          autoPlay={!reduzido} muted loop playsInline controls preload="auto" aria-label={t("cbc.dinamico.complete.video", { nome })}
          data-testid="montagem-video" />
      ) : (
        <div className="qc-final-logo" style={proporcao}><QuebraCabecaVivo qc={qc} completa /></div>
      )}
    </div>
  );
}
