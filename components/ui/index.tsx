"use client";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ApiError } from "@/lib/api/client";
import { useI18n, tr } from "@/lib/i18n/i18n";

export const cn = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");

/* ---------- Button ---------- */
type Variant = "default" | "primary" | "accent" | "ghost" | "danger";
export function Button({ variant = "default", size, loading, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "lg" | "icon"; loading?: boolean }) {
  return (
    <button type="button" {...rest} disabled={rest.disabled || loading} aria-busy={loading || undefined}
      className={cn("btn", variant !== "default" && `btn-${variant}`, size && `btn-${size}`, className)}>
      {loading ? <Spinner size={14} /> : null}{children}
    </button>
  );
}
export function Spinner({ size = 18 }: { size?: number }) {
  return <span aria-hidden className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent" style={{ width: size, height: size }} />;
}

/* ---------- Fields ---------- */
interface FieldProps { label?: string; hint?: string; error?: string; required?: boolean; children: ReactNode; id?: string; className?: string; }
export function Field({ label, hint, error, required, children, id, className }: FieldProps) {
  return (
    <div className={cn("mb-3", className)}>
      {label && <label htmlFor={id} className="label">{label}{required && <span aria-hidden className="text-critical"> *</span>}</label>}
      {children}
      {error ? <p className="error-text" role="alert">{error}</p> : hint ? <p className="help">{hint}</p> : null}
    </div>
  );
}
export function Input({ className, error, ...rest }: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return <input {...rest} aria-invalid={error || undefined} className={cn("input", className)} />;
}
export function Textarea({ className, error, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return <textarea {...rest} aria-invalid={error || undefined} className={cn("input min-h-24", className)} />;
}
export function Select({ className, error, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return <select {...rest} aria-invalid={error || undefined} className={cn("input", className)}>{children}</select>;
}
export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  const auto = useId(); const sid = id ?? auto;
  return (
    <label htmlFor={sid} className="flex items-center justify-between gap-3 py-2 cursor-pointer">
      <span>{label}</span>
      <button id={sid} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cn("relative h-6 w-11 rounded-full border-2 transition-colors", checked ? "bg-ink border-ink" : "bg-surface-2 border-line-soft")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-surface transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </label>
  );
}
export function Chip({ active, children, onClick, className, title }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string; title?: string }) {
  return <button type="button" className={cn("chip", className)} aria-pressed={active} onClick={onClick} title={title}>{children}</button>;
}
export function Badge({ tone, children, className }: { tone?: "mark" | "thread" | "chalk"; children: ReactNode; className?: string }) {
  return <span className={cn("badge", tone && `badge-${tone}`, className)}>{children}</span>;
}

/* ---------- Layout ---------- */
export function Card({ children, className, pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <section className={cn("surface", pad && "card-pad p-4", className)}>{children}</section>;
}
export function PageHeader({ title, lead, actions, kicker }: { title: string; lead?: string; actions?: ReactNode; kicker?: string }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker && <p className="type-label text-muted mb-1">{kicker}</p>}
        <h1 className="type-h1 text-ink">{title}</h1>
        {lead && <p className="type-body text-muted mt-1 max-w-prose">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (t: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cn("tabs mb-4", className)}>
      {tabs.map((t) => (
        <button key={t.id} role="tab" type="button" aria-selected={value === t.id} className="tab" onClick={() => onChange(t.id)}>
          {t.label}{t.count !== undefined && <span className="ml-1 tabular text-faint">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function Skeleton({ className }: { className?: string }) { return <div className={cn("skeleton", className)} aria-hidden />; }
export function SkeletonGrid({ n = 6, h = "h-56" }: { n?: number; h?: string }) {
  return <div className="grid-cards">{Array.from({ length: n }).map((_, i) => <Skeleton key={i} className={h} />)}</div>;
}
export function EmptyState({ title, hint, action, icon }: { title: string; hint?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="surface p-8 text-center">
      {icon && <div className="mx-auto mb-3 w-14">{icon}</div>}
      <p className="type-h3 text-ink">{title}</p>
      {hint && <p className="type-body text-muted mt-1 max-w-md mx-auto">{hint}</p>}
      {action && <div className="mt-4 flex justify-center gap-2">{action}</div>}
    </div>
  );
}
export function ErrorState({ error, onRetry }: { error: ApiError | Error | null; onRetry?: () => void }) {
  const { t } = useI18n();
  if (!error) return null;
  const api = error instanceof ApiError ? error : null;
  return (
    <div role="alert" className="surface p-5 border-critical/40">
      <p className="type-h3 text-ink">{api?.status === 0 ? t("common.offline") : t("common.errorTitle")}</p>
      <p className="type-body text-muted mt-1">{error.message}</p>
      {api?.correlationId && <p className="type-caption text-faint mt-1">{t("common.errorHint")}: <code className="type-data">{api.correlationId}</code></p>}
      {onRetry && <Button className="mt-3" onClick={onRetry}>{t("common.retry")}</Button>}
    </div>
  );
}
export function Avatar({ src, name, size = 32 }: { src?: string | null; name?: string; size?: number }) {
  const initials = (name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return src ? <img src={src} alt={name ?? ""} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
    : <span aria-hidden className="inline-flex items-center justify-center rounded-full bg-surface-3 text-muted font-semibold" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials}</span>;
}
export function Pagination({ page, hasMore, onPage, total, size }: { page: number; hasMore: boolean; onPage: (p: number) => void; total?: number; size?: number }) {
  const { t, fmtNumber } = useI18n();
  return (
    <nav className="mt-4 flex items-center justify-between gap-2" aria-label={t("ui.index.paginacao")}>
      <Button size="sm" disabled={page <= 0} onClick={() => onPage(page - 1)}>← {t("common.back")}</Button>
      <span className="type-caption text-muted tabular">{t("common.page")} {page + 1}{total !== undefined && size ? ` ${t("common.of")} ${Math.max(1, Math.ceil(total / size))} · ${fmtNumber(total)} ${t("common.results")}` : ""}</span>
      <Button size="sm" disabled={!hasMore} onClick={() => onPage(page + 1)}>{t("common.next")} →</Button>
    </nav>
  );
}

/* ---------- Dialog ---------- */
export function Dialog({ open, onClose, title, children, footer, size }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: "lg" | "xl" }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const first = ref.current?.querySelector<HTMLElement>("button, input, select, textarea, [tabindex]");
    first?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`dialog ${size ? `dialog-${size}` : ""}`}>
        <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <h2 className="type-h3">{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" aria-label={t("common.fechar")} onClick={onClose}>✕</button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line-soft px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Toasts ---------- */
interface Toast { id: number; kind: "info" | "success" | "error"; text: string; }
const ToastCtx = createContext<{ push: (kind: Toast["kind"], text: string) => void } | null>(null);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 4000);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[70] flex w-[min(92vw,460px)] -translate-x-1/2 flex-col gap-2" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => <div key={t.id} role={t.kind === "error" ? "alert" : "status"} className={cn("toast pointer-events-auto", t.kind === "error" && "toast-error", t.kind === "success" && "toast-success")}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast fora do ToastProvider");
  const push = ctx.push;
  return {
    info: (t: string) => push("info", t), success: (t: string) => push("success", t), error: (t: string) => push("error", t),
    /** Mostra a mensagem tratada do backend (ApiError) ou uma genérica. */
    fromError: (e: unknown, fallback = tr("ui.index.algo_deu_errado_tente_de")) => push("error", e instanceof ApiError ? `${e.message}${e.correlationId ? ` (${e.correlationId.slice(0, 8)})` : ""}` : fallback),
  };
}
