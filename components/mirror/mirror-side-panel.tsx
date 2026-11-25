"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { FaiIcon } from "@/components/fai-icon";

/**
 * Painel lateral do Espelho (/mirror): o espelho ocupa a área inteira e os controles abrem por cima dele, à direita
 * (no celular, na largura toda). Não é modal: o reflexo continua à vista e reage a cada troca. O conteúdo fica montado
 * mesmo fechado (o resultado do Vista-me e as peças fixadas não se perdem ao fechar). Esc fecha e o foco volta ao botão.
 */
export function MirrorSidePanel({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); toggle.current?.focus(); };
  useEffect(() => { if (open) panel.current?.focus(); }, [open]);
  return (
    <>
      <button ref={toggle} type="button" className="btn mirror-panel-toggle" aria-expanded={open} aria-controls="mirror-panel" onClick={() => setOpen((v) => !v)}>
        <FaiIcon id="NAV-14" size={20} className="ico-text" decorative />{t("mirror.painel.abrir")}
      </button>
      <aside id="mirror-panel" ref={panel} tabIndex={-1} className="mirror-side-panel" hidden={!open} aria-label={t("mirror.painel.abrir")}
        onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}>
        <div className="mirror-side-panel-head">
          <h2 className="type-h3">{t("mirror.painel.abrir")}</h2>
          <button type="button" className="btn btn-ghost btn-icon" aria-label={t("mirror.painel.fechar")} title={t("mirror.painel.fechar")} onClick={close}>✕</button>
        </div>
        {children}
      </aside>
    </>
  );
}
