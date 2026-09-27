"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { FOCUSABLE } from "@/components/ui";
import { ExpandedPiece, ExpandedScheme } from "@/components/expanded-card";

/**
 * Modal de detalhe (RF7.CA07): clicar num esquema ou numa peça em qualquer lista abre o card SEMPRE AMPLIADO num modal
 * único — a borda do card é a borda do modal, sem nada ao lado. Dentro do modal, uma peça da lista do esquema abre a
 * peça ampliada e "voltar" retorna ao esquema (pilha de navegação).
 *
 * Teclado: ao abrir, o foco vai para o próprio diálogo (o leitor de tela anuncia o nome dele e o primeiro Tab chega no
 * primeiro controle); Tab e Shift+Tab ficam presos dentro dele; Esc fecha; ao fechar, o foco volta para quem abriu (o
 * nome da peça no card). Diálogos abertos por cima (editar dados, arte, imagem) cuidam do próprio foco e Esc.
 */
type Target = { kind: "scheme" | "piece"; id: string; from?: string };
/** Controles alcançáveis por Tab dentro do modal (fora dos diálogos abertos por cima dele). */
const focusables = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLElement>(`${FOCUSABLE}, summary`))
  .filter((x) => x.tabIndex >= 0 && x.getClientRects().length > 0 && x.closest('[role="dialog"]') === el);
interface Ctx { openScheme: (id: string) => void; openPiece: (id: string, fromScheme?: string) => void; }
const DetailCtx = createContext<Ctx | null>(null);
export const useDetailModal = () => useContext(DetailCtx);

export function DetailModalProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [stack, setStack] = useState<Target[]>([]);
  const openScheme = useCallback((id: string) => setStack((s) => [...s, { kind: "scheme", id }]), []);
  const openPiece = useCallback((id: string, fromScheme?: string) => setStack((s) => [...s, { kind: "piece", id, from: fromScheme }]), []);
  const close = useCallback(() => setStack([]), []);
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const value = useMemo(() => ({ openScheme, openPiece }), [openScheme, openPiece]);
  const top = stack[stack.length - 1];
  const dialogRef = useRef<HTMLDivElement>(null);
  const isOpen = !!top;
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    return () => { if (opener && document.contains(opener)) opener.focus({ preventScroll: true }); };
  }, [isOpen]);
  // abrir, voltar ou abrir a peça de dentro do look: o foco vai para o diálogo (conteúdo novo, anunciado pelo nome)
  useEffect(() => { if (top) dialogRef.current?.focus({ preventScroll: true }); }, [top?.kind, top?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const trap = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || e.defaultPrevented) return;
    const el = dialogRef.current; if (!el) return;
    const list = focusables(el);
    if (!list.length) { e.preventDefault(); return; }
    const first = list[0], last = list[list.length - 1]; const active = document.activeElement;
    if (e.shiftKey && (active === first || active === el)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };
  useEffect(() => {
    if (!top) return;
    // Esc fecha o modal — menos quando é para fechar um menu ou lista aberta dentro dele (eles cuidam do próprio Esc)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[role="menu"], [role="listbox"]') || dialogRef.current?.querySelector('[aria-haspopup][aria-expanded="true"]')) return;
      close();
    };
    // o foco não escapa: se sair do modal (clique fora do conteúdo, Tab vindo de fora), volta para ele
    const onFocus = (e: FocusEvent) => {
      const el = dialogRef.current; const target = e.target as HTMLElement | null;
      if (!el || !target || el.contains(target) || target.closest?.('[role="dialog"]')) return;
      (focusables(el)[0] ?? el).focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKey); document.addEventListener("focusin", onFocus);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("focusin", onFocus); document.body.style.overflow = prev; };
  }, [top, close]);
  // voltar (peça → look de origem) e fechar ficam no cabeçalho do próprio card: a borda do card é a borda do modal
  const controls = (
    <span className="c-modal-controls">
      {stack.length > 1 && <button type="button" className="btn btn-ghost btn-icon" aria-label={t("detailModal.voltar")} title={t("detailModal.voltar")} onClick={back}>←</button>}
      <button type="button" className="btn btn-ghost btn-icon" aria-label={t("common.fechar")} title={t("common.fechar")} onClick={close}>✕</button>
    </span>
  );
  return (
    <DetailCtx.Provider value={value}>
      {children}
      {top && (
        <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div ref={dialogRef} tabIndex={-1} onKeyDown={trap} role="dialog" aria-modal="true" aria-label={top.kind === "scheme" ? t("detailModal.detalhe_do_esquema") : t("detailModal.detalhe_da_peca")} className={`dialog dialog-card ${top.kind === "piece" ? "is-piece" : ""}`}>
            {top.kind === "scheme"
              ? <ExpandedScheme key={top.id} id={top.id} headerExtra={controls} />
              : <ExpandedPiece key={top.id} id={top.id} from={top.from} headerExtra={controls} onScheme={openScheme} />}
          </div>
        </div>
      )}
    </DetailCtx.Provider>
  );
}
