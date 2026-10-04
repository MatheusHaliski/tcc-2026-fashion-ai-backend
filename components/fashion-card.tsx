"use client";
import { createContext, useCallback, useContext, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/components/ui";

/**
 * Card com frente e verso (FashionCard). A FRENTE é identidade + moda + social (o card de sempre); o VERSO é dados +
 * contexto + evolução (Hype). Regras:
 *
 * <ul>
 *   <li>só o botão ↻ vira o card — tocar na foto abre o detalhe, curtir curte, salvar salva;</li>
 *   <li>o estado é local e visual (não persiste): cada card vira sozinho e volta para a frente ao sair da tela;</li>
 *   <li>a face escondida fica {@code inert} (fora do Tab e do leitor de tela) e o foco acompanha o giro;</li>
 *   <li>o verso só é montado no primeiro giro (grades longas não pagam pela análise de todos os cards);</li>
 *   <li>CSS {@code rotateY} com {@code preserve-3d}/{@code backface-visibility}; com movimento reduzido vira uma troca simples.</li>
 * </ul>
 */
interface FlipCtx {
  flipped: boolean;
  /** o verso já foi aberto alguma vez (montado sob demanda e mantido depois) */
  mounted: boolean;
  flip: (toBack: boolean) => void;
  backId: string;
  name: string;
  register: (side: "front" | "back", el: HTMLButtonElement | null) => void;
}
const Ctx = createContext<FlipCtx | null>(null);
export const useCardFlip = () => useContext(Ctx);

export function FashionCard({ name, children, className }: { name: string; children: ReactNode; className?: string }) {
  const [flipped, setFlipped] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttons = useRef<{ front: HTMLButtonElement | null; back: HTMLButtonElement | null }>({ front: null, back: null });
  const backId = useId();
  const flip = useCallback((toBack: boolean) => {
    if (toBack) setMounted(true);
    setFlipped(toBack);
    // o foco segue o giro: o botão da face que aparece (o da outra face fica inert)
    const next = () => buttons.current[toBack ? "back" : "front"]?.focus({ preventScroll: true });
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(next); else setTimeout(next, 0);
  }, []);
  const register = useCallback((side: "front" | "back", el: HTMLButtonElement | null) => { buttons.current[side] = el; }, []);
  const value = useMemo(() => ({ flipped, mounted, flip, backId, name, register }), [flipped, mounted, flip, backId, name, register]);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && flipped && !(e.target as HTMLElement).closest?.('[role="dialog"]')) { e.stopPropagation(); flip(false); }
  };
  return (
    <Ctx.Provider value={value}>
      <div className={cn("fcard", flipped && "is-flipped", className)} data-flipped={flipped ? "back" : "front"} data-back-mounted={mounted || undefined} onKeyDown={onKeyDown}>
        <div className="fcard-inner">{children}</div>
      </div>
    </Ctx.Provider>
  );
}

export function FashionCardFront({ children }: { children: ReactNode }) {
  const ctx = useCardFlip();
  const hidden = !!ctx?.flipped;
  return <div className="fcard-face is-front" inert={hidden || undefined} aria-hidden={hidden || undefined}>{children}</div>;
}

export function FashionCardBack({ children }: { children: ReactNode }) {
  const ctx = useCardFlip();
  const { t } = useI18n();
  const hidden = !ctx?.flipped;
  return (
    <div id={ctx?.backId} className="fcard-face is-back" role="region" aria-label={t("hype.card.back_label", { name: ctx?.name ?? "" })}
      inert={hidden || undefined} aria-hidden={hidden || undefined}>
      {ctx?.mounted ? children : null}
    </div>
  );
}

/** Botão ↻ de virar o card (um em cada face). Não é um interruptor de configuração: é uma ação de navegação do card. */
export function CardFlipButton({ side, className, showLabel }: { side: "front" | "back"; className?: string; showLabel?: boolean }) {
  const ctx = useCardFlip();
  const { t } = useI18n();
  if (!ctx) return null;
  const label = side === "front" ? t("hype.card.flip_to_back", { name: ctx.name }) : t("hype.card.flip_to_front", { name: ctx.name });
  return (
    <button type="button" ref={(el) => ctx.register(side, el)} className={cn("card-flip-btn", showLabel && "has-label", className)} aria-label={label} title={label}
      aria-controls={ctx.backId} data-side={side}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); ctx.flip(side === "front"); }}>
      <span aria-hidden className="card-flip-icon">↻</span>
      {showLabel && <span aria-hidden>{side === "front" ? t("hype.card.see_hype") : t("hype.card.see_front")}</span>}
    </button>
  );
}
