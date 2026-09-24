"use client";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";

/**
 * Fim da lista (RF8.CA06): quando o usuário rola até aqui, carrega a próxima página pelo cursor. O botão continua
 * disponível como alternativa acessível (teclado/leitor de tela) e para quando o IntersectionObserver não existe.
 */
export function InfiniteSentinel({ hasMore, loading, onMore, label = "Carregar mais" }: { hasMore: boolean; loading: boolean; onMore: () => void; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const more = useRef(onMore); more.current = onMore;
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore || loading || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) more.current(); }, { rootMargin: "320px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading]);
  if (!hasMore) return null;
  return <div ref={ref} className="mt-6 flex justify-center" aria-live="polite"><Button onClick={onMore} loading={loading}>{label}</Button></div>;
}

/** Junta páginas sem repetir itens já vistos (mesmo id). */
export function mergeById<T extends { id?: string | null }>(prev: T[], next: T[]): T[] {
  const seen = new Set(prev.map((x) => x.id)); return [...prev, ...next.filter((x) => !x.id || !seen.has(x.id))];
}
