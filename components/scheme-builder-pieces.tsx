"use client";
import { useState } from "react";
import { Pagination } from "@/components/ui";
import { mediaUrl } from "@/lib/api/client";
import { label } from "@/lib/api/taxonomy";
import type { PieceView } from "@/lib/api/types";

const PAGE_SIZE = 8;

function PieceCategory({ category, pieces, selected, onSelect }: {
  category: string;
  pieces: PieceView[];
  selected: { id: string }[];
  onSelect: (piece: PieceView) => void;
}) {
  const [page, setPage] = useState(0);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(pieces.length / PAGE_SIZE) - 1));
  const visible = pieces.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  return (
    <section className="mb-5">
      <h3 className="type-h3 mb-2">{label(category)}</h3>
      <div className="scheme-piece-catalog grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {visible.map((piece) => {
          const active = selected.some((item) => item.id === piece.id);
          const image = mediaUrl(piece.thumbnailUrl ?? piece.imageUrl);
          return <button key={piece.id} type="button" aria-pressed={active} onClick={() => onSelect(piece)} className={`min-w-0 overflow-hidden rounded-lg border p-1 text-left ${active ? "border-mark ring-2 ring-mark" : "border-line-soft"}`}>
            <span className="relative block aspect-square overflow-hidden rounded bg-surface-2">{image && <img src={image} alt="" loading="lazy" className="h-full w-full object-contain" />}{active && <span aria-hidden className="absolute right-1 top-1 rounded-full bg-ink px-1 text-surface">✓</span>}</span>
            <span className="mt-1 block truncate type-caption">{piece.name}</span>
          </button>;
        })}
      </div>
      {pieces.length > PAGE_SIZE && <Pagination page={currentPage} size={PAGE_SIZE} total={pieces.length} hasMore={(currentPage + 1) * PAGE_SIZE < pieces.length} onPage={setPage} />}
    </section>
  );
}

export function SchemeBuilderPieces({ lists, selected, onSelect }: {
  lists: Record<string, PieceView[]>;
  selected: { id: string }[];
  onSelect: (piece: PieceView) => void;
}) {
  return Object.entries(lists).map(([category, pieces]) => pieces.length > 0 && (
    <PieceCategory key={category} category={category} pieces={pieces} selected={selected} onSelect={onSelect} />
  ));
}
