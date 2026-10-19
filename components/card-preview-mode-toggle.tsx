"use client";

import type { ReactNode } from "react";

type Props = {
  expanded: boolean;
  onToggle: () => void;
  feedLabel: string;
  expandedLabel: string;
  children: ReactNode;
};

/** Alterna a mesma prévia entre o card do Feed e o card final ampliado. */
export function CardPreviewModeToggle({ expanded, onToggle, feedLabel, expandedLabel, children }: Props) {
  const label = expanded ? feedLabel : expandedLabel;
  return (
    <div className="card-preview-mode">
      <button type="button" className="card-preview-mode-toggle" onClick={onToggle} aria-label={label} title={label}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {expanded ? <><path d="M8 3H3v5M3 3l6 6M16 21h5v-5M21 21l-6-6" /><path d="M3 16v5h5M3 21l6-6M21 8V3h-5M21 3l-6 6" /></> : <><path d="M8 3H3v5M3 3l6 6M16 21h5v-5M21 21l-6-6" /></>}
        </svg>
        <span className="sr-only">{label}</span>
      </button>
      {children}
    </div>
  );
}
