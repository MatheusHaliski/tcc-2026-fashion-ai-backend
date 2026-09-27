"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { ExpandedPiece, ExpandedScheme } from "@/components/expanded-card";

/**
 * Modal de detalhe (RF7.CA07): clicar num esquema ou numa peça em qualquer lista abre o card SEMPRE AMPLIADO num modal
 * único — a borda do card é a borda do modal, sem nada ao lado. Dentro do modal, uma peça da lista do esquema abre a
 * peça ampliada e "voltar" retorna ao esquema (pilha de navegação).
 */
type Target = { kind: "scheme" | "piece"; id: string; from?: string };
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
  useEffect(() => {
    if (!top) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
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
          <div role="dialog" aria-modal="true" aria-label={top.kind === "scheme" ? t("detailModal.detalhe_do_esquema") : t("detailModal.detalhe_da_peca")} className={`dialog dialog-card ${top.kind === "piece" ? "is-piece" : ""}`}>
            {top.kind === "scheme"
              ? <ExpandedScheme key={top.id} id={top.id} headerExtra={controls} />
              : <ExpandedPiece key={top.id} id={top.id} from={top.from} headerExtra={controls} onScheme={openScheme} />}
          </div>
        </div>
      )}
    </DetailCtx.Provider>
  );
}
