"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, mediaUrl } from "@/lib/api/client";
import type { Counters, UserCard, ViewerState } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { Avatar, Button, Dialog, Textarea, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { Generate3DButton } from "@/components/generate-3d";

type TargetType = "SCHEME" | "PIECE" | "COMMENT" | "DNA_SCHEME";
interface Comment { id: string; author?: UserCard; user?: UserCard; content: string; createdAt: string; parentId?: string | null; parentCommentId?: string | null; replies?: Comment[]; canDelete?: boolean; }
const REACTIONS: { id: "TREND" | "ELEGANTE" | "CRIATIVO"; icon: string }[] = [{ id: "TREND", icon: "SOC-07" }, { id: "ELEGANTE", icon: "SOC-08" }, { id: "CRIATIVO", icon: "SOC-09" }];

/** Barra social (RF19): curtir, reações, salvar, compartilhar, remixar + contadores. */
export function InteractionBar({ type, id, counters, viewer, onChange, remixHref, ownerId, title }: { type: TargetType; id: string; counters?: Counters; viewer?: ViewerState; onChange?: () => void; remixHref?: string; ownerId?: string; title?: string }) {
  const { t } = useI18n(); const { user } = useAuth(); const toast = useToast(); const router = useRouter();
  const [share, setShare] = useState(false); const [caption, setCaption] = useState(""); const [comments, setComments] = useState(false);
  const base = `/api/interactions/${type}/${id}`;
  const guard = () => { if (!user) { router.push("/login"); return false; } return true; };
  async function react(reaction: string) { if (!guard()) return; try { await api.post(`${base}/reactions`, { reaction }); onChange?.(); } catch (e) { toast.fromError(e); } }
  async function save() { if (!guard()) return; try { await api.post(`${base}/saves`); onChange?.(); } catch (e) { toast.fromError(e); } }
  async function remix() { if (!guard()) return; try { const r = await api.post<{ scheme?: { id: string }; id?: string }>(`${base}/remixes`); toast.success(t("scheme.remix") + " ✓"); const nid = r.scheme?.id ?? r.id; if (nid) router.push(remixHref ?? (type === "SCHEME" ? `/schemes/${nid}` : `/pieces/${nid}`)); else onChange?.(); } catch (e) { toast.fromError(e); } }
  async function doShare(channel: string) {
    if (!guard()) return;
    try {
      const r = await api.post<{ url?: string; link?: string }>(`${base}/shares`, { channel, caption });
      const url = r.url ?? r.link ?? `${window.location.origin}${window.location.pathname}`;
      if (channel === "EXTERNAL") { await navigator.clipboard.writeText(url); toast.success(t("common.copied")); } else toast.success(t("common.share") + " ✓");
      setShare(false); onChange?.();
    } catch (e) { toast.fromError(e); }
  }
  const mine = user && ownerId === user.id;
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="interações">
      <button type="button" className="btn btn-ghost btn-sm" aria-pressed={viewer?.liked} onClick={() => react("LIKE")}><FaiIcon id="SOC-01" size={24} active={viewer?.liked} /><span className="tabular">{counters?.likes ?? 0}</span></button>
      {REACTIONS.map((r) => <button key={r.id} type="button" className="btn btn-ghost btn-sm" aria-pressed={viewer?.reactions?.includes(r.id)} onClick={() => react(r.id)}><FaiIcon id={r.icon} size={24} active={viewer?.reactions?.includes(r.id)} /><span className="tabular">{counters?.reactions?.[r.id] ?? 0}</span></button>)}
      <button type="button" className="btn btn-ghost btn-sm" aria-haspopup="dialog" aria-label="comentar" onClick={() => setComments(true)}><FaiIcon id="SOC-02" size={24} /><span className="tabular">{counters?.comments ?? 0}</span></button>
      <button type="button" className="btn btn-ghost btn-sm" aria-pressed={viewer?.saved} onClick={save}><FaiIcon id="SOC-05" size={24} active={viewer?.saved} /><span className="tabular">{counters?.saves ?? 0}</span></button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShare(true)}><FaiIcon id="SOC-03" size={24} /><span className="tabular">{counters?.shares ?? 0}</span></button>
      {!mine && <button type="button" className="btn btn-ghost btn-sm" onClick={remix}><FaiIcon id="SOC-04" size={24} /><span className="tabular">{counters?.remixes ?? 0}</span></button>}
      {(type === "SCHEME" || type === "PIECE") && <Generate3DButton compact={false} targets={[{ kind: type === "SCHEME" ? "scheme" : "piece", id, title: title ?? "" }]} />}
      <span className="ml-auto type-caption text-faint tabular">{counters?.views ?? 0} views</span>
      <CommentsDialog type={type} id={id} open={comments} onClose={() => { setComments(false); onChange?.(); }} title={title} />
      <Dialog open={share} onClose={() => setShare(false)} title={t("common.share")} footer={<><Button onClick={() => doShare("EXTERNAL")}>{t("common.copy")} link</Button><Button variant="primary" onClick={() => doShare("FEED")}>Feed</Button></>}>
        <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Legenda (opcional)" maxLength={200} />
      </Dialog>
    </div>
  );
}

/**
 * Comentários com respostas (RF19.CA04–CA07) — sempre em modal, aberto pelo ícone de comentar (barra social ou rodapé
 * do card). Nunca é renderizado inline no fim da página. Só busca os comentários quando o modal está aberto.
 */
export function CommentsDialog({ type, id, open, onClose, title }: { type: TargetType; id: string; open: boolean; onClose: () => void; title?: string }) {
  return (
    <Dialog open={open} onClose={onClose} title={title ? `Comentários · ${title}` : "Comentários"}>
      {open && <CommentsPanel type={type} id={id} />}
    </Dialog>
  );
}

/** Botão do ícone de comentar (rodapé de cards) que abre o modal de comentários. */
export function CommentButton({ type, id, count, title, className }: { type: TargetType; id: string; count?: number; title?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className ?? "inline-flex items-center gap-1"} aria-haspopup="dialog" aria-label={`comentar (${count ?? 0})`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}>
        <FaiIcon id="SOC-02" size={24} decorative /><span className="tabular">{count ?? 0}</span>
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
    const author = c.author ?? c.user;
    return (
      <li className="py-2" style={{ marginLeft: depth * 24 }}>
        <div className="flex items-start gap-2">
          <Avatar src={mediaUrl(author?.avatarUrl)} name={author?.displayName} size={28} />
          <div className="min-w-0 flex-1">
            <p className="type-body-sm"><b>@{author?.username}</b> <span className="text-faint">· {relative(c.createdAt)}</span></p>
            <p className="type-body whitespace-pre-wrap">{c.content}</p>
            <div className="mt-1 flex gap-2 type-caption">
              <button type="button" className="underline" onClick={() => setParentId(c.id)}>Responder</button>
              {(c.canDelete || author?.id === user?.id) && <button type="button" className="underline text-critical" onClick={() => remove(c.id)}>{t("common.delete")}</button>}
            </div>
          </div>
        </div>
        {(children.get(c.id) ?? c.replies ?? []).length ? <ul>{(children.get(c.id) ?? c.replies ?? []).map((r) => <Item key={r.id} c={r} depth={depth + 1} />)}</ul> : null}
      </li>
    );
  };
  return (
    <section aria-label="comentários">
      <p className="type-caption text-muted mb-1 tabular">{list.length} {list.length === 1 ? "comentário" : "comentários"}</p>
      {loading ? <p className="type-body text-muted">{t("common.loading")}</p> : list.length === 0 ? <p className="type-body text-muted">Seja o primeiro a comentar.</p> : <ul className="max-h-[50vh] overflow-y-auto divide-y divide-line-soft">{roots.map((c) => <Item key={c.id} c={c} depth={0} />)}</ul>}
      <div className="mt-3 flex flex-col gap-2">
        {parentId && <p className="type-caption text-muted">Respondendo a @{(list.find((c) => c.id === parentId)?.author ?? list.find((c) => c.id === parentId)?.user)?.username ?? "comentário"}… <button type="button" className="underline" onClick={() => setParentId(null)}>{t("common.cancel")}</button></p>}
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={user ? "Escreva um comentário…" : t("common.loginRequired")} maxLength={500} aria-label="novo comentário" />
        <div className="flex justify-end"><Button variant="primary" size="sm" onClick={send} disabled={!content.trim()}><FaiIcon id="SOC-02" size={24} decorative />Comentar</Button></div>
      </div>
    </section>
  );
}
