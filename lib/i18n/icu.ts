/**
 * Subconjunto do ICU MessageFormat usado nos catálogos:
 *   {nome}                                   variável
 *   {n, plural, =0 {nenhum} one {# item} other {# itens}}   plural (Intl.PluralRules), `#` = número formatado, offset:N
 *   {n, selectordinal, one {#º} other {#º}}  ordinal
 *   {sexo, select, feminino {ela} other {ele}}               seleção
 *   {valor, number} {valor, number, percent} {valor, number, integer}
 *   {data, date} {data, date, short|medium|long} {hora, time}
 *   <0>texto</0> <1/>                         marcação rica: o `rich()` troca cada tag por um elemento React; o `t()` mantém só o texto
 * Apóstrofo: `''` é um apóstrofo; `'{'`, `'}'` e `'<'` protegem os caracteres literais.
 */
export type IcuNode = string | IcuArg | IcuTag;
export interface IcuArg {
  name: string;
  type?: "plural" | "selectordinal" | "select" | "number" | "date" | "time";
  style?: string;
  offset?: number;
  options?: Record<string, IcuNode[]>;
}
export interface IcuTag { tag: string; children: IcuNode[] }
export const isTag = (n: IcuNode): n is IcuTag => typeof n !== "string" && "tag" in n;

const cache = new Map<string, IcuNode[]>();
const TAG_RE = /^<(\/?)([A-Za-z0-9_]+)\s*(\/?)>/;

export function parseIcu(message: string): IcuNode[] {
  const hit = cache.get(message);
  if (hit) return hit;
  const s = message;
  let i = 0;
  const skipWs = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const readUntil = (stop: string) => { let out = ""; while (i < s.length && !stop.includes(s[i])) out += s[i++]; return out.trim(); };
  const parseMessage = (inPlural: boolean, nested: boolean, closeTag?: string): IcuNode[] => {
    const nodes: IcuNode[] = []; let buf = "";
    const flush = () => { if (buf) { nodes.push(buf); buf = ""; } };
    while (i < s.length) {
      const ch = s[i];
      if (ch === "'") {
        if (s[i + 1] === "'") { buf += "'"; i += 2; continue; }
        const next = s[i + 1];
        if (next === "{" || next === "}" || next === "<" || (inPlural && next === "#")) {
          i++;
          while (i < s.length) {
            if (s[i] === "'") { if (s[i + 1] === "'") { buf += "'"; i += 2; continue; } i++; break; }
            buf += s[i++];
          }
          continue;
        }
        buf += "'"; i++; continue;
      }
      if (ch === "<") {
        const m = TAG_RE.exec(s.slice(i, i + 40));
        if (m) {
          const [full, closing, name, selfClosing] = m;
          if (closing) {
            if (closeTag === name) { i += full.length; break; }   // fecha a tag em aberto
            buf += full; i += full.length; continue;               // fechamento órfão: literal
          }
          flush(); i += full.length;
          if (selfClosing) { nodes.push({ tag: name, children: [] }); continue; }
          nodes.push({ tag: name, children: parseMessage(inPlural, nested, name) });
          continue;
        }
      }
      if (ch === "{") { flush(); i++; nodes.push(parseArg()); continue; }
      if (ch === "}" && nested) break;
      if (ch === "#" && inPlural) { flush(); nodes.push({ name: "#" }); i++; continue; }
      buf += ch; i++;
    }
    flush();
    return nodes;
  };
  const parseArg = (): IcuArg => {
    skipWs();
    const name = readUntil(",}");
    if (s[i] !== ",") { i++; return { name }; }
    i++; skipWs();
    const type = readUntil(",}") as IcuArg["type"];
    if (s[i] !== ",") { i++; return { name, type }; }
    i++;
    if (type === "plural" || type === "select" || type === "selectordinal") {
      const options: Record<string, IcuNode[]> = {}; let offset: number | undefined;
      for (;;) {
        skipWs();
        if (i >= s.length) break;
        if (s[i] === "}") { i++; break; }
        const key = readUntil("{ \t\n}");
        if (key.startsWith("offset:")) { offset = Number(key.slice(7)); continue; }
        skipWs();
        if (s[i] !== "{") break;                      // malformado: encerra a leitura das opções
        i++;
        options[key] = parseMessage(type !== "select", true);
        if (s[i] === "}") i++;
      }
      return { name, type, options, offset };
    }
    skipWs();
    const style = readUntil("}");
    if (s[i] === "}") i++;
    return { name, type, style: style || undefined };
  };
  const nodes = parseMessage(false, false);
  cache.set(message, nodes);
  return nodes;
}

export type IcuVars = Record<string, unknown> | undefined;

function fmtNumber(v: number, locale: string, style?: string) {
  const opts: Intl.NumberFormatOptions = style === "percent" ? { style: "percent", maximumFractionDigits: 0 }
    : style === "integer" ? { maximumFractionDigits: 0 } : {};
  return new Intl.NumberFormat(locale, opts).format(v);
}

export function formatIcu(nodes: IcuNode[], vars: IcuVars, locale: string, pluralValue?: number): string {
  let out = "";
  for (const n of nodes) {
    if (typeof n === "string") { out += n; continue; }
    if (isTag(n)) { out += formatIcu(n.children, vars, locale, pluralValue); continue; }
    if (n.name === "#") { out += fmtNumber(pluralValue ?? 0, locale); continue; }
    const v = vars?.[n.name];
    if (!n.type) { out += v === undefined || v === null ? `{${n.name}}` : String(v); continue; }
    if (n.type === "number") { out += typeof v === "number" ? fmtNumber(v, locale, n.style) : String(v ?? ""); continue; }
    if (n.type === "date" || n.type === "time") {
      const d = v instanceof Date ? v : new Date(String(v));
      if (Number.isNaN(d.getTime())) { out += String(v ?? ""); continue; }
      const style = (n.style ?? (n.type === "date" ? "medium" : "short")) as "short" | "medium" | "long" | "full";
      out += new Intl.DateTimeFormat(locale, n.type === "date" ? { dateStyle: style } : { timeStyle: style }).format(d);
      continue;
    }
    if (n.type === "plural" || n.type === "selectordinal") {
      const num = Number(v ?? 0); const off = n.offset ?? 0; const opts = n.options ?? {};
      let branch = opts[`=${num}`];
      if (!branch) {
        const cat = new Intl.PluralRules(locale, { type: n.type === "selectordinal" ? "ordinal" : "cardinal" }).select(num - off);
        branch = opts[cat] ?? opts.other ?? [];
      }
      out += formatIcu(branch, vars, locale, num - off);
      continue;
    }
    if (n.type === "select") {
      const key = String(v ?? "other");
      out += formatIcu(n.options?.[key] ?? n.options?.other ?? [], vars, locale, pluralValue);
    }
  }
  return out;
}

/** Nomes das variáveis de uma mensagem (para a verificação de paridade entre idiomas). */
export function icuVariables(message: string): string[] {
  const names = new Set<string>();
  const walk = (nodes: IcuNode[]) => nodes.forEach((n) => {
    if (typeof n === "string") return;
    if (isTag(n)) { walk(n.children); return; }
    if (n.name === "#") return;
    names.add(n.name);
    Object.values(n.options ?? {}).forEach(walk);
  });
  walk(parseIcu(message));
  return [...names].sort();
}

/** Tags de marcação rica de uma mensagem (paridade: a tradução precisa manter as mesmas). */
export function icuTags(message: string): string[] {
  const tags = new Set<string>();
  const walk = (nodes: IcuNode[]) => nodes.forEach((n) => {
    if (typeof n === "string") return;
    if (isTag(n)) { tags.add(n.tag); walk(n.children); return; }
    Object.values(n.options ?? {}).forEach(walk);
  });
  walk(parseIcu(message));
  return [...tags].sort();
}
