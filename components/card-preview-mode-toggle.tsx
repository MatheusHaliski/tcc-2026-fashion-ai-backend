"use client";

import type { ReactNode } from "react";

export type CardPreviewMode = "feed" | "expanded";

type CardPreviewModeToggleProps = {
  mode: CardPreviewMode;
  onModeChange: (mode: CardPreviewMode) => void;
  feedLabel: string;
  expandedLabel: string;
  children: ReactNode;
};

/** Alterna a mesma prévia entre o card do Feed e o card final ampliado. */
export function CardPreviewModeToggle({ mode, onModeChange, feedLabel, expandedLabel, children }: CardPreviewModeToggleProps) {
  const isExpanded = mode === "expanded";
  const nextMode = isExpanded ? "feed" : "expanded";
  const label = isExpanded ? feedLabel : expandedLabel;
  return (
    <div className="card-preview-mode" data-preview-mode={mode}>
      <button type="button" className="card-preview-mode-toggle" onClick={() => onModeChange(nextMode)} aria-pressed={isExpanded} aria-label={label} title={label}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {isExpanded ? <><path d="M8 3H3v5M3 3l6 6M16 21h5v-5M21 21l-6-6" /><path d="M3 16v5h5M3 21l6-6M21 8V3h-5M21 3l-6 6" /></> : <><path d="M8 3H3v5M3 3l6 6M16 21h5v-5M21 21l-6-6" /></>}
        </svg>
        <span className="sr-only">{label}</span>
      </button>
      {children}
    </div>
  );
}
