"use client";
/**
 * A roda de recursos da partida (regra peça-recurso), no canto direito do palco: os medidores de vida, energia e foco
 * (0 a 100) e as moedas, e as peças do deck que ainda podem ser usadas como recurso. Usar uma peça faz o medidor subir
 * na hora com "+25 Vida"; a peça gasta fica apagada. Cada medidor é um `meter` para o leitor de tela.
 */
import type { CSSProperties } from "react";
import { cn } from "@/components/ui";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { RecursosNaTela } from "@/components/flair/nucleos/recursos/use-recursos-da-partida";
import { COM_TETO, COR_DO_RECURSO, RECURSOS } from "@/lib/flair/recursos/types";

interface Props {
  recursos: RecursosNaTela;
  reduzido: boolean;
  efeitos: boolean;
}

export function NucleoRodaRecursos({ recursos, reduzido, efeitos }: Props) {
  const tx = useNucleoText();
  const { estado, pecas, ganho, ocupado, erro, usar } = recursos;
  if (!estado) return null;
  const nome = (r: string) => tx.t(`flair3d.ui.recurso.${r}`);
  return (
    <section className={cn("n3d-recursos", (reduzido || !efeitos) && "is-calm")} aria-label={tx.t("flair3d.ui.recurso.titulo")} data-testid="nucleo-roda-recursos">
      <ul className="n3d-recursos-medidores">
        {RECURSOS.map((r) => {
          const valor = estado.recursos[r] ?? 0;
          const comTeto = COM_TETO.includes(r);
          return (
            <li key={r} className={cn("n3d-recurso", ganho?.recurso === r && "is-up")} style={{ "--n3d-recurso-cor": COR_DO_RECURSO[r], "--n3d-recurso-nivel": `${comTeto ? valor : 100}%` } as CSSProperties} data-recurso={r}>
              <span className="n3d-recurso-nome">{nome(r)}</span>
              {comTeto ? (
                <span role="meter" aria-label={nome(r)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={valor} className="n3d-recurso-barra"><span className="n3d-recurso-cheio" /></span>
              ) : null}
              <span className="n3d-recurso-valor">{valor}</span>
              {ganho?.recurso === r && <span key={ganho.chave} className="n3d-recurso-ganho" aria-hidden data-testid="nucleo-recurso-ganho">+{ganho.quantidade}</span>}
            </li>
          );
        })}
      </ul>
      {pecas.length > 0 && (
        <ul className="n3d-recursos-pecas" aria-label={tx.t("flair3d.ui.recurso.pecas")}>
          {pecas.map((p) => (
            <li key={p.cardId}>
              <button type="button" className="n3d-recurso-usar" disabled={ocupado || p.restantes === 0} onClick={() => usar(p.cardId)} data-card={p.cardId}>
                {tx.t("flair3d.ui.recurso.usar", { peca: p.nome, quantidade: p.quantidade, recurso: nome(p.recurso), restantes: p.restantes })}
              </button>
            </li>
          ))}
        </ul>
      )}
      {erro && <p className="n3d-recurso-erro" role="alert">{erro}</p>}
      <p className="sr-only" role="status">{ganho ? tx.t("flair3d.ui.recurso.ganhou", { quantidade: ganho.quantidade, recurso: nome(ganho.recurso) }) : ""}</p>
    </section>
  );
}
