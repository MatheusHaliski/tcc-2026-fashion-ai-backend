"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { PieceSnapshot } from "@/components/piece-snapshot";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import type { PieceView, SchemeView } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { label, CATEGORY_LABEL } from "@/lib/api/taxonomy";
import { Badge, Button, ErrorState, Skeleton } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { SchemeCard } from "@/components/scheme-card";
import { BrandLogo } from "@/components/brand-logo";
import { CardActions } from "@/components/interactions";

/**
 * Modal de detalhe (RF7): clicar num esquema ou numa peça em qualquer lista abre o card SEMPRE AMPLIADO num modal,
 * com os dados completos, a barra social e o atalho para a página. Dentro do modal, uma peça da lista do esquema abre
 * o detalhe da peça e "voltar" retorna ao esquema (pilha de navegação).
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
  return (
    <DetailCtx.Provider value={value}>
      {children}
      {top && (
        <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div role="dialog" aria-modal="true" aria-label={top.kind === "scheme" ? t("detailModal.detalhe_do_esquema") : t("detailModal.detalhe_da_peca")} className="dialog dialog-xl">
            <div className="flex items-center gap-2 border-b border-line-soft px-4 py-2.5">
              {stack.length > 1 && <Button size="sm" onClick={back}>{t("detailModal.voltar")}</Button>}
              <p className="type-label text-muted flex-1">{top.kind === "scheme" ? t("detailModal.esquema_de_vestimenta_ampliado") : t("detailModal.peca_de_roupa_ampliada")}</p>
              <button type="button" className="btn btn-ghost btn-icon" aria-label={t("common.fechar")} onClick={close}>✕</button>
            </div>
            <div className="p-4">{top.kind === "scheme" ? <SchemeDetail key={top.id} id={top.id} onPiece={(pid) => openPiece(pid, top.id)} onClose={close} /> : <PieceDetail key={top.id} id={top.id} from={top.from} onScheme={openScheme} onClose={close} />}</div>
          </div>
        </div>
      )}
    </DetailCtx.Provider>
  );
}

function useDetail<T>(path: string) {
  const { user } = useAuth();
  const [state, setState] = useState<{ data: T | null; error: unknown; loading: boolean }>({ data: null, error: null, loading: true });
  useEffect(() => {
    const ctrl = new AbortController();
    api.get<T>(path, { signal: ctrl.signal, anonymous: !user }).then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => { if (!ctrl.signal.aborted) setState({ data: null, error, loading: false }); });
    return () => ctrl.abort();
  }, [path, user]);
  return state;
}

function SchemeDetail({ id, onPiece, onClose }: { id: string; onPiece: (id: string) => void; onClose: () => void }) {
  const { t, fmtMoney, relative, rich } = useI18n();
  const { data, error, loading } = useDetail<{ scheme: SchemeView; canEdit?: boolean }>(`/api/schemes/${id}`);
  if (error) return <ErrorState error={error as never} />;
  if (loading || !data) return <Skeleton className="h-96" />;
  const s = data.scheme;
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(320px,440px)_1fr]">
      <div className="detail-card-expanded"><ExpandedScheme scheme={s} onPiece={onPiece} /></div>
      <div className="min-w-0">
        <h2 className="type-h1 break-words">{s.title}</h2>
        <p className="type-body-sm text-muted">{rich("detailModal.por", { username: s.owner.username, relative: relative(s.publishedAt ?? s.createdAt), label: label(s.visibility.toLowerCase()) }, { 0: ($c) => <Link className="underline" href={`/u/${s.owner.username}`} onClick={onClose}>{$c}</Link> })}</p>
        {s.description && <p className="mt-2 type-body break-words">{s.description}</p>}
        <div className="mt-2 flex flex-wrap gap-1">{[...s.occasion, ...s.style].map((x) => <Badge key={x}>{label(x)}</Badge>)}{s.season && <Badge tone="thread">{label(s.season.toLowerCase())}</Badge>}{s.lookDoDia && <Badge tone="chalk">{t("lookbook.daily")}</Badge>}</div>
        <h3 className="type-h3 mt-4 mb-1">{t("scheme.pieces")} ({s.items.length}){s.totalPrice != null && <span className="ml-2 type-data text-muted">{fmtMoney(s.totalPrice, "BRL")}</span>}</h3>
        <ul className="divide-y divide-line-soft rounded-md border border-line-soft">{s.items.map((it) => (
          <li key={it.wardrobeItemId}>
            <button type="button" className="flex w-full min-w-0 items-center gap-3 p-2 text-left hover:bg-surface-2" onClick={() => onPiece(it.wardrobeItemId)}>
              <img src={mediaUrl(it.piece?.thumbnailUrl ?? it.piece?.imageUrl)} alt="" className="h-11 w-11 shrink-0 rounded object-contain bg-surface-2" />
              {it.piece?.brandName && <BrandLogo name={it.piece.brandName} src={it.piece.brandLogoUrl} size={24} />}
              <span className="min-w-0 flex-1"><span className="block truncate type-body">{it.piece?.name ?? it.slot}</span><span className="block truncate type-caption text-muted">{label(it.slot.toLowerCase())}{it.piece?.brandName ? ` · ${it.piece.brandName}` : ""}{it.piece?.price != null ? ` · ${fmtMoney(it.piece.price, "BRL")}` : ""}</span></span>
              <span className="type-caption text-muted">{t("detailModal.ver_peca")}</span>
            </button>
          </li>))}</ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/schemes/${s.id}`} className="btn" onClick={onClose}><FaiIcon id="SOC-10" size={24} decorative />{t("detailModal.abrir_pagina")}</Link>
          {data.canEdit && <Link href={`/schemes/${s.id}/edit`} className="btn" onClick={onClose}><FaiIcon id="SOC-11" size={24} decorative />{t("common.edit")}</Link>}
          <Link href={`/try-on?scheme=${s.id}`} className="btn" onClick={onClose}><FaiIcon id="NAV-07" size={24} decorative />{t("scheme.tryOn")}</Link>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3"><CardActions type="SCHEME" id={s.id} counters={s.counters} viewer={s.viewer} ownerId={s.owner.id} title={s.title} /><span className="type-caption text-muted tabular">{t("interactions.views", { value: s.counters.views ?? 0 })}</span></div>
      </div>
    </div>
  );
}

/** Card do esquema em versão ampliada: anatomia escolhida + lista completa de peças (clicáveis). */
function ExpandedScheme({ scheme, onPiece }: { scheme: SchemeView; onPiece: (id: string) => void }) {
  return <SchemeCard scheme={scheme} href={`/schemes/${scheme.id}`} expanded onPiece={onPiece} />;
}

function PieceDetail({ id, from, onScheme, onClose }: { id: string; from?: string; onScheme: (id: string) => void; onClose: () => void }) {
  const { t, fmtMoney } = useI18n(); const { user } = useAuth();
  const { data, error, loading } = useDetail<{ piece?: PieceView; originSchemes?: { schemeId: string; title: string; coverImageUrl?: string }[]; canEdit?: boolean; notAvailableAnymore?: boolean; snapshot?: Record<string, unknown> }>(`/api/pieces/${id}${from ? `?fromScheme=${from}` : ""}`);
  if (error) return <ErrorState error={error as never} />;
  if (loading || !data) return <Skeleton className="h-96" />;
  if (!data.piece) return data.snapshot ? <PieceSnapshot snapshot={data.snapshot} /> : <p className="type-body">{t("detailModal.esta_peca_nao_esta_mais")}</p>;
  const p = data.piece;
  const rows: [string, string | null | undefined][] = [[t("common.category"), CATEGORY_LABEL[p.category] ?? label(p.category)], [t("common.subcategory"), label(p.subcategory)], [t("auth.profileBrand"), p.brandName], [t("pieceForm.sexo"), label(p.sex?.toLowerCase())],
    [t("common.size"), p.size?.toUpperCase().replace(/^(BR|SHOE)_/, "")], [t("a11y.colorName"), label(p.color)], [t("common.material"), label(p.material?.toLowerCase())], [t("closet.state"), label(p.condition?.toLowerCase())], [t("room.usos_2"), String(p.wearCount)]];
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(300px,400px)_1fr]">
      <article className="fai-card detail-card-expanded" aria-label={p.name}>
        <div className="c-header"><span className="c-meta">@{p.owner.username}</span></div>
        <div className="c-photo" style={{ aspectRatio: "1" }}>{(p.imageUrl || p.thumbnailUrl) && <img src={mediaUrl(p.imageUrl ?? p.thumbnailUrl)} alt={p.name} style={{ objectFit: "contain", padding: 12 }} />}</div>
        <div className="c-title">{p.name}</div>
        <div className="c-row"><span className="k">{t("detailModal.categoria_marca_sexo_selos")}</span>{p.brandName && <BrandLogo name={p.brandName} src={p.brandLogoUrl} size={22} className="mr-1.5" />}{[CATEGORY_LABEL[p.category] ?? label(p.category), p.brandName, label(p.sex?.toLowerCase())].filter(Boolean).join(" · ")}{p.seals.length ? ` · ${p.seals.map(label).join(", ")}` : ""}</div>
        <div className="c-row"><span className="k">{t("detailModal.preco_ocasiao_estilo")}</span>{[p.price != null ? fmtMoney(p.price, "BRL") : null, p.occasion.map(label).join(", "), p.style.map(label).join(", ")].filter(Boolean).join(" · ")}</div>
        <div className="c-row"><span className="k">{t("detailModal.identificacao")}</span>{[p.name, p.size?.toUpperCase(), label(p.color), label(p.material?.toLowerCase()), label(p.subcategory)].filter(Boolean).join(" · ")}</div>
      </article>
      <div className="min-w-0">
        <h2 className="type-h1 break-words">{p.name}</h2>
        <p className="type-body-sm text-muted">{t("detailModal.de", { username: p.owner.username, value: p.price != null ? ` · ${fmtMoney(p.price, "BRL")}` : "", value2: !p.disponivel ? t("common.indisponivel") : "" })}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">{rows.filter(([, v]) => v).map(([k, v]) => <div key={k} className="min-w-0"><dt className="label">{k}</dt><dd className="type-body-sm truncate">{v}</dd></div>)}</dl>
        {(data.originSchemes ?? []).length > 0 && <><h3 className="type-h3 mt-4 mb-1">{t("common.looks_com_esta_peca")}</h3><ul className="flex flex-wrap gap-2">{data.originSchemes!.map((o) => <li key={o.schemeId}><button type="button" className="chip" onClick={() => onScheme(o.schemeId)}>{o.title} →</button></li>)}</ul></>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/pieces/${p.id}${from ? `?fromScheme=${from}` : ""}`} className="btn" onClick={onClose}><FaiIcon id="SOC-10" size={24} decorative />{t("detailModal.abrir_pagina")}</Link>
          {data.canEdit && <Link href={`/pieces/${p.id}?edit=1`} className="btn" onClick={onClose}><FaiIcon id="SOC-11" size={24} decorative />{t("common.edit")}</Link>}
          {user && !data.canEdit && <Link href={`/pieces/${p.id}`} className="btn" onClick={onClose}><FaiIcon id="ACT-06" size={24} decorative />{t("closet.addToWardrobe")}</Link>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3"><CardActions type="PIECE" id={p.id} counters={p.counters} viewer={p.viewer} ownerId={p.owner.id} title={p.name} /><span className="type-caption text-muted tabular">{t("interactions.views", { value: p.counters.views ?? 0 })}</span></div>
      </div>
    </div>
  );
}
