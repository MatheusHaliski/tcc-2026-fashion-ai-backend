"use client";
import { Children, Fragment, createContext, isValidElement, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type RefObject, type InputHTMLAttributes, type OptionHTMLAttributes, type ReactElement, type ReactNode, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { ApiError } from "@/lib/api/client";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { REQUIREMENT_CODE, useDevRefs } from "@/lib/dev-refs";
import { UiIcon } from "@/components/ui/icons";
export { UiIcon } from "@/components/ui/icons";

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
/**
 * Lista de escolha ÚNICA (padrão FashionAI): gatilho com a aparência do campo + lista própria (nada do <select> nativo,
 * que abre com a aparência do sistema). Mesma API do <select>: <option value disabled hidden> como filhos, `value` /
 * `defaultValue` e `onChange(e)` com `e.target.value` — o valor é sempre o ID canônico; o rótulo traduzido é só texto.
 * Acessível como combobox só-de-escolha (WAI-ARIA APG): o foco fica no gatilho e a opção ativa vai em
 * aria-activedescendant; setas, Home/End, PageUp/PageDown, digitar o começo do nome, Enter/Espaço escolhem, Esc fecha
 * sem mudar nada. A lista abre para cima quando falta espaço embaixo e sai por portal (não é cortada por modal/cartão).
 */
export interface SelectChange { target: { value: string; name?: string }; currentTarget: { value: string; name?: string } }
type SelectProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value" | "defaultValue" | "onChange" | "children"> & {
  value?: string | number | null; defaultValue?: string | number; onChange?: (e: SelectChange) => void; error?: boolean; loading?: boolean; children?: ReactNode;
};
interface SelectOpt { value: string; label: ReactNode; text: string; disabled: boolean }
const textOf = (n: ReactNode): string => {
  if (n == null || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textOf).join("");
  return isValidElement(n) ? textOf((n.props as { children?: ReactNode }).children) : "";
};
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
function readOptions(children: ReactNode): SelectOpt[] {
  const out: SelectOpt[] = [];
  const walk = (n: ReactNode) => Children.forEach(n, (c) => {
    if (!isValidElement(c)) return;
    const el = c as ReactElement<{ children?: ReactNode }>;
    if (el.type === Fragment || el.type === "optgroup") return walk(el.props.children);
    if (el.type !== "option") return;
    const p = el.props as OptionHTMLAttributes<HTMLOptionElement>;
    if (p.hidden) return;
    const text = textOf(p.children);
    out.push({ value: p.value != null ? String(p.value) : text, label: p.children, text, disabled: !!p.disabled });
  });
  walk(children);
  return out;
}
export function Select({ className, error, loading, children, value, defaultValue, onChange, id, name, disabled, onKeyDown, onBlur, ...rest }: SelectProps) {
  const opts = useMemo(() => readOptions(children), [children]);
  const [inner, setInner] = useState(defaultValue != null ? String(defaultValue) : undefined);
  const current = value != null ? String(value) : inner;
  const found = opts.findIndex((o) => o.value === current);
  const selected = found >= 0 ? found : opts.length ? 0 : -1;       // como o nativo: sem casar, mostra a primeira opção
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<CSSProperties>({});
  const [listName, setListName] = useState<string>();
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const typed = useRef({ s: "", at: 0 });
  const listId = useId();
  const off = disabled || loading;
  const enabled = (i: number) => i >= 0 && i < opts.length && !opts[i].disabled;
  const step = (from: number, dir: 1 | -1, n = 1) => {
    let i = from, last = from;
    for (let k = 0; k < opts.length && n > 0; k++) { i += dir; if (i < 0 || i >= opts.length) break; if (enabled(i)) { last = i; n--; } }
    return last;
  };
  const edge = (dir: 1 | -1) => step(dir === 1 ? -1 : opts.length, dir);
  const show = (at?: number) => {
    if (off || !opts.length) return;
    const lbl = rest["aria-label"] ?? (id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent ?? undefined : undefined);
    setListName(lbl || undefined);
    setActive(at ?? (enabled(selected) ? selected : edge(1)));
    setOpen(true);
    btn.current?.focus({ preventScroll: true });
  };
  const close = () => { setOpen(false); setActive(-1); };
  const commit = (i: number) => {
    if (!enabled(i)) return;
    const v = opts[i].value;
    close();
    if (v === current && found >= 0) return;                    // igual ao nativo: sem mudança, sem onChange
    if (value == null) setInner(v);
    const target = { value: v, name };
    onChange?.({ target, currentTarget: target });
  };
  const match = (key: string) => {
    const now = Date.now();
    const t = typed.current;
    t.s = now - t.at > 700 ? key : t.s + key; t.at = now;
    const q = fold(t.s);
    const from = open ? active : selected;
    const single = q.length > 1 && q.split("").every((ch) => ch === q[0]);
    const needle = single ? q[0] : q;
    const startAt = single || q.length === 1 ? from + 1 : Math.max(from, 0);
    for (let k = 0; k < opts.length; k++) {
      const i = (startAt + k) % opts.length;
      if (enabled(i) && fold(opts[i].text).startsWith(needle)) return i;
    }
    return -1;
  };
  const place = useCallback(() => {
    const b = btn.current; if (!b) return;
    const r = b.getBoundingClientRect(); const vw = window.innerWidth, vh = window.innerHeight, gap = 6, pad = 8;
    const below = vh - r.bottom - gap - pad, above = r.top - gap - pad;
    const want = Math.min(list.current?.scrollHeight ?? 320, 320);
    const up = below < Math.min(want, 200) && above > below;
    const width = Math.min(Math.max(r.width, 200), vw - pad * 2);
    const left = Math.min(Math.max(r.left, pad), vw - width - pad);
    setPos({ left, width, maxHeight: Math.max(120, Math.min(320, up ? above : below)), ...(up ? { bottom: vh - r.top + gap } : { top: r.bottom + gap }) });
  }, []);
  useLayoutEffect(() => { if (open) place(); }, [open, place, opts.length]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { const t = e.target as Node; if (!btn.current?.contains(t) && !list.current?.contains(t)) close(); };
    window.addEventListener("scroll", place, true); window.addEventListener("resize", place); document.addEventListener("pointerdown", onDown);
    return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); document.removeEventListener("pointerdown", onDown); };
  }, [open, place]);
  useEffect(() => { if (open && active >= 0) list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [open, active]);
  useEffect(() => { if (off && open) close(); }, [off, open]);
  const onKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || off) return;
    const k = e.key;
    const printable = k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!open) {
      if (k === "ArrowDown" || k === "ArrowUp" || k === "Enter" || k === " ") { e.preventDefault(); show(); }
      else if (k === "Home" || k === "End") { e.preventDefault(); show(edge(k === "Home" ? 1 : -1)); }
      else if (printable) { const i = match(k); if (i >= 0) { e.preventDefault(); show(i); } }
      return;
    }
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (k === "ArrowDown") { stop(); setActive((i) => step(i, 1)); }
    else if (k === "ArrowUp") { stop(); if (e.altKey) commit(active); else setActive((i) => step(i, -1)); }
    else if (k === "Home" || k === "End") { stop(); setActive(edge(k === "Home" ? 1 : -1)); }
    else if (k === "PageDown" || k === "PageUp") { stop(); setActive((i) => step(i, k === "PageDown" ? 1 : -1, 10)); }
    else if (k === "Enter" || (k === " " && Date.now() - typed.current.at > 700)) { stop(); commit(active); }
    else if (k === "Escape") { stop(); e.nativeEvent.stopImmediatePropagation(); close(); }   // fecha só a lista, não o modal
    else if (k === "Tab") close();
    else if (printable) { stop(); const i = match(k); if (i >= 0) setActive(i); }
  };
  const sel = selected >= 0 ? opts[selected] : undefined;
  const optId = (i: number) => `${listId}-o${i}`;
  return (
    <span className={cn("select-wrap", open && "is-open", loading && "is-loading", off && "is-disabled")}>
      <button {...rest} ref={btn} id={id} type="button" role="combobox" disabled={off} aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? listId : undefined} aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
        aria-invalid={error || undefined} aria-busy={loading || undefined} className={cn("input select", className)}
        onClick={() => (open ? close() : show())} onKeyDown={onKey} onKeyUp={(e) => { if (e.key === " ") e.preventDefault(); }} onBlur={(e) => { onBlur?.(e); close(); }}>
        <span className={cn("select-value", !sel?.value && "is-placeholder")}>
          <span className="select-text">{sel?.label ?? "—"}</span>
          {opts.map((o, i) => <span key={i} className="select-sizer" aria-hidden>{o.label}</span>)}
        </span>
      </button>
      {name && <input type="hidden" name={name} value={sel?.value ?? ""} />}
      {loading ? <span className="select-icon"><Spinner size={14} /></span>
        : <svg className="select-icon" aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      {open && createPortal(
        <div ref={list} id={listId} role="listbox" aria-label={listName} className="select-pop" style={pos} onMouseDown={(e) => e.preventDefault()}>
          {opts.map((o, i) => (
            <div key={i} id={optId(i)} data-i={i} data-value={o.value} role="option" aria-selected={i === selected} aria-disabled={o.disabled || undefined}
              className={cn("select-opt", i === active && "is-active")} onPointerMove={() => { if (!o.disabled && i !== active) setActive(i); }} onClick={() => commit(i)}>
              <span className={cn("select-opt-label", !o.value && "is-placeholder")}>{o.label}</span>
              {i === selected && <svg className="select-check" aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
          ))}
        </div>, document.body)}
    </span>
  );
}

/**
 * Escolha MÚLTIPLA com limite (padrão FashionAI): etiquetas com ✓, contador "n de max", toque de novo remove; no limite a
 * próxima escolha não entra e a mensagem explica. Valores recebidos fora da lista (IA, dado antigo) aparecem no topo com
 * a explicação e o botão Remover e não ocupam vaga. `problem` diz o que o valor inválido é (ex.: ocasião no lugar de estilo).
 */
export function ChipMultiSelect({ legend, options, value, onChange, max, hint, limitMessage, problem, error, className, scroll }: {
  legend: string; options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; max: number;
  hint?: string; limitMessage?: string; problem?: (v: string) => string; error?: string; className?: string; scroll?: boolean;
}) {
  const [limitHit, setLimitHit] = useState(false); const hid = useId();
  const ids = options.map((o) => o.id);
  const valid = value.filter((v) => ids.includes(v)); const invalid = value.filter((v) => !ids.includes(v));
  const full = valid.length >= max;
  const toggle = (v: string) => {
    if (value.includes(v)) { setLimitHit(false); onChange(value.filter((x) => x !== v)); return; }
    if (full) { setLimitHit(true); return; }
    setLimitHit(false); onChange([...value, v]);
  };
  const labelOf = (v: string) => options.find((o) => o.id === v)?.label ?? v;
  return (
    <fieldset className={cn("multi-select", className)} aria-describedby={hid} aria-invalid={!!error || invalid.length > 0 || undefined}>
      <legend className="label">{legend} <span className="multi-count" aria-live="polite">{tr("ui.multi.selecionados", { n: valid.length, max })}</span></legend>
      {invalid.map((v) => (
        <p key={v} className="tag-fix" role="alert">
          <span>{problem ? problem(v) : tr("ui.multi.valor_fora_da_lista", { v })}</span>
          <button type="button" className="btn btn-sm" onClick={() => onChange(value.filter((x) => x !== v))}>{tr("ui.multi.remover", { v: labelOf(v) })}</button>
        </p>
      ))}
      <div className={cn("flex flex-wrap gap-1.5", scroll && "multi-scroll")}>
        {options.map((o) => { const on = value.includes(o.id); return (
          <Chip key={o.id} active={on} blocked={!on && full} onClick={() => toggle(o.id)}>{on && <span aria-hidden>✓ </span>}{o.label}</Chip>
        ); })}
      </div>
      <p id={hid} className={limitHit ? "error-text" : "help"} role={limitHit ? "alert" : undefined}>
        {limitHit ? limitMessage ?? tr("ui.multi.limite", { max }) : hint ?? tr("ui.multi.dica", { max })}
      </p>
      {error && !limitHit && invalid.length === 0 && <p className="error-text" role="alert">{error}</p>}
    </fieldset>
  );
}
export function Switch({ checked, onChange, label, id, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string; hint?: string; disabled?: boolean }) {
  const auto = useId(); const sid = id ?? auto;
  // O nome acessível vem do rótulo visível (aria-labelledby); a linha inteira é clicável e tem altura de toque.
  return (
    <div className="switch-row">
      <span className="min-w-0">
        <span id={`${sid}-label`} className="block">{label}</span>
        {hint && <span id={`${sid}-hint`} className="type-caption block text-muted">{hint}</span>}
      </span>
      <button id={sid} type="button" role="switch" aria-checked={checked} aria-labelledby={`${sid}-label`} aria-describedby={hint ? `${sid}-hint` : undefined}
        onClick={() => onChange(!checked)} className="switch-track" disabled={disabled}>
        <span className="switch-thumb" />
      </button>
    </div>
  );
}
/**
 * `blocked`: a escolha não entra agora (ex.: limite atingido) — continua focável e clicável para explicar o porquê.
 * `role="radio"`: o chip faz parte de um radiogroup e o estado vai em aria-checked (e não em aria-pressed).
 */
export function Chip({ active, blocked, children, onClick, className, title, disabled, role, ...aria }: { active?: boolean; blocked?: boolean; children: ReactNode; onClick?: () => void; className?: string; title?: string; disabled?: boolean;
  role?: "radio"; "aria-checked"?: boolean }) {
  return <button type="button" className={cn("chip", blocked && "is-blocked", className)} role={role} aria-pressed={role ? undefined : active} aria-checked={role ? aria["aria-checked"] ?? active : undefined}
    aria-disabled={blocked || undefined} disabled={disabled} onClick={onClick} title={title}>{children}</button>;
}
export function Badge({ tone, children, className }: { tone?: "mark" | "thread" | "chalk"; children: ReactNode; className?: string }) {
  return <span className={cn("badge", tone && `badge-${tone}`, className)}>{children}</span>;
}

/* ---------- Layout ---------- */
export function Card({ children, className, pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <section className={cn("surface", pad && "card-pad p-4", className)}>{children}</section>;
}
export function PageHeader({ title, lead, actions, kicker }: { title: string; lead?: string; actions?: ReactNode; kicker?: string }) {
  // Rótulos que são só código de requisito ("RF7 · RF31") aparecem apenas no modo apresentação.
  const devRefs = useDevRefs();
  const isCode = !!kicker && REQUIREMENT_CODE.test(kicker);
  // Título da aba do navegador acompanha o título da página (leitores de tela anunciam a troca de página por ele).
  useEffect(() => { document.title = `${title} · Fashion AI`; }, [title]);
  return (
    <header className="page-header" data-rf={isCode ? kicker : undefined}>
      <div className="min-w-0">
        {kicker && !isCode && <p className="type-label text-muted mb-1">{kicker}</p>}
        {kicker && isCode && devRefs && <p className="type-label mb-1 text-thread">{kicker}</p>}
        <h1 className="type-h1 text-ink">{title}</h1>
        {lead && <p className="type-body text-muted mt-1.5 max-w-prose">{lead}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
export function Tabs<T extends string>({ tabs, value, onChange, className, label }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (t: T) => void; className?: string; label?: string }) {
  // Abas roláveis: sombra na borda indica que há mais abas; setas do teclado trocam de aba (padrão ARIA de tablist).
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: false, end: false });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const measure = () => setEdge({ start: el.scrollLeft > 2, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => { el.removeEventListener("scroll", measure); ro.disconnect(); };
  }, [tabs.length]);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [value]);
  const onKey = (e: ReactKeyboardEvent) => {
    const i = tabs.findIndex((x) => x.id === value);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -2;
    if (next === -2) return;
    e.preventDefault();
    const n = tabs[(next + tabs.length) % tabs.length];
    onChange(n.id);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(`[data-tab="${n.id}"]`)?.focus());
  };
  return (
    <div className={cn("tabs-wrap mb-4", edge.start && "fade-start", edge.end && "fade-end", className)}>
      <div ref={ref} role="tablist" aria-label={label} className="tabs" onKeyDown={onKey}>
        {tabs.map((t) => (
          <button key={t.id} data-tab={t.id} role="tab" type="button" aria-selected={value === t.id} tabIndex={value === t.id ? 0 : -1} className="tab" onClick={() => onChange(t.id)}>
            {t.label}{t.count !== undefined && <span className="ml-1.5 tabular text-muted">{t.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
/** Progresso de um fluxo em etapas: "Passo 2 de 5 · Peças" + trilho com as etapas (as já feitas podem ser revisitadas). */
/**
 * Etapas de um fluxo. Por padrão só as etapas já vistas são clicáveis; `canGo` libera a navegação livre (ir e voltar
 * para qualquer etapa cujo pré-requisito já está cumprido).
 */
export function Stepper({ steps, current, onStep, label, canGo }: { steps: string[]; current: number; onStep?: (i: number) => void; label: string; canGo?: (i: number) => boolean }) {
  const { t } = useI18n();
  return (
    <nav aria-label={label} className="stepper">
      <p className="stepper-count"><span className="text-muted">{t("ui.stepOf", { n: current + 1, total: steps.length })}</span> · <b>{steps[current]}</b></p>
      <ol>
        {steps.map((s, i) => (
          <li key={s} className={i < current ? "is-done" : i === current ? "is-current" : undefined}>
            <button type="button" disabled={!onStep || i === current || !(canGo ? canGo(i) : i < current)} aria-current={i === current ? "step" : undefined} onClick={() => onStep?.(i)}>
              <span className="stepper-dot" aria-hidden>{i < current ? <UiIcon name="check" size={14} /> : i + 1}</span>
              <span className="stepper-label">{s}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
/**
 * Segment picker: alterna entre visões/listas de uma mesma aba (uma de cada vez — nunca listas empilhadas na aba).
 * Fica no cabeçalho da aba ou no topo do card.
 */
/**
 * Escolha ÚNICA entre poucas opções sempre visíveis (padrão FashionAI): grupo de opção (radiogroup) — setas, Home e End
 * movem e escolhem; só a opção marcada entra na ordem de Tab (tabindex móvel), como num grupo de rádios.
 */
export function SegmentPicker<T extends string>({ options, value, onChange, label, className }: { options: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; label: string; className?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const cur = Math.max(0, options.findIndex((o) => o.id === value));
  const move = (i: number) => { const n = (i + options.length) % options.length; onChange(options[n].id); refs.current[n]?.focus(); };
  const onKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(cur + 1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(cur - 1); }
    else if (e.key === "Home") { e.preventDefault(); move(0); }
    else if (e.key === "End") { e.preventDefault(); move(options.length - 1); }
  };
  return (
    <div role="radiogroup" aria-label={label} className={cn("segmented", className)}>
      {options.map((o, i) => <button key={o.id} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={value === o.id} tabIndex={i === cur ? 0 : -1} className={value === o.id ? "is-active" : undefined} onClick={() => onChange(o.id)} onKeyDown={onKey}>{o.label}{o.count != null && <span className="seg-count tabular">{o.count}</span>}</button>)}
    </div>
  );
}
export function Skeleton({ className }: { className?: string }) { return <div className={cn("skeleton", className)} aria-hidden />; }
export function SkeletonGrid({ n = 6, h = "h-56" }: { n?: number; h?: string }) {
  return <div className="grid-cards">{Array.from({ length: n }).map((_, i) => <Skeleton key={i} className={h} />)}</div>;
}
export function EmptyState({ title, hint, action, icon, heading }: { title: string; hint?: string; action?: ReactNode; icon?: ReactNode; heading?: boolean }) {
  const Title = heading ? "h1" : "p";
  return (
    <div className="surface empty-state p-8 text-center">
      {icon && <div className="mx-auto mb-3 w-14">{icon}</div>}
      <Title className={heading ? "type-h2 text-ink" : "type-h3 text-ink"}>{title}</Title>
      {hint && <p className="type-body text-muted mt-1 max-w-md mx-auto">{hint}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
export function ErrorState({ error, onRetry, page, notFound }: { error: ApiError | Error | null; onRetry?: () => void; page?: boolean; notFound?: { title: string; hint?: string; action?: ReactNode } }) {
  const { t } = useI18n();
  if (!error) return null;
  const api = error instanceof ApiError ? error : null;
  // Erros de página (404/403) viram um estado explicado, com saída; os demais oferecem tentar de novo.
  const kind = api?.status === 0 ? "offline" : api?.status === 404 ? "notFound" : api?.status === 403 ? "forbidden" : "generic";
  const Title = page ? "h1" : "p";
  if (kind === "notFound" && notFound) return <EmptyState title={notFound.title} hint={notFound.hint} action={notFound.action} heading={page} />;
  const title = kind === "offline" ? t("common.offline") : kind === "notFound" ? t("errors.notFoundTitle") : kind === "forbidden" ? t("errors.forbiddenTitle") : t("common.errorTitle");
  const hint = kind === "notFound" ? t("errors.notFoundHint") : kind === "forbidden" ? t("errors.forbiddenHint") : error.message;
  return (
    <div role="alert" className="surface p-6">
      <Title className={page ? "type-h1 text-ink" : "type-h3 text-ink"}>{title}</Title>
      <p className="type-body text-muted mt-1">{hint}</p>
      {api?.correlationId && kind === "generic" && <p className="type-caption text-muted mt-1">{t("common.errorHint")}: <code className="type-data">{api.correlationId}</code></p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {onRetry && (kind === "generic" || kind === "offline") && <Button onClick={onRetry}>{t("common.retry")}</Button>}
        {(kind === "notFound" || kind === "forbidden") && <a href="/feed" className="btn btn-primary">{t("common.voltar_ao_feed")}</a>}
      </div>
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

/* ---------- Sobreposições: foco preso, Escape, rolagem travada e foco devolvido ao gatilho ---------- */
export const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, onClose: () => void, opts?: { lockScroll?: boolean; initial?: "first" | "container" }) {
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (!active) return;
    const el = ref.current; if (!el) return;
    const previous = document.activeElement as HTMLElement | null;
    const items = () => Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.getClientRects().length > 0);
    const autofocus = el.querySelector<HTMLElement>("[data-autofocus]");
    (autofocus ?? (opts?.initial === "container" ? null : items()[0]) ?? el).focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const t = e.target as HTMLElement | null;             // Esc com uma lista ou menu aberto fecha só a lista/menu
        if (t?.closest?.('[role="menu"], [role="listbox"], [aria-expanded="true"][aria-haspopup]')) return;
        e.stopPropagation(); close.current(); return;
      }
      if (e.key !== "Tab") return;
      const list = items(); if (!list.length) { e.preventDefault(); return; }
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    const html = document.documentElement; const prevOverflow = html.style.overflow;
    if (opts?.lockScroll !== false) html.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey, true); html.style.overflow = prevOverflow; previous?.focus?.({ preventScroll: true }); };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
}
/** Fecha um popover ao clicar fora ou apertar Escape; devolve o foco ao gatilho. */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close.current(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { close.current(); (ref.current?.querySelector("[aria-haspopup]") as HTMLElement | null)?.focus(); } };
    document.addEventListener("pointerdown", onDown); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, ref]);
}

/* ---------- Dialog ---------- */
export function Dialog({ open, onClose, title, children, footer, size }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: "lg" | "xl" }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, open, onClose);
  if (!open) return null;
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`dialog ${size ? `dialog-${size}` : ""}`}>
        <div className="dialog-head">
          <h2 id={titleId} className="type-h2">{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" aria-label={t("common.fechar")} onClick={onClose}><UiIcon name="close" /></button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}

/** Painel que sobe do rodapé no celular e abre na lateral direita no desktop (filtros, criar, opções). */
export function Sheet({ open, onClose, title, children, footer, side = "auto" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; side?: "auto" | "bottom" }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, open, onClose);
  if (!open) return null;
  return (
    <div className={cn("sheet-backdrop", side === "bottom" && "sheet-always-bottom")} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="sheet">
        <div className="sheet-grip" aria-hidden />
        <div className="sheet-head">
          <h2 id={titleId} className="type-h3">{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" aria-label={t("common.fechar")} onClick={onClose}><UiIcon name="close" /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export interface MenuItem { label: string; onSelect?: () => void; href?: string; danger?: boolean; icon?: ReactNode; hidden?: boolean; disabled?: boolean; }
/** Menu de ações secundárias ("Mais"): botão + lista com navegação por setas, Escape e clique fora. */
export function ActionMenu({ items, label, className, trigger, align = "end", direction = "down" }: { items: MenuItem[]; label?: string; className?: string; trigger?: ReactNode; align?: "start" | "end";
  /** "up": abre acima do botão (menu no fim de uma coluna rolável, onde abrir para baixo cortaria os itens) */ direction?: "down" | "up" }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useDismiss(box, open, () => setOpen(false));
  const visible = items.filter((i) => !i.hidden);
  useEffect(() => { if (open) box.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(); }, [open]);
  const onKey = (e: ReactKeyboardEvent) => {
    const list = Array.from(box.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
    if (e.key === "Tab") setOpen(false);
  };
  if (!visible.length) return null;
  return (
    <div ref={box} className={cn("relative inline-flex", className)}>
      <button type="button" className={trigger ? "btn" : "btn btn-icon"} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
        aria-label={trigger ? undefined : (label ?? t("common.moreOptions"))} title={trigger ? undefined : (label ?? t("common.moreOptions"))} onClick={() => setOpen((o) => !o)}>
        {trigger ?? <UiIcon name="more" />}
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={label ?? t("common.moreOptions")} className={cn("menu-pop", align === "start" ? "left-0" : "right-0", direction === "up" && "is-up")} onKeyDown={onKey}>
          {visible.map((it) => it.href
            ? <a key={it.label} role="menuitem" tabIndex={-1} href={it.href} className={cn("menu-item", it.danger && "is-danger")} onClick={() => setOpen(false)}>{it.icon}{it.label}</a>
            : <button key={it.label} role="menuitem" tabIndex={-1} type="button" disabled={it.disabled} className={cn("menu-item", it.danger && "is-danger")} onClick={() => { setOpen(false); it.onSelect?.(); }}>{it.icon}{it.label}</button>)}
        </div>
      )}
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
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), text.length > 120 ? 10000 : kind === "error" ? 7000 : 4000);   // aviso longo: tempo de ler
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
    fromError: (e: unknown, fallback = tr("ui.index.algo_deu_errado_tente_de")) => e instanceof ApiError && e.code === "IMAGEM_EM_REVISAO"
      ? push("info", e.message)   // foto retida pela moderação: não é erro de quem enviou, é um aviso
      : push("error", e instanceof ApiError ? `${e.message}${e.correlationId ? ` (${e.correlationId.slice(0, 8)})` : ""}` : fallback),
  };
}
