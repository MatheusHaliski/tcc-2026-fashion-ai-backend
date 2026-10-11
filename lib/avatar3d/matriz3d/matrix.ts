/*
 * MATRIZ-3D · monta as tabelas a partir da taxonomia (fai-application/.../taxonomy/taxonomy.json), da biblioteca de
 * componentes (registry.ts) e do que a sonda observou (probe.ts):
 *
 *   principal   uma linha por subcategoria (categoria × subcategoria × construção), uma coluna por grupo de elementos
 *   detalhe     uma linha por subcategoria × componente: aplicabilidade, asset, arquivo, símbolo, parâmetros, teste, estado
 *   biblioteca  uma linha por componente: contrato de conexão, dependências, testes, uso
 *   achados     inconsistências encontradas na própria execução (aplicado onde não se aplica, código legado, etc.)
 *
 * Puro (sem fs): o teste da matriz lê os arquivos, confere as referências e grava a saída.
 */
import { kindOf } from "@/lib/avatar3d/human/garments";
import { VARIATION_FIT } from "@/lib/avatar3d/human/garment-fit";
import { RELAX } from "@/lib/avatar3d/human/garment-relax";
import { DEFAULT_PIECES } from "@/lib/avatar3d/human/default-outfit";
import { familyOf, KNOWN_LIMITS } from "@/lib/tryon/garment-asset";
import { ACERVO } from "@/lib/tryon/acervo";
import { GARMENT_CONTRACT_VERSION, MOULD_VERSION, BODY_RIG } from "@/lib/avatar3d/garment-contract";
import { COMPONENTES, GRUPOS, type Componente, type Ctx, type Estado, type Observacao } from "./registry";
import type { ProbePiece } from "./probe";

export interface TaxSub { code: string; category: string; status: string; labels?: Record<string, string>; variations?: { code: string }[] }
export interface Taxonomy { version: string; categories: { code: string; labels: Record<string, string> }[]; subcategories: TaxSub[] }
export interface Legacy { [code: string]: { category: string; replacedBy: string } }
/** Linha do relatório de vestir (docs/provador/metricas/vestir-*.json). */
export interface FitRow { pieceId: string; kind: string; body: string; pose: string; report: { penetration: number } }

export type Observe = (p: ProbePiece) => Observacao;

export interface LinhaDetalhe {
  categoria: string; subcategoria: string; componente: string; nome: string; grupo: string; variacao: string; aplicabilidade: string;
  asset: string; arquivo: string; simbolo: string; parametros: string; dependencias: string; teste: string; estado: Estado; observacao: string;
}
export type LinhaPrincipal = Record<string, string>;
export interface LinhaBiblioteca {
  componente: string; grupo: string; nome: string; familias: string; arquivo: string; simbolo: string; contrato: string; dependencias: string;
  testes: string; moldes_validados: string; uso: number; ausente_em: number; lacuna: string; impacto: string;
}
export interface Achado { tipo: string; onde: string; detalhe: string; impacto: 1 | 2 | 3 }
export interface Matriz { versao: Record<string, string>; principal: LinhaPrincipal[]; detalhe: LinhaDetalhe[]; biblioteca: LinhaBiblioteca[]; achados: Achado[] }

const RELAX_SHOES = RELAX.shoes;
export const ICONE: Record<Estado, string> = { "Implementado e validado": "✔", "Implementado, sem validação": "◐", "Parcial": "◑", "Ausente": "✖", "Não aplicável": "—" };
const SLOT: Record<string, string> = { upper_piece: "UPPER", lower_piece: "LOWER", full_body_piece: "FULL_BODY", shoes_piece: "SHOES", accessory_piece: "ACCESSORY" };
const base = (f: string) => f.split("/").pop() ?? f;
const refTxt = (c: Componente) => c.refs.map((r) => `${r.file}#${r.symbol}`).join("; ");

function ctxOf(s: TaxSub): Ctx {
  const piece = { category: s.category, subcategory: s.code };
  return { category: s.category, sub: s.code, kind: kindOf(piece), family: familyOf(piece), legacy: s.status !== "ACTIVE", variations: (s.variations ?? []).map((x) => x.code) };
}

/** `o` = observado com a variação que liga o componente (sonda); `o0` = a peça como cadastrada (sem atributos). */
function estadoDe(comp: Componente, ctx: Ctx, o: Observacao, o0: Observacao): { estado: Estado; obs: string } {
  const produced = comp.refs.length > 0 && !!comp.produz?.(o);
  // fora da aplicabilidade, só conta o que a peça recebe como cadastrada (a sonda força a variação, ex.: manga em regata)
  if (!comp.aplica(ctx)) return { estado: "Não aplicável", obs: comp.refs.length > 0 && comp.produz?.(o0) ? "produzido sem se aplicar a esta subcategoria (herdado do molde)" : "" };
  if (!comp.refs.length) return { estado: "Ausente", obs: comp.lacuna ?? "" };
  if (!produced) return { estado: "Ausente", obs: `existe na biblioteca (${comp.refs.map((r) => `${base(r.file)}#${r.symbol}`).join(", ")}), mas o molde ${o.kind ?? "—"} não o recebe` };
  const p = comp.parcial?.(ctx, o);
  if (p) return { estado: "Parcial", obs: p };
  const ok = comp.testes.length > 0 && (comp.validados === "todos" || (!!o.kind && comp.validados.includes(o.kind)));
  return ok ? { estado: "Implementado e validado", obs: "" } : { estado: "Implementado, sem validação", obs: comp.testes.length ? `testes não exercitam o molde ${o.kind}` : "nenhum teste do componente" };
}

export function buildMatrix(tax: Taxonomy, legacy: Legacy, observe: Observe, fit: FitRow[] = []): Matriz {
  const cats = new Map(tax.categories.map((c) => [c.code, c.labels["pt-BR"] ?? c.code]));
  const detalhe: LinhaDetalhe[] = []; const principal: LinhaPrincipal[] = []; const achados: Achado[] = [];
  const usage = new Map<string, { uso: number; ausente: number }>();

  for (const s of tax.subcategories) {
    const ctx = ctxOf(s); const piece: ProbePiece = { category: s.category, subcategory: s.code };
    const o0 = observe(piece);
    const porGrupo = new Map<string, string[]>(); const estados: Estado[] = []; let lacuna: { imp: number; txt: string } | null = null;
    const testes = new Set<string>();
    for (const comp of COMPONENTES) {
      if (!comp.familias.includes(ctx.family)) continue;
      const o = comp.sonda ? observe({ ...piece, attributes: comp.sonda }) : o0;
      const { estado, obs } = estadoDe(comp, ctx, o, o0);
      const u = usage.get(comp.id) ?? { uso: 0, ausente: 0 }; usage.set(comp.id, u);
      if (estado === "Implementado e validado" || estado === "Implementado, sem validação" || estado === "Parcial") u.uso++;
      if (estado === "Ausente") u.ausente++;
      if (estado === "Não aplicável" && obs) achados.push({ tipo: "aplicado onde não se aplica", onde: s.code, detalhe: `${comp.nome} (${comp.id}) sai do molde ${o.kind}`, impacto: 2 });
      const produced = estado !== "Ausente" && estado !== "Não aplicável";
      const validTests = estado === "Implementado e validado" ? comp.testes : [];
      for (const t of validTests) testes.add(base(t.file));
      detalhe.push({
        categoria: s.category, subcategoria: s.code, componente: comp.id, nome: comp.nome, grupo: comp.grupo,
        variacao: comp.sonda ? Object.entries(comp.sonda).map(([k, v]) => `${k}=${v.join("+")}`).join(" ") : "padrão",
        aplicabilidade: comp.aplica(ctx) ? "Aplicável" : "Não aplicável", asset: produced ? comp.asset ?? "" : "",
        arquivo: comp.refs.map((r) => r.file).filter((f, i, a) => a.indexOf(f) === i).join("; "), simbolo: comp.refs.map((r) => `${base(r.file)}#${r.symbol}`).join("; "),
        parametros: produced && comp.params ? safe(() => comp.params!(o)) : "", dependencias: comp.deps.join(", "),
        teste: validTests.map((t) => `${t.file} › ${t.testName || "(arquivo)"}`).join("; "), estado, observacao: obs,
      });
      estados.push(estado);
      if (estado !== "Não aplicável") {
        const cell = `${ICONE[estado]} ${comp.nome}${produced && comp.refs[0] ? ` — ${base(comp.refs[0].file)}#${comp.refs[0].symbol}` : ""}${produced && comp.params ? ` (${safe(() => comp.params!(o))})` : ""}`;
        porGrupo.set(comp.grupo, [...(porGrupo.get(comp.grupo) ?? []), cell]);
      }
      if ((estado === "Ausente" || estado === "Parcial") && (comp.impacto ?? 1) > (lacuna?.imp ?? 0)) lacuna = { imp: comp.impacto ?? 1, txt: `${comp.nome}: ${obs || comp.lacuna || ""}` };
    }
    const acervo = ACERVO.find((p) => p.subcategory === s.code);
    const ev = acervo ? fit.filter((r) => r.pieceId === acervo.id && r.body === "F-ref") : [];
    const pen = (pose: string) => ev.find((r) => r.pose === pose)?.report.penetration;
    const count = (e: Estado) => estados.filter((x) => x === e).length;
    const row: LinhaPrincipal = {
      "ID da categoria": s.category, "Categoria": cats.get(s.category) ?? s.category, "ID da subcategoria": s.code, "Subcategoria": s.labels?.["pt-BR"] ?? s.code,
      "Status": s.status, "Slot": SLOT[s.category] ?? "", "Molde": ctx.kind ?? "—", "Família": ctx.family,
      "Variantes suportadas": ctx.kind ? ctx.variations.filter((v) => VARIATION_FIT[v]).map((v) => `${v}→${VARIATION_FIT[v]}`).join(", ") || "padrão da subcategoria" : "—",
      "Variantes sem efeito no molde": String(ctx.variations.filter((v) => !VARIATION_FIT[v]).length),
      "Asset base": ctx.kind ? (ctx.kind === "shoes" ? "fôrma do calçado (shoes.ts)" : `molde:${ctx.kind}`) : "prévia 2D",
      "Molde paramétrico": o0.spec ? `garments.ts#SPECS.${ctx.kind}${o0.spec.construction ? ` + ${o0.spec.construction}` : ""} · folga ${Math.round(o0.spec.ease * 1000)} mm · camada ${o0.spec.layer}` : "—",
      "Versão": ctx.kind ? `${MOULD_VERSION} · contrato ${GARMENT_CONTRACT_VERSION}` : `contrato ${GARMENT_CONTRACT_VERSION}`,
      "Corpo de referência": ctx.kind ? BODY_RIG : "—",
      "Origem": `${ctx.kind ? "PARAMETRIC_MOULD" : "IMAGE_2D"}${acervo ? ` · acervo ${acervo.id}` : ""}${Object.values(DEFAULT_PIECES).some((p) => kindOf(p) === ctx.kind && p.subcategory === s.code) ? " · peça padrão" : ""}`,
    };
    for (const g of GRUPOS) row[g] = (porGrupo.get(g) ?? []).join("\n") || "Não aplicável";
    row["Testes"] = [...testes].sort().join(", ") || "—";
    row["Evidências"] = [ev.length ? `vestir F-ref: exibição ${fmtPct(pen("exibicao"))}, agachamento ${fmtPct(pen("agachamento"))}` : "", ctx.kind ? `catalogo/${ctx.kind}.png` : ""].filter(Boolean).join(" · ") || "—";
    row["Estado de suporte"] = ctx.kind ? `molde estimado (ESTIMADA) · ✔${count("Implementado e validado")} ◐${count("Implementado, sem validação")} ◑${count("Parcial")} ✖${count("Ausente")}` : "SEM_3D (só prévia 2D)";
    row["Principal lacuna"] = lacuna?.txt ?? "—";
    principal.push(row);
  }

  // ---- achados da própria execução
  for (const [code, l] of Object.entries(legacy)) {
    const a = kindOf({ category: l.category, subcategory: code }), b = kindOf({ category: l.category, subcategory: l.replacedBy });
    if (a !== b) achados.push({ tipo: "código legado muda o molde", onde: `${code} → ${l.replacedBy}`, detalhe: `o código antigo vira ${a}, o novo vira ${b}: a mesma peça muda de molde ao migrar`, impacto: 2 });
  }
  // eficiência: tênis e sapato constroem o molde do pé (casca + relaxamento) e o provador o descarta — a fôrma o substitui
  const sapatos = tax.subcategories.filter((s) => kindOf({ category: s.category, subcategory: s.code }) === "shoes");
  if (sapatos.some((s) => observe({ category: s.category, subcategory: s.code }).molde))
    achados.push({ tipo: "eficiência", onde: "dress.ts › buildGarment (kind shoes)", detalhe: `o molde do pé é construído e relaxado (${RELAX_SHOES} iterações) e descartado em human-outfit.tsx: ${sapatos.length} subcategorias de tênis/sapato pagam a construção sem usar`, impacto: 1 });
  const codes = new Set(tax.subcategories.map((s) => s.code));
  for (const p of Object.values(DEFAULT_PIECES)) if (p.subcategory && !codes.has(p.subcategory)) achados.push({ tipo: "parâmetro inconsistente", onde: `default-outfit.ts › ${p.id}`, detalhe: `subcategoria "${p.subcategory}" não existe na taxonomia`, impacto: 1 });
  for (const p of ACERVO) { const s = tax.subcategories.find((x) => x.code === p.subcategory); if (s && s.status !== "ACTIVE") achados.push({ tipo: "acervo com código legado", onde: `acervo.ts › ${p.id}`, detalhe: `usa "${p.subcategory}" (${s.status})`, impacto: 1 }); }
  for (const k of Object.keys(KNOWN_LIMITS)) if (!codes.has(k)) achados.push({ tipo: "parâmetro inconsistente", onde: `garment-asset.ts › KNOWN_LIMITS.${k}`, detalhe: "chave fora da taxonomia", impacto: 1 });

  const biblioteca: LinhaBiblioteca[] = COMPONENTES.map((c) => ({
    componente: c.id, grupo: c.grupo, nome: c.nome, familias: c.familias.join(", "), arquivo: c.refs.map((r) => r.file).filter((f, i, a) => a.indexOf(f) === i).join("; ") || "—",
    simbolo: c.refs.map((r) => r.symbol).join("; ") || "—", contrato: c.contrato ?? "", dependencias: c.deps.join(", "),
    testes: c.testes.map((t) => `${t.file} › ${t.testName || "(arquivo)"}`).join("; ") || "—",
    moldes_validados: c.validados === "todos" ? "todos (caminho único)" : c.validados.join(", ") || "—",
    uso: usage.get(c.id)?.uso ?? 0, ausente_em: usage.get(c.id)?.ausente ?? 0, lacuna: c.lacuna ?? "", impacto: c.impacto ? String(c.impacto) : "",
  }));
  for (const c of COMPONENTES) if (c.refs.length && !c.testes.length) achados.push({ tipo: "componente sem teste", onde: c.id, detalhe: `${c.nome} — ${refTxt(c)}`, impacto: c.impacto ?? 1 });

  return { versao: { taxonomia: tax.version, molde: MOULD_VERSION, contrato: GARMENT_CONTRACT_VERSION, corpo: BODY_RIG }, principal, detalhe, biblioteca, achados };
}

function fmtPct(x: number | undefined) { return x === undefined ? "—" : `${(x * 100).toFixed(1)}%`; }
function safe(f: () => string): string { try { return f(); } catch { return ""; } }

/** Assinatura semântica (subcategoria · componente · estado): o que o teste compara com as tabelas versionadas. */
export function signature(m: Matriz): string[] {
  return m.detalhe.map((d) => `${d.subcategoria}·${d.componente}·${d.estado}`).sort();
}

export const COLUNAS_PRINCIPAL = ["ID da categoria", "Categoria", "ID da subcategoria", "Subcategoria", "Status", "Slot", "Molde", "Família", "Variantes suportadas", "Variantes sem efeito no molde",
  "Asset base", "Molde paramétrico", "Versão", "Corpo de referência", "Origem", ...GRUPOS, "Testes", "Evidências", "Estado de suporte", "Principal lacuna"];
export const COLUNAS_DETALHE: (keyof LinhaDetalhe)[] = ["categoria", "subcategoria", "componente", "nome", "grupo", "variacao", "aplicabilidade", "asset", "arquivo", "simbolo", "parametros", "dependencias", "teste", "estado", "observacao"];

export function toCsv(rows: Record<string, unknown>[], cols: string[]): string {
  const q = (v: unknown) => { const s = v === undefined || v === null ? "" : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => q(r[c])).join(","))].join("\n") + "\n";
}
