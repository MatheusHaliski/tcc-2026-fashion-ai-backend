/*
 * MATRIZ-3D · verificação e geração da matriz de rastreabilidade da vestimenta 3D (docs/avatar3d/matriz-3d/).
 *
 *   npx vitest run lib/avatar3d/matriz3d                      confere cobertura, referências e a assinatura versionada
 *   MATRIZ3D_WRITE=1 npx vitest run lib/avatar3d/matriz3d     regrava tabelas (CSV/JSON), catálogo visual e rastreio
 *   python3 scripts/avatar3d/matriz3d_xlsx.py                 exporta as tabelas para planilha
 *
 * Sempre: toda subcategoria da taxonomia tem linha; todo arquivo/símbolo/teste citado existe; componente que não se
 * aplica nunca aparece como "Ausente"; a assinatura (subcategoria · componente · estado) bate com a versionada — se não
 * bater, a construção mudou e a matriz precisa ser regravada (o erro diz o que mudou).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "@/lib/avatar3d/human/asset";
import { compose, fitBody } from "@/lib/avatar3d/human/compose";
import { DEFAULT_BODY } from "@/lib/avatar3d/body-spec";
import { fitReport } from "@/lib/avatar3d/human/fit-metrics";
import { fitClassOf, necklineOf, specFor } from "@/lib/avatar3d/human/garment-fit";
import { kindOf, type GarmentKind } from "@/lib/avatar3d/human/garments";
import { COMPONENTES, ESTADOS } from "./registry";
import { buildMatrix, COLUNAS_DETALHE, COLUNAS_PRINCIPAL, ICONE, signature, toCsv, type FitRow, type Legacy, type Matriz, type Taxonomy } from "./matrix";
import { build, probeEnv, prober, type Built, type ProbeEnv } from "./probe";
import { CORES, render, sideBySide, type Image, type Mesh } from "./raster";

const ROOT = new URL("../../../", import.meta.url);
const at = (p: string) => new URL(p, ROOT);
const OUT = "docs/avatar3d/matriz-3d/";
const WRITE = !!process.env.MATRIZ3D_WRITE;

const meta = JSON.parse(readFileSync(at("public/avatar3d/body/fai-body-v1.json"), "utf-8")) as BodyMeta;
const bin = readFileSync(at("public/avatar3d/body/fai-body-v1.bin"));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
const bodyOf = (sex: "FEMININO" | "MASCULINO") => compose(asset, fitBody(asset, { sex }).z, null, DEFAULT_BODY[sex].stature);
const taxonomy = JSON.parse(readFileSync(at("fai-application/src/main/resources/taxonomy/taxonomy.json"), "utf-8")) as Taxonomy;
const normalization = JSON.parse(readFileSync(at("fai-application/src/main/resources/catalog/normalization.json"), "utf-8")) as { legacySubcategories: Legacy };
const FIT_FILE = "docs/provador/metricas/vestir-depois-2026-10-10.json";
const fitRows = existsSync(at(FIT_FILE)) ? JSON.parse(readFileSync(at(FIT_FILE), "utf-8")) as FitRow[] : [];

const envF = probeEnv(asset, bodyOf("FEMININO"));
const probeF = prober(envF);
const matriz: Matriz = buildMatrix(taxonomy, normalization.legacySubcategories, (p) => probeF(p).obs, fitRows);

describe("MATRIZ-3D — rastreabilidade da vestimenta 3D", () => {
  it("toda subcategoria da taxonomia tem uma linha, com família e caminho de construção", () => {
    expect(matriz.principal.map((r) => r["ID da subcategoria"]).sort()).toEqual(taxonomy.subcategories.map((s) => s.code).sort());
    for (const r of matriz.principal) expect(r["Asset base"]).not.toBe("");
  });

  it("todo arquivo, símbolo e teste citado existe (nenhuma referência quebrada)", () => {
    const broken: string[] = []; const text = new Map<string, string>();
    const read = (f: string) => { if (!text.has(f)) text.set(f, existsSync(at(f)) ? readFileSync(at(f), "utf-8") : ""); return text.get(f)!; };
    for (const c of COMPONENTES) {
      for (const r of c.refs) { const t = read(r.file); if (!t) broken.push(`${c.id}: arquivo ${r.file}`); else if (!t.includes(r.symbol)) broken.push(`${c.id}: símbolo "${r.symbol}" em ${r.file}`); }
      for (const tr of c.testes) { const t = read(tr.file); if (!t) broken.push(`${c.id}: teste ${tr.file}`); else if (tr.testName && !t.includes(tr.testName)) broken.push(`${c.id}: título "${tr.testName}" em ${tr.file}`); }
      for (const d of c.deps) if (!COMPONENTES.some((x) => x.id === d)) broken.push(`${c.id}: dependência ${d}`);
    }
    expect(broken).toEqual([]);
  });

  it("o que não se aplica nunca é \"Ausente\" e todo estado é um dos cinco", () => {
    for (const d of matriz.detalhe) {
      expect(ESTADOS).toContain(d.estado);
      if (d.aplicabilidade === "Não aplicável") expect(d.estado).toBe("Não aplicável");
    }
    // a regata não tem manga: a manga nunca é "Ausente" nela
    expect(matriz.detalhe.find((d) => d.subcategoria === "tank_top" && d.componente === "manga.molde")?.estado).toBe("Não aplicável");
    // a camisa tem carcela, botões e pesponto reais e validados
    for (const id of ["fechamento.vista", "botoes.disco", "costura.pesponto"]) expect(matriz.detalhe.find((d) => d.subcategoria === "shirt" && d.componente === id)?.estado).toBe("Implementado e validado");
  });

  it("a assinatura (subcategoria · componente · estado) bate com a matriz versionada", () => {
    const file = at(`${OUT}matriz-3d.json`);
    if (WRITE || !existsSync(file)) return;
    const saved = JSON.parse(readFileSync(file, "utf-8")) as { assinatura: string[] };
    const now = signature(matriz), before = saved.assinatura;
    const added = now.filter((x) => !before.includes(x)), removed = before.filter((x) => !now.includes(x));
    expect({ mudou: added.slice(0, 20), antes: removed.slice(0, 20) }, "a construção mudou: rode MATRIZ3D_WRITE=1 npx vitest run lib/avatar3d/matriz3d e revise o diff").toEqual({ mudou: [], antes: [] });
  });

  it.runIf(WRITE)("grava tabelas, catálogo visual e rastreio de peças reais", { timeout: 600_000 }, () => {
    mkdirSync(at(`${OUT}catalogo/rastreio`), { recursive: true });
    const rastreio = traces();
    const full = { ...matriz, rastreio };
    // o JSON guarda a assinatura (o que o teste compara), a biblioteca, os achados e o rastreio; as tabelas grandes ficam nos CSV
    writeFileSync(at(`${OUT}matriz-3d.json`), jsonLines({ versao: matriz.versao, assinatura: signature(matriz), biblioteca: matriz.biblioteca, achados: matriz.achados, rastreio }));
    writeFileSync(at(`${OUT}matriz-principal.csv`), toCsv(matriz.principal, COLUNAS_PRINCIPAL));
    writeFileSync(at(`${OUT}componentes.csv`), toCsv(matriz.detalhe as unknown as Record<string, unknown>[], COLUNAS_DETALHE));
    writeFileSync(at(`${OUT}biblioteca.csv`), toCsv(matriz.biblioteca as unknown as Record<string, unknown>[], Object.keys(matriz.biblioteca[0])));
    writeFileSync(at(`${OUT}achados.csv`), toCsv(matriz.achados as unknown as Record<string, unknown>[], ["tipo", "onde", "detalhe", "impacto"]));
    catalog();
    writeFileSync(at(`${OUT}GERADO.md`), report(full).trimEnd() + "\n");
  });
});

/** JSON com um registro por linha: cada célula da matriz é uma linha no diff do git. */
function jsonLines(obj: Record<string, unknown>): string {
  const parts = Object.entries(obj).map(([k, v]) => Array.isArray(v)
    ? `${JSON.stringify(k)}: [\n${v.map((x) => `  ${JSON.stringify(x)}`).join(",\n")}\n]`
    : `${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  return `{\n${parts.join(",\n")}\n}\n`;
}

// ======================================================================== catálogo visual
function meshesOf(b: Built, env: ProbeEnv, fabric?: [number, number, number]): Mesh[] {
  const rv = env.asset.body.renderVertex; const idx = env.asset.body.index; const bi = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) bi[i] = rv[idx[i]];
  const out: Mesh[] = [{ position: env.c.body, index: bi, color: CORES.corpo }];
  if (b.gg && b.obs.kind !== "shoes") {
    // casca e tubo em cores diferentes: a origem de cada triângulo diz se ele nasceu da pele ou do tubo
    const pele: number[] = [], tubo: number[] = [];
    for (let t = 0; t < b.gg.index.length; t += 3) { const a = b.gg.index[t]; (b.gg.source[a] < 0 ? tubo : pele).push(a, b.gg.index[t + 1], b.gg.index[t + 2]); }
    out.push({ position: b.gg.position, index: pele, color: fabric ?? CORES.molde, alpha: b.gg.alpha }, { position: b.gg.position, index: tubo, color: CORES.tubo });
  }
  for (const t of b.trims) out.push({ position: t.position, index: t.index, color: CORES[t.part] ?? CORES.barra });
  if (b.collar) out.push({ position: b.collar.position, index: b.collar.index, color: CORES.gola });
  for (const s of b.shoes) out.push({ position: s.position, index: s.index, color: CORES[s.name] ?? CORES.cabedal });
  return out;
}

function frame(b: Built, env: ProbeEnv, fabric?: [number, number, number], zoom?: { x0: number; x1: number; y0: number; y1: number; side?: boolean }): Image {
  const m = meshesOf(b, env, fabric);
  if (zoom) return render(m, { axis: zoom.side ? "side" : "front", x0: zoom.x0, x1: zoom.x1, y0: zoom.y0, y1: zoom.y1 }, 360);
  return sideBySide([render(m, { axis: "front", x0: -0.5, x1: 0.5, y0: -0.05, y1: 1.85 }, 220), render(m, { axis: "side", x0: -0.35, x1: 0.35, y0: -0.05, y1: 1.85 }, 154)]);
}

function catalog() {
  const kinds = new Map<GarmentKind, string>();
  for (const s of taxonomy.subcategories) { const k = kindOf({ category: s.category, subcategory: s.code }); if (k && !kinds.has(k)) kinds.set(k, s.code); }
  for (const [k, sub] of kinds) {
    const cat = taxonomy.subcategories.find((s) => s.code === sub)!.category;
    writePng(`${OUT}catalogo/${k}.png`, frame(probeF({ category: cat, subcategory: sub }), envF));
  }
  // closes dos componentes: carcela + botões + pesponto + pontas da gola; gola de ribana; punho e barra; tubo; calçado
  const P = envF.P; const neck = P.neckY, hip = P.hipY;
  const shirt = probeF({ category: "upper_piece", subcategory: "shirt" });
  writePng(`${OUT}catalogo/componente-camisa-frente.png`, frame(shirt, envF, undefined, { x0: -0.16, x1: 0.16, y0: hip - 0.12, y1: neck + 0.06 }));
  writePng(`${OUT}catalogo/componente-gola-ribana.png`, frame(probeF({ category: "upper_piece", subcategory: "t_shirt" }), envF, undefined, { x0: -0.14, x1: 0.14, y0: neck - 0.16, y1: neck + 0.06 }));
  writePng(`${OUT}catalogo/componente-punho-barra.png`, frame(probeF({ category: "upper_piece", subcategory: "sweater" }), envF, undefined, { x0: -0.45, x1: 0.45, y0: hip - 0.2, y1: neck - 0.15 }));
  writePng(`${OUT}catalogo/componente-tubo-saia.png`, frame(probeF({ category: "lower_piece", subcategory: "skirt" }), envF, undefined, { x0: -0.3, x1: 0.3, y0: hip - 0.55, y1: hip + 0.15 }));
  writePng(`${OUT}catalogo/componente-calcado-tenis.png`, frame(probeF({ category: "shoes_piece", subcategory: "casual_sneakers" }), envF, undefined, { x0: -0.14, x1: 0.3, y0: -0.03, y1: 0.18, side: true }));
  writePng(`${OUT}catalogo/componente-bota-cano.png`, frame(probeF({ category: "shoes_piece", subcategory: "boots" }), envF, undefined, { x0: -0.14, x1: 0.3, y0: -0.03, y1: 0.55, side: true }));
}

// ======================================================================== rastreio de peças reais do acervo
interface Trace { alvo: string; registro: Record<string, unknown>; atributos: Record<string, unknown>; divergencias: string[]; componentes: { id: string; estado: string; implementacao: string; parametros: string }[]; asset_final: string[]; prova: Record<string, unknown>; imagem: string }

/** O que o nome da peça diz e o molde não reproduz (o catálogo não traz atributos; só o decote é lido do nome). */
const NOME_VARIACAO: [RegExp, string][] = [[/skinny/, "SKINNY"], [/\bslim\b/, "SLIM"], [/straight|\breta\b/, "STRAIGHT"], [/bootcut/, "BOOTCUT"], [/wide[\s-]?leg|pantalona/, "WIDE_LEG"],
  [/\bflare\b/, "FLARE"], [/baggy/, "BAGGY"], [/oversized?/, "OVERSIZED"], [/\bloose\b/, "LOOSE"]];

function divergencias(name: string, sleeve: number, kind: string | null, fit?: string | null, fp?: Parameters<typeof fitClassOf>[0]): string[] {
  const out: string[] = []; const n = name.toLowerCase();
  // divergência só quando o cós produzido não é o de uma peça declarada com cintura alta (RISE=HIGH_RISE)
  if (/high[\s-]?rise|cintura alta|super high/.test(n) && fp) {
    const got = specFor(fp)?.waist, high = specFor({ ...fp, attributes: { ...fp.attributes, RISE: ["HIGH_RISE"] } })?.waist;
    if (got !== undefined && high !== undefined && Number.isFinite(high) && !(got! >= high! - 1e-9)) out.push(`o nome diz cintura alta, o cós sai em ${got} (cintura alta declarada: ${high})`);
  }
  for (const [re, code] of NOME_VARIACAO) if (re.test(n) && fp) {
    const lida = fitClassOf({ ...fp, variation: code });
    if (lida !== fit) out.push(`o nome diz ${code}: lida como variação seria \"${lida}\", o molde usa \"${fit}\" (variação não é lida do nome)`);
  }
  if (/long[\s-]?sleeve|manga longa/.test(n) && sleeve < 0.6) out.push(`o nome diz manga longa, o molde sai com manga ${sleeve} (SLEEVE_LENGTH não é lido do nome)`);
  if (/short[\s-]?sleeve|manga curta/.test(n) && sleeve > 0.6) out.push(`o nome diz manga curta, o molde sai com manga ${sleeve}`);
  if (/sleeveless|sem manga|regata/.test(n) && sleeve > 0) out.push("o nome diz sem manga, o molde sai com manga");
  if (/polo/.test(n) && kind === "tee") out.push("polo vira camiseta: sem gola dobrada nem vista de botões (gola.polo ausente)");
  if (/button|bot[aã]o|bot[oõ]es/.test(n) && kind !== "shirt") out.push("o nome cita botões, o molde não tem vista de botões");
  return out;
}

const HEX: Record<string, string> = { black: "#1d1d1f", white: "#f2f2ee", off_white: "#ece6d8", navy: "#1f2a44", blue: "#2f5fa7", light_blue: "#9cc1e6", denim: "#40618f", gray: "#8a8d91", light_gray: "#c9cbcd",
  dark_gray: "#4a4c50", red: "#b8242c", green: "#3b7a4a", olive: "#6b6b3a", beige: "#d8c7a6", brown: "#6b4a2f", pink: "#e3a1b5", yellow: "#e8c547", burgundy: "#6d1f2c", khaki: "#b7a77a" };
const rgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function traces(): Trace[] {
  const gz = at("data/catalog/acervo/acervo-oficial-2026-10-05.jsonl.gz");
  if (!existsSync(gz)) return [];
  const rows = gunzipSync(readFileSync(gz)).toString("utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, string>);
  const pick = (sub: string, re?: RegExp) => rows.find((r) => r.subcategory === sub && (!re || re.test(r.product_name ?? ""))) ?? rows.find((r) => r.subcategory === sub);
  const alvos: [string, Record<string, string> | undefined][] = [
    ["camiseta", pick("t_shirt")], ["polo", pick("polo_shirt")], ["camisa com botões", pick("shirt", /bot[aã]o|button|oxford|social/i)], ["calça jeans", pick("jeans")],
  ];
  const out: Trace[] = [];
  for (const [alvo, r] of alvos) {
    if (!r) continue;
    const category = (["jeans"].includes(r.subcategory) ? "lower_piece" : "upper_piece");
    const fp = { name: r.product_name, category, subcategory: r.subcategory };
    const spec = specFor(fp)!; const kind = kindOf(fp);
    const comps = matriz.detalhe.filter((d) => d.subcategoria === r.subcategory && d.estado !== "Não aplicável" && d.estado !== "Ausente");
    const prova: Record<string, unknown> = {};
    const slug = alvo.normalize("NFD").replace(/[^a-z ]/gi, "").trim().replace(/\s+/g, "-").toLowerCase();
    const color = HEX[r.color ?? ""] ?? "#6f8fb5";
    for (const sex of ["FEMININO", "MASCULINO"] as const) {
      const env = sex === "FEMININO" ? envF : probeEnv(asset, bodyOf(sex));
      const b = build(env, { category, subcategory: r.subcategory, name: r.product_name });
      const rep = b.gg ? fitReport(asset, env.P, b.gg, env.c.body, env.normals) : null;
      prova[sex] = { vertices: b.obs.molde?.verts ?? 0, triangulos: b.obs.molde?.tris ?? 0, penetracao_repouso: rep ? Math.round(rep.penetration * 10000) / 100 + "%" : "—",
        acabamentos: b.obs.acabamentos, gola_vertices: b.obs.gola };
      if (sex === "FEMININO") writePng(`${OUT}catalogo/rastreio/${slug}.png`, frame(b, env, rgb(color)));
    }
    out.push({
      alvo,
      registro: { marca: r.brand, nome: r.product_name, subcategoria: r.subcategory, cor: r.color ?? null, url_oficial: r.official_product_url, fonte: "data/catalog/acervo/acervo-oficial-2026-10-05.jsonl.gz" },
      atributos: { molde: kind, classe_caimento: fitClassOf(fp), decote: necklineOf(fp), folga_mm: Math.round(spec.ease * 1000), manga: spec.sleeve, barra_h: spec.hem, cos_h: spec.waist, perna: spec.leg, perna_coluna: spec.legColumn },
      divergencias: divergencias(r.product_name ?? "", spec.sleeve, kind, fitClassOf(fp), fp),
      componentes: comps.map((d) => ({ id: d.componente, estado: d.estado, implementacao: d.simbolo || "—", parametros: d.parametros })),
      asset_final: comps.map((d) => d.asset).filter((x, i, a) => x && a.indexOf(x) === i).map((x) => x.replace("<id>", "<peça>")),
      prova, imagem: `catalogo/rastreio/${slug}.png`,
    });
  }
  return out;
}

// ======================================================================== relatório gerado (Markdown)
function report(m: Matriz & { rastreio: Trace[] }): string {
  const L: string[] = [];
  L.push("<!-- gerado por lib/avatar3d/matriz3d/matriz3d.test.ts (MATRIZ3D_WRITE=1) — não editar à mão -->", "# MATRIZ-3D — relatório gerado", "");
  L.push(`Versões: taxonomia ${m.versao.taxonomia} · molde \`${m.versao.molde}\` · contrato ${m.versao.contrato} · corpo \`${m.versao.corpo}\`.`, "");
  L.push("Legenda: ✔ implementado e validado · ◐ implementado, sem validação · ◑ parcial · ✖ ausente · — não aplicável.", "");
  // cobertura por estado
  const tot = new Map<string, number>(); for (const d of m.detalhe) tot.set(d.estado, (tot.get(d.estado) ?? 0) + 1);
  L.push("## Cobertura", "", "| Estado | Células |", "|---|---:|", ...ESTADOS.map((e) => `| ${ICONE[e]} ${e} | ${tot.get(e) ?? 0} |`), "");
  // tabela compacta: subcategoria × grupo (pior estado aplicável)
  const ordem = ["Ausente", "Parcial", "Implementado, sem validação", "Implementado e validado"];
  const grupos = [...new Set(COMPONENTES.map((c) => c.grupo))];
  L.push("## Subcategoria × grupo (pior estado entre os componentes que se aplicam)", "", `| Subcategoria | Molde | ${grupos.join(" | ")} |`, `|---|---|${grupos.map(() => ":-:").join("|")}|`);
  for (const r of m.principal) {
    const cells = grupos.map((g) => {
      const ds = m.detalhe.filter((d) => d.subcategoria === r["ID da subcategoria"] && d.grupo === g && d.estado !== "Não aplicável");
      if (!ds.length) return "—";
      const worst = ordem.find((o) => ds.some((d) => d.estado === o)) as keyof typeof ICONE;
      return `${ICONE[worst]}${ds.length > 1 ? ` ${ds.filter((d) => d.estado === "Implementado e validado").length}/${ds.length}` : ""}`;
    });
    L.push(`| \`${r["ID da subcategoria"]}\`${r["Status"] !== "ACTIVE" ? " (legado)" : ""} | ${r["Molde"]} | ${cells.join(" | ")} |`);
  }
  L.push("", "## Lacuna principal por subcategoria", "", "| Subcategoria | Estado de suporte | Principal lacuna |", "|---|---|---|");
  for (const r of m.principal) L.push(`| \`${r["ID da subcategoria"]}\` | ${r["Estado de suporte"]} | ${r["Principal lacuna"].replace(/\|/g, "/")} |`);
  L.push("", "## Biblioteca de componentes", "", "| Componente | Grupo | Implementação | Moldes validados | Usado em | Ausente em | Lacuna |", "|---|---|---|---|---:|---:|---|");
  for (const b of m.biblioteca) L.push(`| \`${b.componente}\` ${b.nome} | ${b.grupo} | ${b.arquivo === "—" ? "—" : b.arquivo.split("; ").map((f) => `\`${f}\``).join("<br>")} | ${b.moldes_validados} | ${b.uso} | ${b.ausente_em} | ${b.lacuna} |`);
  L.push("", "## Achados (inconsistências, código legado, componentes sem teste)", "", "| Tipo | Onde | Detalhe | Impacto |", "|---|---|---|:-:|");
  for (const a of [...m.achados].sort((x, y) => y.impacto - x.impacto)) L.push(`| ${a.tipo} | \`${a.onde}\` | ${a.detalhe} | ${a.impacto} |`);
  L.push("", "## Rastreio de peças reais do acervo", "");
  for (const t of m.rastreio) {
    const reg = t.registro as Record<string, string>;
    L.push(`### ${t.alvo} — ${reg.marca} · ${reg.nome}`, "", `Registro: \`${reg.subcategoria}\` · cor ${reg.cor ?? "—"} · [página oficial](${reg.url_oficial}) · fonte \`${reg.fonte}\`.`, "");
    L.push(`Atributos → molde: \`${JSON.stringify(t.atributos)}\``, "");
    if (t.divergencias.length) L.push("**Divergências entre o registro e o molde:**", "", ...t.divergencias.map((d) => `- ${d}`), "");
    L.push("| Componente | Estado | Implementação | Parâmetros |", "|---|---|---|---|");
    for (const c of t.componentes) L.push(`| \`${c.id}\` | ${ICONE[c.estado as keyof typeof ICONE]} ${c.estado} | ${c.implementacao.replace(/\|/g, "/")} | ${c.parametros.replace(/\|/g, "/")} |`);
    L.push("", `Asset final no provador: ${t.asset_final.map((a) => `\`${a}\``).join(", ")}.`, "", `Prova no avatar (corpo de referência F e M, pose de repouso): \`${JSON.stringify(t.prova)}\``, "", `![${t.alvo}](${t.imagem})`, "");
  }
  return L.join("\n") + "\n";
}

// ======================================================================== PNG (sem dependências)
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf: Uint8Array): number { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, "ascii"), Buffer.from(data)]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]);
}
function writePng(path: string, img: Image) {
  const raw = Buffer.alloc((img.width * 3 + 1) * img.height);
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) { const o = (y * img.width + x) * 4, r = y * (img.width * 3 + 1) + 1 + x * 3; raw[r] = img.data[o]; raw[r + 1] = img.data[o + 1]; raw[r + 2] = img.data[o + 2]; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(img.width, 0); ihdr.writeUInt32BE(img.height, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(at(path), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", new Uint8Array(0))]));
}
