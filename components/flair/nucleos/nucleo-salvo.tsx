"use client";
/**
 * "Salvo no servidor às 14:32: look em montagem." A linha diz o que o servidor confirmou por último nesta partida e a
 * que horas (lib/flair/nucleos/salvamento.ts). Sem confirmação do servidor, não aparece.
 */
import { useSyncExternalStore } from "react";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { useI18n } from "@/lib/i18n/i18n";
import { ouvirSalvamento, salvamentoAtual } from "@/lib/flair/nucleos/salvamento";

const NADA = () => null;

export function NucleoSalvo({ partida }: { partida?: string | null }) {
  const tx = useNucleoText();
  const { locale } = useI18n();
  const salvo = useSyncExternalStore(ouvirSalvamento, salvamentoAtual, NADA);
  if (!salvo || (partida && salvo.partida !== partida)) return null;
  const quando = new Date(salvo.quando);
  if (Number.isNaN(quando.getTime())) return null;
  const hora = new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(quando);
  return (
    <p className="n3d-salvo" role="status" data-testid="nucleo-salvo" data-salvo={salvo.oQue}>
      {tx.t("flair3d.ui.salvo.linha", { hora, oQue: tx.t(`flair3d.ui.salvo.oQue.${salvo.oQue}`) })}
    </p>
  );
}
