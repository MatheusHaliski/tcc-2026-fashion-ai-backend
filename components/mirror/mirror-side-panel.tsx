"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { FaiIcon } from "@/components/fai-icon";

/**
 * Painel lateral do Espelho (/mirror): o espelho ocupa a área inteira e cada painel abre por cima dele, num lado
 * (Vista-me à esquerda, controles à direita; no celular, na largura toda). Não é modal: o reflexo continua à vista e
 * reage a cada troca. O conteúdo fica montado mesmo fechado (o resultado do Vista-me e as peças fixadas não se perdem
 * ao fechar). Esc fecha e o foco volta ao botão que abriu.
 */
export function MirrorSidePanel({ id, label, icon, side = "right", children }: { id: string; label: string; icon: string; side?: "left" | "right"; children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); toggle.current?.focus(); };
  useEffect(() => { if (open) panel.current?.focus(); }, [open]);
  return (
    <>
      <button ref={toggle} type="button" className="btn mirror-panel-toggle" data-side={side} aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        <FaiIcon id={icon} size={20} className="ico-text" decorative />{label}
      </button>
      <aside id={id} ref={panel} tabIndex={-1} className="mirror-side-panel" data-side={side} hidden={!open} aria-label={label}
        onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}>
        <div className="mirror-side-panel-head">
          <h2 className="type-h3">{label}</h2>
          <button type="button" className="btn btn-ghost btn-icon" aria-label={t("mirror.painel.fechar_nome", { name: label })} title={t("mirror.painel.fechar_nome", { name: label })} onClick={close}>✕</button>
        </div>
        {children}
      </aside>
    </>
  );
}
