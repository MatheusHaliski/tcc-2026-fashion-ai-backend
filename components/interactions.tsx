"use client";
import { useEffect, useRef, useState } from "react";
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
const REACTIONS: { id: "TREND" | "ELEGANTE" | "CRIATIVO"; icon: "trend" | "elegante" | "criativo" }[] = [{ id: "TREND", icon: "trend" }, { id: "ELEGANTE", icon: "elegante" }, { id: "CRIATIVO", icon: "criativo" }];

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
      // a API devolve o caminho no app (/pieces/…, /schemes/…, /dna-schemes/…): o link copiado leva o domínio
      const path = r.url ?? r.link ?? `/${type === "PIECE" ? "pieces" : type === "DNA_SCHEME" ? "dna-schemes" : "schemes"}/${id}`;
      const url = path.startsWith("/") ? `${window.location.origin}${path}` : path;
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

/**
 * Glifos das interações do RF19 (traço 1,8 px, 24×24, cor do texto): contorno no estado normal, preenchido quando ativo.
 * As reações seguem o mesmo desenho das ações (preto e branco, sem disco): Trend é a linha em onda que sobe com dois nós
 * e a ponta de seta; Elegante, a gravata-borboleta; Criativo, o carretel com a agulha.
 */
const SOCIAL_ICONS = {
  heart: (f: boolean) => <path d="M12 20.3s-7.3-4.5-9.3-9.2C1.4 8 3.3 4.6 6.7 4.3c2.1-.2 3.9.9 5.3 2.8 1.4-1.9 3.2-3 5.3-2.8 3.4.3 5.3 3.7 4 6.8-2 4.7-9.3 9.2-9.3 9.2z" fill={f ? "currentColor" : "none"} />,
  comment: (f: boolean) => <path d="M20.5 11.6a8.1 8.1 0 0 1-11.9 7.1L3.5 20l1.4-4.7a8.1 8.1 0 1 1 15.6-3.7z" fill={f ? "currentColor" : "none"} />,
  share: () => <path d="M21 3 10.2 13.8M21 3l-6.7 18-4.1-7.2L3 9.7 21 3z" />,
  bookmark: (f: boolean) => <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.6-6.5 4.6v-16a1 1 0 0 1 1-1z" fill={f ? "currentColor" : "none"} />,
  remix: () => <path d="M17 2.8l3 3-3 3M4 11.2v-.9a4.5 4.5 0 0 1 4.5-4.5H20M7 21.2l-3-3 3-3M20 12.8v.9a4.5 4.5 0 0 1-4.5 4.5H4" />,
  // Trend (desenho enviado pela pessoa, vetorizado no grid 24): a linha em onda que sobe, dois nós vazados e a ponta
  // de seta; ativo = nós e ponta preenchidos
  trend: (f: boolean) => (
    <>
      <path d="M1.8 20.2c1.5 0 2.7-1 3.6-2.4M8.4 14.9c.9-1.7 1.9-2.9 3-2.9.5 0 .9.2 1.4.4M16.2 10.7c1.4-1 2.7-2.7 3.8-4.6" />
      <circle cx="7.2" cy="16.6" r="2.1" fill={f ? "currentColor" : "none"} /><circle cx="14.9" cy="12.3" r="2.1" fill={f ? "currentColor" : "none"} />
      <path d="M17.7 5.5 22 4.1l-1.7 4.4-.3-2.4" fill={f ? "currentColor" : "none"} />
    </>
  ),
  elegante: (f: boolean) => (
    <>
      <path d="M10.3 10.1 4.6 6.7C3.8 6.2 3 6.8 3 7.7v8.6c0 .9.8 1.5 1.6 1l5.7-3.4M13.7 10.1l5.7-3.4c.8-.5 1.6.1 1.6 1v8.6c0 .9-.8 1.5-1.6 1l-5.7-3.4" fill={f ? "currentColor" : "none"} />
      <rect x="10.3" y="9.6" width="3.4" height="4.8" rx="1.2" fill={f ? "currentColor" : "none"} />
    </>
  ),
  criativo: (f: boolean) => (
    <>
      <rect x="3.6" y="3.4" width="10.2" height="2.6" rx="1.1" fill={f ? "currentColor" : "none"} /><rect x="3.6" y="18" width="10.2" height="2.6" rx="1.1" fill={f ? "currentColor" : "none"} />
      <path d="M5.2 6v12M12.2 6v12" />{f ? <rect x="5.2" y="6" width="7" height="12" fill="currentColor" stroke="none" /> : <path d="M5.2 9.2l7-1.6M5.2 12.4l7-1.6M5.2 15.6l7-1.6" strokeWidth={1.3} />}
      <path d="M16.3 20.6 20.4 6.2" /><ellipse cx="20.9" cy="4.3" rx=".9" ry="1.6" transform="rotate(16 20.9 4.3)" strokeWidth={1.3} />
    </>
  ),
} as const;
export type SocialIconName = keyof typeof SOCIAL_ICONS;
export function SocialIcon({ name, filled, size = 24 }: { name: SocialIconName; filled?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false" className="c-act-icon"
      fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">
      {SOCIAL_ICONS[name](!!filled)}
    </svg>
  );
}

/** Contagem ao lado do ícone; quando a forma curta difere, as duas vão para o DOM e o CSS escolhe pela largura. */
function Count({ long, short }: { value: number; long: string; short: string }) {
  if (long === short) return <span className="c-act-n tabular" aria-hidden>{long}</span>;
  return <span className="c-act-n tabular" aria-hidden><span className="n-long">{long}</span><span className="n-short">{short}</span></span>;
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
 * ícone com a sua contagem ao lado; salvar à direita. Todos com o mesmo tamanho (ícone 24 px), a mesma área de toque
 * (44 px em tela de toque), nome acessível com a contagem e estado (aria-pressed) — curtido e salvo ficam preenchidos.
 * Não existe linha "N curtidas" separada: cada número aparece uma vez, junto da ação. No detalhe (`reactions`) TODAS as
 * interações do RF19 ficam nesta mesma linha horizontal: curtir, comentar, compartilhar e remixar | Trend, Elegante e
 * Criativo (o nome da reação fica no nome acessível e na dica) | salvar à direita.
 */
export function CardActions({ type, id, counters, viewer, title, compact, extra, reactions, preview, ownerId }: { type: "SCHEME" | "PIECE" | "DNA_SCHEME"; id: string; counters?: Counters; viewer?: ViewerState; ownerId?: string; title?: string; compact?: boolean; extra?: React.ReactNode; reactions?: boolean; preview?: boolean;
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
  // uma requisição por ação de cada vez: enquanto curtir/salvar está a caminho, novos toques são ignorados (sem pedidos
  // duplicados nem contagem que anda duas vezes); se o servidor recusar, o estado e a contagem voltam e aparece o erro
  const inflight = useRef(new Set<string>()); const [busy, setBusy] = useState<Record<string, boolean>>({});
  async function optimistic(key: string, apply: () => void, undo: () => void, call: () => Promise<unknown>, done?: () => void) {
    if (!guard() || inflight.current.has(key)) return;
    inflight.current.add(key); setBusy((b) => ({ ...b, [key]: true }));
    apply();
    try { await call(); done?.(); } catch (e) { undo(); toast.fromError(e); }
    finally { inflight.current.delete(key); setBusy((b) => ({ ...b, [key]: false })); }
  }
  const like = () => { const was = liked; optimistic("like", () => { setLiked(!was); setLikes((n) => n + (was ? -1 : 1)); }, () => { setLiked(was); setLikes((n) => n + (was ? 1 : -1)); }, () => api.post(`${base}/reactions`, { reaction: "LIKE" })); };
  const react = (r: string) => {
    const was = mine3.includes(r);
    const apply = (on: boolean) => { setMine3((l) => (on ? [...l, r] : l.filter((x) => x !== r))); setRx((m) => ({ ...m, [r]: Math.max(0, (m[r] ?? 0) + (on ? 1 : -1)) })); };
    optimistic(`rx-${r}`, () => apply(!was), () => apply(was), () => api.post(`${base}/reactions`, { reaction: r }));
  };
  // "Salvo" só aparece depois que o servidor confirmou
  const save = () => { const was = saved; optimistic("save", () => setSaved(!was), () => setSaved(was), () => api.post(`${base}/saves`), () => toast.success(was ? t("anatomy.menu.unsaved") : t("anatomy.menu.saved"))); };
  // no card, números grandes sem decimal ("1 mil"), para a linha caber em 2 colunas no celular; no detalhe, "1,2 mil"
  const n = (v: number) => fmtNumber(v, { notation: "compact", maximumFractionDigits: compact ? 0 : 1 });
  // forma curta ("12 mil" no lugar de "12,3 mil"): o detalhe estreito troca por ela via CSS para a linha única caber
  const nShort = (v: number) => fmtNumber(v, { notation: "compact", maximumFractionDigits: 0 });
  const commentsN = counters?.comments ?? 0, sharesN = counters?.shares ?? 0, remixesN = counters?.remixes ?? 0;
  // remixar (RF19.CA13) entra na linha do detalhe de peça e de look; quem publicou não remixa o próprio post
  const { remix, busy: remixing } = useRemix(type === "DNA_SCHEME" ? "SCHEME" : type, id);
  const canRemix = !!reactions && type !== "DNA_SCHEME" && !(user && ownerId && user.id === ownerId);
  // hideZero: remixar e reações sem nenhuma contagem mostram só o ícone (a linha única cabe no celular)
  const act = (key: string, icon: SocialIconName, label: string, onClick: () => void, opts: { pressed?: boolean; count?: number; haspopup?: boolean; busy?: boolean; hideZero?: boolean; className?: string } = {}) => (
    <button key={key} type="button" className={`c-act is-${key} ${opts.className ?? ""}`} aria-pressed={opts.pressed} aria-busy={busy[key] || opts.busy || undefined} aria-haspopup={opts.haspopup ? "dialog" : undefined} aria-label={label} title={label}
      onClick={preview ? undefined : onClick} disabled={preview} tabIndex={preview ? -1 : undefined}>
      <SocialIcon name={icon} filled={opts.pressed} />
      {opts.count !== undefined && !(opts.hideZero && opts.count === 0) && <Count value={opts.count} long={n(opts.count)} short={nShort(opts.count)} />}
    </button>
  );
  return (
    // contagens muito longas (ex.: "12 mi" + "988 mil"): no card estreito o número de comentários sai da linha
    // (continua no nome acessível e no detalhe) para a linha nunca estourar a coluna
    <div className={`c-post ${compact ? "is-compact" : ""} ${preview ? "is-preview" : ""}`} data-dense={compact && (n(likes) + n(commentsN)).length > 7 ? "" : undefined}>
      <div className="c-actions" role="group" aria-label={t("interactions.interacoes")}>
        {/* no detalhe, as interações ficam num grupo que, só em tela muito estreita, rola na horizontal (salvar fica fixo) */}
        <div className={reactions ? "c-acts-main" : "contents"}>
        {act("like", "heart", t("interactions.like_n", { count: likes }), like, { pressed: liked, count: likes })}
        {act("comment", "comment", t("interactions.comment_n", { count: commentsN }), () => setComments(true), { count: commentsN, haspopup: true })}
        {act("share", "share", t("interactions.share_n", { count: sharesN }), () => { if (guard()) setShare(true); }, { count: sharesN, haspopup: true })}
        {canRemix && !preview && act("remix", "remix", t("interactions.remix_n", { count: remixesN }), remix, { count: remixesN, busy: remixing, hideZero: true })}
        {reactions && !preview && <span className="c-sep" aria-hidden />}
        {reactions && !preview && REACTIONS.map((r) => act(`rx-${r.id}`, r.icon, t("interactions.reaction_aria", { name: t(`interactions.reaction_nome.${r.id}`), count: rx[r.id] ?? 0 }),
          () => react(r.id), { pressed: mine3.includes(r.id), count: rx[r.id] ?? 0, hideZero: true, className: "is-rx" }))}
        {extra}
        </div>
        <span className="grow" />
        {act("save", "bookmark", t("interactions.save"), save, { pressed: saved })}
      </div>
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
