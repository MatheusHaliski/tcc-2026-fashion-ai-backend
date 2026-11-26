"use client";
import type { ReactNode } from "react";

/**
 * Um grupo de opções: rótulo + mini cards selecionáveis em grade ("grid"; "wide" para cards com diagrama e texto) ou
 * uma linha que quebra ("row", para bolinhas de cor e chips curtos). Nunca rolagem lateral escondendo opções.
 */
export function OptionStrip({ title, hint, children, kind = "grid" }: { title: string; hint?: ReactNode; children: ReactNode; kind?: "grid" | "wide" | "row" }) {
  return (
    <div className="opt-group">
      <p className="label">{title}</p>
      {hint}
      <div className={kind === "row" ? "opt-row" : kind === "wide" ? "opt-grid is-wide" : "opt-grid"} role="group" aria-label={title}>{children}</div>
    </div>
  );
}
