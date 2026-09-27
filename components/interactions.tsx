"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, mediaUrl } from "@/lib/api/client";
import type { Counters, UserCard, ViewerState } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { Avatar, Button, Dialog, Textarea, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";

type TargetType = "SCHEME" | "PIECE" | "COMMENT" | "DNA_SCHEME";
interface Comment { id: string; author?: UserCard; user?: UserCard; content: string; createdAt: string; parentId?: string | null; parentCommentId?: string | null; replies?: Comment[]; canDelete?: boolean; }
const REACTIONS: { id: "TREND" | "ELEGANTE" | "CRIATIVO"; icon: string }[] = [{ id: "TREND", icon: "SOC-07" }, { id: "ELEGANTE", icon: "SOC-08" }, { id: "CRIATIVO", icon: "SOC-09" }];

/** Barra social (RF19) do detalhe fora de um card (ex.: DNA de estilo): a mesma linha de ações, com as reações. */
export function InteractionBar({ type, id, counters, viewer, ownerId, title }: { type: TargetType; id: string; counters?: Counters; viewer?: ViewerState; onChange?: () => void; remixHref?: string; ownerId?: string; title?: string }) {
  if (type === "COMMENT") return null;
  return <CardActions type={type} id={id} counters={counters} viewer={viewer} ownerId={ownerId} title={title} reactions />;
}

/** Compartilhar (RF19): copiar o link ou publicar no feed, com legenda opcional. */
export function ShareDialog({ type, id, open, onClose, onShared }: { type: TargetType; id: string; open: boolean; onClose: () => void; onShared?: () => void }) {
  const { t } = useI18n(); const { user } = useAuth(); const toast = useToast(); const router = useRouter();
  const [caption, setCaption] = useState("");
  async function doShare(channel: string) {
    if (!user) { router.push("/login"); return; }
    try {
      const r = await api.post<{ url?: string; link?: string }>(`/api/interactions/${type}/${id}/shares`, { channel, caption });
      const url = r.url ?? r.link ?? `${window.location.origin}/${type === "PIECE" ? "pieces" : "schemes"}/${id}`;
      if (channel === "EXTERNAL") { await navigator.clipboard.writeText(url); toast.success(t("common.copied")); } else toast.success(t("interactions.sharedToFeed"));
      onClose(); onShared?.();
    } catch (e) { toast.fromError(e); }
  }
  return (
    <Dialog open={open} onClose={onClose} title={t("common.share")} footer={<><Button onClick={() => doShare("EXTERNAL")}>{t("interactions.copyLink")}</Button><Button variant="primary" onClick={() => doShare("FEED")}>{t("interactions.shareToFeed")}</Button></>}>
      <label htmlFor={`share-caption-${id}`} className="label">{t("interactions.legenda_opcional")}</label>
      <Textarea id={`share-caption-${id}`} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} />
    </Dialog>
  );
}

/** Glifos das ações sociais (traço 1,8 px, 24×24): contorno no estado normal, preenchido quando ativo. */
const SOCIAL_PATHS = {
  heart: "M12 20.3s-7.3-4.5-9.3-9.2C1.4 8 3.3 4.6 6.7 4.3c2.1-.2 3.9.9 5.3 2.8 1.4-1.9 3.2-3 5.3-2.8 3.4.3 5.3 3.7 4 6.8-2 4.7-9.3 9.2-9.3 9.2z",
  comment: "M20.5 11.6a8.1 8.1 0 0 1-11.9 7.1L3.5 20l1.4-4.7a8.1 8.1 0 1 1 15.6-3.7z",
  share: "M21 3 10.2 13.8M21 3l-6.7 18-4.1-7.2L3 9.7 21 3z",
  bookmark: "M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.6-6.5 4.6v-16a1 1 0 0 1 1-1z",
} as const;
export type SocialIconName = keyof typeof SOCIAL_PATHS;
export function SocialIcon({ name, filled, size = 22 }: { name: SocialIconName; filled?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false" className="c-act-icon"
      fill={filled && name !== "share" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">
      <path d={SOCIAL_PATHS[name]} />
    </svg>
  );
}

/** Remixar (RF19.CA13): cria a própria versão do look; peça entra como semente de um look novo. */
export function useRemix(type: TargetType, id: string) {
  const { t } = useI18n(); const { user } = useAuth(); const toast = useToast(); const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remix() {
    if (!user) { router.push("/login"); return; }
    if (busy) return; setBusy(true);
    try { const r = await api.post<{ scheme?: { id: string }; id?: string }>(`/api/interactions/${type}/${id}/remixes`); toast.success(t("interactions.remixDone")); const nid = r.scheme?.id ?? r.id; if (nid) router.push(type === "PIECE" ? `/pieces/${nid}` : `/schemes/${nid}`); } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  return { remix, busy };
}

/**
 * Ações do post (RF7.CA11 · RF19) — uma linha só, igual em todo card: curtir, comentar e compartilhar à esquerda, cada
 * ícone com a sua contagem ao lado; salvar à direita. Todos com o mesmo tamanho (ícone 22 px), a mesma área de toque
 * (44 px em tela de toque), nome acessível com a contagem e estado (aria-pressed) — curtido e salvo ficam preenchidos.
 * Não existe linha "N curtidas" separada: cada número aparece uma vez, junto da ação. Reações (Trend, Elegante,
 * Criativo) são detalhe: aparecem como etiquetas com texto só no detalhe (`reactions`).
 */
export function CardActions({ type, id, counters, viewer, title, compact, extra, reactions, preview }: { type: "SCHEME" | "PIECE" | "DNA_SCHEME"; id: string; counters?: Counters; viewer?: ViewerState; ownerId?: string; title?: string; compact?: boolean; extra?: React.ReactNode; reactions?: boolean; preview?: boolean;
  /** compatibilidade: salvar agora está sempre na linha */ withSave?: boolean; with3d?: boolean }) {
  const { t, fmtNumber } = useI18n(); const { user } = useAuth(); const toast = useToast(); const router = useRouter();
  const [liked, setLiked] = useState(!!viewer?.liked); const [likes, setLikes] = useState(counters?.likes ?? 0);
  const [saved, setSaved] = useState(!!viewer?.saved);
  const [mine3, setMine3] = useState<string[]>(viewer?.reactions ?? []); const [rx, setRx] = useState<Record<string, number>>(counters?.reactions ?? {});
  const [comments, setComments] = useState(false); const [share, setShare] = useState(false);
  useEffect(() => { setLiked(!!viewer?.liked); setLikes(counters?.likes ?? 0); setSaved(!!viewer?.saved); }, [viewer?.liked, counters?.likes, viewer?.saved]);
  useEffect(() => { setMine3(viewer?.reactions ?? []); setRx(counters?.reactions ?? {}); }, [JSON.stringify(viewer?.reactions), JSON.stringify(counters?.reactions)]); // eslint-disable-line react-hooks/exhaustive-deps
  const base = `/api/interactions/${type}/${id}`;
  const guard = () => { if (!user) { router.push("/login"); return false; } return true; };
  async function optimistic(apply: () => void, undo: () => void, call: () => Promise<unknown>) {
    if (!guard()) return;
    apply();
    try { await call(); } catch (e) { undo(); toast.fromError(e); }
  }
  const like = () => { const was = liked; optimistic(() => { setLiked(!was); setLikes((n) => n + (was ? -1 : 1)); }, () => { setLiked(was); setLikes((n) => n + (was ? 1 : -1)); }, () => api.post(`${base}/reactions`, { reaction: "LIKE" })); };
  const react = (r: string) => {
    const was = mine3.includes(r);
    const apply = (on: boolean) => { setMine3((l) => (on ? [...l, r] : l.filter((x) => x !== r))); setRx((m) => ({ ...m, [r]: Math.max(0, (m[r] ?? 0) + (on ? 1 : -1)) })); };
    optimistic(() => apply(!was), () => apply(was), () => api.post(`${base}/reactions`, { reaction: r }));
  };
  const save = () => { const was = saved; optimistic(() => { setSaved(!was); toast.success(was ? t("anatomy.menu.unsaved") : t("anatomy.menu.saved")); }, () => setSaved(was), () => api.post(`${base}/saves`)); };
  // no card, números grandes sem decimal ("1 mil"), para a linha caber em 2 colunas no celular; no detalhe, "1,2 mil"
  const n = (v: number) => fmtNumber(v, { notation: "compact", maximumFractionDigits: compact ? 0 : 1 });
  const commentsN = counters?.comments ?? 0, sharesN = counters?.shares ?? 0;
  const act = (key: string, icon: SocialIconName, label: string, onClick: () => void, opts: { pressed?: boolean; count?: number; haspopup?: boolean } = {}) => (
    <button key={key} type="button" className={`c-act is-${key}`} aria-pressed={opts.pressed} aria-haspopup={opts.haspopup ? "dialog" : undefined} aria-label={label} title={label}
      onClick={preview ? undefined : onClick} disabled={preview} tabIndex={preview ? -1 : undefined}>
      <SocialIcon name={icon} filled={opts.pressed} />
      {opts.count !== undefined && <span className="c-act-n tabular" aria-hidden>{n(opts.count)}</span>}
    </button>
  );
  return (
    <div className={`c-post ${compact ? "is-compact" : ""} ${preview ? "is-preview" : ""}`}>
      <div className="c-actions" role="group" aria-label={t("interactions.interacoes")}>
        {act("like", "heart", t("interactions.like_n", { count: likes }), like, { pressed: liked, count: likes })}
        {act("comment", "comment", t("interactions.comment_n", { count: commentsN }), () => setComments(true), { count: commentsN, haspopup: true })}
        {act("share", "share", t("interactions.share_n", { count: sharesN }), () => { if (guard()) setShare(true); }, { count: sharesN, haspopup: true })}
        {extra}
        <span className="grow" />
        {act("save", "bookmark", t("interactions.save"), save, { pressed: saved })}
      </div>
      {reactions && !preview && (
        <div className="c-reactions" role="group" aria-label={t("interactions.reacoes")}>
          {REACTIONS.map((r) => (
            <button key={r.id} type="button" className="chip c-reaction" aria-pressed={mine3.includes(r.id)} onClick={() => react(r.id)}>
              {t("interactions.reaction_chip", { id: r.id, count: rx[r.id] ?? 0 })}
            </button>
          ))}
          {(counters?.remixes ?? 0) > 0 && <span className="c-remixes type-caption text-muted tabular">{t("interactions.count.remixes", { count: counters?.remixes ?? 0 })}</span>}
        </div>
      )}
      {!preview && <CommentsDialog type={type} id={id} open={comments} onClose={() => setComments(false)} title={title} />}
      {!preview && <ShareDialog type={type} id={id} open={share} onClose={() => setShare(false)} />}
    </div>
  );
}

/**
 * Comentários com respostas (RF19.CA04–CA07) — sempre em modal, aberto pelo ícone de comentar (barra social ou rodapé
 * do card). Nunca é renderizado inline no fim da página. Só busca os comentários quando o modal está aberto.
 */
export function CommentsDialog({ type, id, open, onClose, title }: { type: TargetType; id: string; open: boolean; onClose: () => void; title?: string }) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onClose={onClose} title={title ? t("interactions.comentarios", { title }) : t("interactions.comentarios_2")}>
      {open && <CommentsPanel type={type} id={id} />}
    </Dialog>
  );
}

/** Botão do ícone de comentar (rodapé de cards) que abre o modal de comentários. */
export function CommentButton({ type, id, count, title, className }: { type: TargetType; id: string; count?: number; title?: string; className?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className ?? "metric metric-btn"} aria-haspopup="dialog" aria-label={t("interactions.comentar_2", { value: count ?? 0 })} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}>
        <FaiIcon id="SOC-02" size={20} variant="glyph" decorative /><span className="tabular">{count ?? 0}</span>
      </button>
      <CommentsDialog type={type} id={id} open={open} onClose={() => setOpen(false)} title={title} />
    </>
  );
}

function CommentsPanel({ type, id }: { type: TargetType; id: string }) {
  const { t, relative } = useI18n(); const { user } = useAuth(); const toast = useToast(); const router = useRouter();
  const [content, setContent] = useState(""); const [parentId, setParentId] = useState<string | null>(null);
  const { data, loading, reload } = useApi<Comment[]>((signal) => api.get(`/api/interactions/${type}/${id}/comments`, { signal, anonymous: !user }), [type, id, !!user]);
  async function send() {
    if (!user) { router.push("/login"); return; }
    if (!content.trim()) return;
    try { await api.post(`/api/interactions/${type}/${id}/comments`, { content, parentId }); setContent(""); setParentId(null); reload(); } catch (e) { toast.fromError(e); }
  }
  async function remove(cid: string) { try { await api.delete(`/api/comments/${cid}`); reload(); } catch (e) { toast.fromError(e); } }
  // A API devolve lista plana com parentCommentId: monta a árvore (respostas aninhadas sob o comentário de origem).
  const list = data ?? [];
  const parentOf = (c: Comment) => c.parentCommentId ?? c.parentId ?? null;
  const ids = new Set(list.map((c) => c.id));
  const children = new Map<string, Comment[]>();
  for (const c of list) { const p = parentOf(c); if (p && ids.has(p)) children.set(p, [...(children.get(p) ?? []), c]); }
  const roots = list.filter((c) => { const p = parentOf(c); return !p || !ids.has(p); });
  const Item = ({ c, depth }: { c: Comment; depth: number }) => {
  const { t } = useI18n();
    const author = c.author ?? c.user;
    return (
      <li className="py-2" style={{ marginLeft: depth * 24 }}>
        <div className="flex items-start gap-2">
          <Avatar src={mediaUrl(author?.avatarUrl)} name={author?.displayName} size={28} />
          <div className="min-w-0 flex-1">
            <p className="type-body-sm"><b>@{author?.username}</b> <span className="text-faint">· {relative(c.createdAt)}</span></p>
            <p className="type-body whitespace-pre-wrap">{c.content}</p>
            <div className="mt-1 flex gap-2 type-caption">
              <button type="button" className="underline" onClick={() => setParentId(c.id)}>{t("interactions.responder")}</button>
              {(c.canDelete || author?.id === user?.id) && <button type="button" className="underline text-critical" onClick={() => remove(c.id)}>{t("common.delete")}</button>}
            </div>
          </div>
        </div>
        {(children.get(c.id) ?? c.replies ?? []).length ? <ul className="fai-list">{(children.get(c.id) ?? c.replies ?? []).map((r) => <Item key={r.id} c={r} depth={depth + 1} />)}</ul> : null}
      </li>
    );
  };
  return (
    <section aria-label={t("interactions.comentarios_3")}>
      <p className="type-caption text-muted mb-1 tabular">{list.length} {list.length === 1 ? t("interactions.comentario") : t("interactions.comentarios_3")}</p>
      {loading ? <p className="type-body text-muted">{t("common.loading")}</p> : list.length === 0 ? <p className="type-body text-muted">{t("interactions.seja_o_primeiro_a_comentar")}</p> : <ul className="fai-list max-h-[50vh] overflow-y-auto">{roots.map((c) => <Item key={c.id} c={c} depth={0} />)}</ul>}
      <div className="mt-3 flex flex-col gap-2">
        {parentId && <p className="type-caption text-muted">{t("interactions.respondendo_a")}{(list.find((c) => c.id === parentId)?.author ?? list.find((c) => c.id === parentId)?.user)?.username ?? t("interactions.comentario")}… <button type="button" className="underline" onClick={() => setParentId(null)}>{t("common.cancel")}</button></p>}
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={user ? t("interactions.escreva_um_comentario") : t("common.loginRequired")} maxLength={500} aria-label={t("interactions.novo_comentario")} />
        <div className="flex justify-end"><Button variant="primary" size="sm" onClick={send} disabled={!content.trim()}><FaiIcon id="SOC-02" size={24} decorative />{t("interactions.comentar_3")}</Button></div>
      </div>
    </section>
  );
}
