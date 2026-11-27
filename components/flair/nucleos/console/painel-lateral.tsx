"use client";
/**
 * Um painel lateral do palco de jogo (esquerda ou direita), com abas: translúcido sobre a cena em telas largas e
 * gaveta por cima dela em telas estreitas (só CSS). Fechado, vira só o botão da borda (o jogo também abre e fecha pelo
 * teclado: C e I no perfil console). Reutilizável: o jogo passa as abas e o conteúdo de cada uma.
 */
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { IconeConsole, type IconeConsoleNome } from "@/components/flair/nucleos/console/icone-console";
import type { Lado, PaineisLaterais } from "@/components/flair/nucleos/console/use-paineis-laterais";

export interface AbaDoPainel {
  id: string;
  nome: string;
  conteudo: ReactNode;
}

interface Props {
  lado: Lado;
  titulo: string;
  icone: IconeConsoleNome;
  /** a tecla que abre e fecha (mostrada no botão) */
  tecla: string;
  abas: AbaDoPainel[];
  paineis: PaineisLaterais;
}

export function PainelLateral({ lado, titulo, icone, tecla, abas, paineis }: Props) {
  const { t } = useI18n();
  const aberto = paineis.aberto[lado];
  const atual = abas.find((a) => a.id === paineis.aba[lado]) ?? abas[0];
  const rotulo = `${titulo} (${tecla})`;
  if (!aberto) {
    return (
      <button type="button" className={`cst-icone-btn cst-painel-alca is-${lado}`} onClick={() => paineis.alternar(lado)} aria-label={rotulo} title={rotulo} aria-expanded={false} data-testid={`painel-${lado}-abrir`}>
        <IconeConsole nome={icone} />
      </button>
    );
  }
  return (
    <aside className={`cst-painel is-${lado}`} aria-label={titulo} data-testid={`painel-${lado}`}>
      <header className="cst-painel-topo">
        <div role="tablist" aria-label={titulo} className="cst-painel-abas">
          {abas.map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={a.id === atual?.id} className={a.id === atual?.id ? "is-atual" : undefined} onClick={() => paineis.escolherAba(lado, a.id)} data-aba={a.id}>
              {a.nome}
            </button>
          ))}
        </div>
        <button type="button" className="cst-icone-btn" onClick={() => paineis.alternar(lado)} aria-label={t("flair3d.console.fechar")} title={t("flair3d.console.fechar")} aria-expanded>
          <IconeConsole nome="voltar" />
        </button>
      </header>
      <div className="cst-painel-corpo" role="tabpanel">{atual?.conteudo}</div>
    </aside>
  );
}
