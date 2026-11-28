"use client";
/**
 * O cartão de ajuda dos controles (tecla ?), no perfil console: cada tecla e o que ela faz, numa linha só. Reutilizável:
 * quem usa pode passar só as linhas que valem no jogo (`acoes`).
 */
import { useI18n } from "@/lib/i18n/i18n";
import { AJUDA_DO_CONSOLE } from "@/lib/flair/nucleos/controle/perfil-console";

interface Props {
  onFechar: () => void;
  /** as ações a mostrar (as chaves de AJUDA_DO_CONSOLE); sem ela, todas */
  acoes?: readonly string[];
  /** a chave do texto de uma ação, quando o jogo a usa de outro jeito (no Detective, F usa o recurso no alvo) */
  rotulos?: Partial<Record<string, string>>;
}

export function AjudaDeControles({ onFechar, acoes, rotulos }: Props) {
  const { t } = useI18n();
  const linhas = acoes ? AJUDA_DO_CONSOLE.filter((l) => acoes.includes(l.acao)) : AJUDA_DO_CONSOLE;
  return (
    <section className="cst-ajuda" role="dialog" aria-modal="false" aria-label={t("flair3d.console.ajuda.titulo")} data-testid="ajuda-de-controles">
      <header>
        <h2>{t("flair3d.console.ajuda.titulo")}</h2>
        <button type="button" className="btn btn-sm" onClick={onFechar}>{t("flair3d.console.fechar")}</button>
      </header>
      <dl>
        {linhas.map((l) => (
          <div key={l.acao} data-acao={l.acao}>
            <dt>{l.teclas.map((k) => <kbd key={k}>{k}</kbd>)}</dt>
            <dd>{t(rotulos?.[l.acao] ?? `flair3d.console.acao.${l.acao}`)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
