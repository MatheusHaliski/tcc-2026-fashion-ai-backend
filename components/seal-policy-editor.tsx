"use client";
import { Button, ChipMultiSelect, Dropdown, Field, Input, SegmentPicker } from "@/components/ui";
import { CATEGORY_KEYS, label, useTaxonomy } from "@/lib/api/taxonomy";
import { useI18n } from "@/lib/i18n/i18n";
import { tr } from "@/lib/i18n/core";
import { LEVELS } from "@/lib/hype/model";
import type { HypeLevel, HypeMomentum } from "@/lib/hype/types";

/**
 * RF25 — política padronizada do selo. No lugar de um texto livre separado por vírgulas, o emissor monta regras que o
 * sistema avalia sozinho nos criadores de peça (RF4) e de look (RF5): "no mínimo 3 peças azuis da Zara", "peça
 * vermelha", "todas as peças amarelas da Adidas". Ocasiões e estilos do selo são tags escolhidas como no Criar Look.
 * O backend (SealPolicies.java) valida e gera o mesmo texto que o card mostra.
 *
 * RF53 — o HypeScore atual entra na política (o Hype alimenta os selos; selo nunca alimenta o Hype): `rule.hypeMin` é
 * mais um filtro da regra ("ao menos 2 peças com Hype ≥ Em alta") e `policy.hype` vale para a entidade avaliada (o look
 * no nível Look, a própria peça no nível Peça). Sem HypeScore calculado o critério de Hype não é atendido.
 */
export type SealQuantifier = "AT_LEAST" | "ALL" | "NONE";
export interface SealRule { quantifier: SealQuantifier; count?: number | null; color?: string | null; brand?: string | null; category?: string | null; subcategory?: string | null;
  /** RF53 — a peça só passa no filtro com Hype atual ≥ esse nível */ hypeMin?: HypeLevel | null }
/** RF53 — critério de Hype da entidade avaliada: nível e score juntos = os dois precisam valer; momento = qualquer um da lista. */
export interface SealHypeCriteria { minLevel?: HypeLevel | null; minScore?: number | null; momentum?: HypeMomentum[] | null }
export interface SealPolicy { match: "ALL" | "ANY"; rules: SealRule[]; occasions: string[]; styles: string[]; hype?: SealHypeCriteria | null }
export const EMPTY_POLICY: SealPolicy = { match: "ALL", rules: [], occasions: [], styles: [] };
export const MAX_RULES = 6;
export const MAX_SEAL_TAGS = 4;
export type SealTierId = "LOOK" | "PECA";
/** Momentos oferecidos no editor (o backend aceita os 5 do HypeMomentum, até 3 por política). */
export const HYPE_MOMENTUM_CHOICES: HypeMomentum[] = ["RISING", "EMERGING", "CLASSIC"];
const MOMENTUMS: HypeMomentum[] = ["EMERGING", "RISING", "STABLE", "COOLING", "CLASSIC"];
export const MAX_HYPE_MOMENTUM = 3;
const isLevel = (v: unknown): v is HypeLevel => typeof v === "string" && (LEVELS as string[]).includes(v);

/** Famílias de cor da taxonomia (chave do backend → id da mensagem). */
const FAMILIES = ["Preto", "Branco", "Cinza", "Azul", "Vermelho", "Rosa", "Laranja", "Amarelo", "Verde", "Roxo", "Marrom", "Especiais"];
const familyLabel = (f: string) => tr(`sealPolicy.familia.${f.toLowerCase()}`);
const colorLabel = (c: string) => (FAMILIES.includes(c) ? familyLabel(c) : label(c));

/** Critério de Hype limpo (nível válido, score inteiro 0–100, até 3 momentos sem repetição) ou null quando não diz nada. */
export function cleanHype(h: SealHypeCriteria | null | undefined): SealHypeCriteria | null {
  if (!h) return null;
  const minLevel = isLevel(h.minLevel) ? h.minLevel : null;
  const n = h.minScore == null ? NaN : Number(h.minScore);
  const minScore = Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : null;
  const momentum = [...new Set(h.momentum ?? [])].filter((m) => MOMENTUMS.includes(m)).slice(0, MAX_HYPE_MOMENTUM);
  if (!minLevel && minScore == null && !momentum.length) return null;
  return { minLevel, minScore, momentum };
}

/** Regra sem filtro nenhum não diz nada: some do envio (o backend faz o mesmo). Política só com Hype é válida. */
export function cleanPolicy(p: SealPolicy | null | undefined): SealPolicy | null {
  if (!p) return null;
  const rules = p.rules.filter((r) => r.color || r.brand?.trim() || r.category || r.subcategory || isLevel(r.hypeMin))
    .map((r) => ({ quantifier: r.quantifier, count: r.quantifier === "AT_LEAST" ? Math.min(4, Math.max(1, r.count ?? 1)) : null, color: r.color || null, brand: r.brand?.trim() || null, category: r.category || null, subcategory: r.subcategory || null,
      ...(isLevel(r.hypeMin) ? { hypeMin: r.hypeMin } : {}) }));
  const hype = cleanHype(p.hype);
  if (!rules.length && !p.occasions.length && !p.styles.length && !hype) return null;
  return { match: p.match, rules, occasions: p.occasions, styles: p.styles, ...(hype ? { hype } : {}) };
}

function pieceWords(r: SealRule): string {
  const w: string[] = [];
  if (r.subcategory) w.push(label(r.subcategory).toLowerCase()); else if (r.category) w.push(label(r.category).toLowerCase());
  if (r.color) w.push(tr("sealPolicy.cor", { c: colorLabel(r.color).toLowerCase() }));
  if (r.brand?.trim()) w.push(tr("sealPolicy.da_marca", { b: r.brand.trim() }));
  if (isLevel(r.hypeMin)) w.push(tr("sealPolicy.hype.com_hype_min", { level: tr(`hype.level.${r.hypeMin}`) }));
  return w.join(" ");
}

/** Trecho de Hype da política: "look com Hype ≥ 60 e em crescimento", "peça emergente", "look com Hype ≥ Em alta". */
export function describeHype(h: SealHypeCriteria | null | undefined, tier: SealTierId): string {
  const c = cleanHype(h);
  if (!c) return "";
  const level = c.minLevel ? tr(`hype.level.${c.minLevel}`) : null;
  const hype = level && c.minScore != null ? tr("sealPolicy.hype.nivel_e_score", { level, score: c.minScore })
    : level ? tr("sealPolicy.hype.nivel", { level }) : c.minScore != null ? tr("sealPolicy.hype.score", { score: c.minScore }) : "";
  const g = tier === "PECA" ? "f" : "m";   // concordância de "clássico/clássica" (peça × look)
  const momentum = (c.momentum ?? []).map((m) => tr(`sealPolicy.hype.mom.${m}`, { g })).join(tr("sealPolicy.ou"));
  const subject = tr(tier === "PECA" ? "sealPolicy.hype.sujeito_peca" : "sealPolicy.hype.sujeito_look");
  if (hype && momentum) return tr("sealPolicy.hype.com_e_momento", { subject, hype, momentum });
  if (hype) return tr("sealPolicy.hype.com", { subject, hype });
  return tr("sealPolicy.hype.so_momento", { subject, momentum });
}

export function describeRule(r: SealRule, tier: SealTierId): string {
  const what = pieceWords(r);
  if (tier === "PECA") return r.quantifier === "NONE" ? tr("sealPolicy.peca_que_nao_seja", { w: what }) : tr("sealPolicy.peca", { w: what });
  if (r.quantifier === "ALL") return tr("sealPolicy.todas_as_pecas", { w: what });
  if (r.quantifier === "NONE") return tr("sealPolicy.nenhuma_peca", { w: what });
  return (r.count ?? 1) <= 1 ? tr("sealPolicy.ao_menos_uma_peca", { w: what }) : tr("sealPolicy.no_minimo_pecas", { n: r.count ?? 1, w: what });
}

/** A frase inteira da política (mesma do backend). */
export function describePolicy(p: SealPolicy | null, tier: SealTierId): string {
  const c = cleanPolicy(p);
  if (!c) return "";
  const rules = c.rules.map((r) => describeRule(r, tier)).join(c.match === "ANY" ? tr("sealPolicy.ou") : tr("sealPolicy.e"));
  // RF53: as regras e o Hype da entidade numa frase só ("ao menos 2 peças … com Hype ≥ Em alta; look com Hype ≥ 60 …")
  const head = [rules, describeHype(c.hype, tier)].filter(Boolean).join(tr("sealPolicy.hype.separador"));
  const tags = [c.occasions.length ? tr("sealPolicy.ocasioes", { v: c.occasions.map(label).join(", ") }) : "", c.styles.length ? tr("sealPolicy.estilos", { v: c.styles.map(label).join(", ") }) : ""].filter(Boolean).join(" · ");
  return [head, tags].filter(Boolean).join(" · ");
}

export function SealPolicyEditor({ value, onChange, tier, onTier, brandName }: {
  value: SealPolicy; onChange: (p: SealPolicy) => void; tier: SealTierId; onTier: (t: SealTierId) => void; brandName?: string | null;
}) {
  const { t } = useI18n();
  const tax = useTaxonomy();
  const brand = brandName?.trim() || "";
  const setRule = (i: number, patch: Partial<SealRule>) => onChange({ ...value, rules: value.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const addRule = (r?: SealRule) => onChange({ ...value, rules: [...value.rules, r ?? { quantifier: tier === "PECA" ? "ALL" : "AT_LEAST", count: 1, brand: brand || null }].slice(0, MAX_RULES) });
  // modelos prontos: os exemplos do próprio pedido de selo
  const base: { id: string; tier: SealTierId; rule: SealRule }[] = [
    { id: "azul", tier: "LOOK", rule: { quantifier: "AT_LEAST", count: 3, color: "Azul", brand: brand || null } },
    { id: "vermelha", tier: "PECA", rule: { quantifier: "ALL", color: "Vermelho" } },
    { id: "amarela", tier: "LOOK", rule: { quantifier: "ALL", color: "Amarelo", brand: brand || null } },
  ];
  const templates = base.map((x) => ({ ...x, text: describeRule(x.rule, x.tier) }));
  const colorOptions = [{ id: "", label: t("sealPolicy.qualquer_cor") }, ...FAMILIES.map((f) => ({ id: f, label: t("sealPolicy.familia_toda", { f: familyLabel(f) }) })),
    ...Object.keys(tax?.colors ?? {}).map((c) => ({ id: c, label: label(c) }))];
  const categoryOptions = [{ id: "", label: t("sealPolicy.qualquer_peca") }, ...CATEGORY_KEYS.map((c) => ({ id: c, label: label(c) }))];
  const quantOptions = tier === "PECA"
    ? [{ id: "ALL" as SealQuantifier, label: t("sealPolicy.q_peca_e") }, { id: "NONE" as SealQuantifier, label: t("sealPolicy.q_peca_nao_e") }]
    : [{ id: "AT_LEAST" as SealQuantifier, label: t("sealPolicy.q_no_minimo") }, { id: "ALL" as SealQuantifier, label: t("sealPolicy.q_todas") }, { id: "NONE" as SealQuantifier, label: t("sealPolicy.q_nenhuma") }];
  const sentence = describePolicy(value, tier);
  // RF53: nível mínimo de Hype (por regra e da entidade) com os rótulos de faixa do Hype — texto, nunca só cor
  const hypeLevelOptions = (empty: string) => [{ id: "", label: empty }, ...LEVELS.map((l) => ({ id: l as string, label: t("sealPolicy.hype.nivel_opcao", { level: t(`hype.level.${l}`) }) }))];
  const hype = value.hype ?? {};
  const setHype = (patch: Partial<SealHypeCriteria>) => {
    const next = { ...hype, ...patch };
    const empty = !next.minLevel && next.minScore == null && !(next.momentum ?? []).length;
    onChange({ ...value, hype: empty ? null : next });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="label mb-1">{t("sealPolicy.nivel")}</p>
        <SegmentPicker label={t("sealPolicy.nivel")} value={tier} onChange={(v) => { onTier(v); onChange({ ...value, rules: value.rules.map((r) => ({ ...r, quantifier: v === "PECA" ? (r.quantifier === "NONE" ? "NONE" : "ALL") : r.quantifier })) }); }}
          options={[{ id: "LOOK", label: t("sealPolicy.nivel_look") }, { id: "PECA", label: t("sealPolicy.nivel_peca") }]} />
        <p className="help mt-1">{tier === "PECA" ? t("sealPolicy.nivel_peca_dica") : t("sealPolicy.nivel_look_dica")}</p>
      </div>

      <section aria-labelledby="sp-rules">
        <p id="sp-rules" className="label mb-1">{t("sealPolicy.regras")}</p>
        {value.rules.length === 0 && (
          <div className="mb-2">
            <p className="help mb-2">{t("sealPolicy.comece_por_um_modelo")}</p>
            <div className="flex flex-wrap gap-2">{templates.map((m) => <Button key={m.id} size="sm" type="button" onClick={() => { onTier(m.tier); onChange({ ...value, rules: [m.rule] }); }}>{m.text}</Button>)}</div>
          </div>
        )}
        <ol className="space-y-3">
          {value.rules.map((r, i) => (
            <li key={i} className="surface p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <SegmentPicker label={t("sealPolicy.quantas_pecas")} value={r.quantifier} onChange={(q) => setRule(i, { quantifier: q, count: q === "AT_LEAST" ? r.count ?? 1 : null })} options={quantOptions} />
                {tier === "LOOK" && r.quantifier === "AT_LEAST" && (
                  <span className="flex items-center gap-1" role="group" aria-label={t("sealPolicy.quantidade")}>
                    <Button size="sm" type="button" aria-label={t("sealPolicy.menos")} disabled={(r.count ?? 1) <= 1} onClick={() => setRule(i, { count: Math.max(1, (r.count ?? 1) - 1) })}>−</Button>
                    <span className="type-data tabular w-6 text-center" aria-live="polite">{r.count ?? 1}</span>
                    <Button size="sm" type="button" aria-label={t("sealPolicy.mais")} disabled={(r.count ?? 1) >= 4} onClick={() => setRule(i, { count: Math.min(4, (r.count ?? 1) + 1) })}>+</Button>
                    <span className="type-body-sm">{t("sealPolicy.pecas")}</span>
                  </span>
                )}
                <Button size="sm" type="button" variant="ghost" className="ml-auto" onClick={() => onChange({ ...value, rules: value.rules.filter((_, j) => j !== i) })}>{t("sealPolicy.remover_regra")}</Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label={t("sealPolicy.cor_label")} id={`sp-color-${i}`}><Dropdown id={`sp-color-${i}`} block value={r.color ?? ""} options={colorOptions} onChange={(v) => setRule(i, { color: v || null })} /></Field>
                <Field label={t("sealPolicy.tipo_de_peca")} id={`sp-cat-${i}`}><Dropdown id={`sp-cat-${i}`} block value={r.category ?? ""} options={categoryOptions} onChange={(v) => setRule(i, { category: v || null, subcategory: null })} /></Field>
                {r.category && (
                  <Field label={t("sealPolicy.subtipo")} id={`sp-sub-${i}`}><Dropdown id={`sp-sub-${i}`} block value={r.subcategory ?? ""} onChange={(v) => setRule(i, { subcategory: v || null })}
                    options={[{ id: "", label: t("sealPolicy.qualquer_subtipo") }, ...(tax?.subcategories?.[r.category] ?? []).map((s) => ({ id: s, label: label(s) }))]} /></Field>
                )}
                <Field label={t("sealPolicy.marca_label")} id={`sp-brand-${i}`} hint={t("sealPolicy.marca_dica")}>
                  <Input id={`sp-brand-${i}`} value={r.brand ?? ""} maxLength={80} placeholder={t("sealPolicy.qualquer_marca")} onChange={(e) => setRule(i, { brand: e.target.value })} />
                </Field>
                <Field label={t("sealPolicy.hype.regra_label")} id={`sp-hype-${i}`} hint={t("sealPolicy.hype.regra_dica")}>
                  <Dropdown id={`sp-hype-${i}`} block value={(r.hypeMin ?? "") as string} options={hypeLevelOptions(t("sealPolicy.hype.qualquer_hype"))} onChange={(v) => setRule(i, { hypeMin: (v || null) as HypeLevel | null })} />
                </Field>
              </div>
              {brand && (r.brand ?? "").trim().toLowerCase() !== brand.toLowerCase() && <Button size="sm" type="button" className="mt-2" onClick={() => setRule(i, { brand })}>{t("sealPolicy.usar_minha_marca", { b: brand })}</Button>}
              <p className="type-caption text-muted mt-2">{describeRule(r, tier)}</p>
            </li>
          ))}
        </ol>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" type="button" disabled={value.rules.length >= MAX_RULES} onClick={() => addRule()}>{t("sealPolicy.adicionar_regra")}</Button>
          {value.rules.length > 1 && <SegmentPicker label={t("sealPolicy.atender")} value={value.match} onChange={(m) => onChange({ ...value, match: m })} options={[{ id: "ALL", label: t("sealPolicy.todas_as_regras") }, { id: "ANY", label: t("sealPolicy.qualquer_regra") }]} />}
        </div>
      </section>

      <ChipMultiSelect legend={t("common.occasion")} max={MAX_SEAL_TAGS} value={value.occasions} onChange={(v) => onChange({ ...value, occasions: v })}
        options={(tax?.occasions ?? []).map((o) => ({ id: o, label: label(o) }))} hint={t("sealPolicy.tags_dica")} />
      <ChipMultiSelect legend={t("common.style")} max={MAX_SEAL_TAGS} value={value.styles} onChange={(v) => onChange({ ...value, styles: v })}
        options={(tax?.styles ?? []).map((o) => ({ id: o, label: label(o) }))} hint={t("sealPolicy.tags_dica")} />

      {/* RF53 — Hype da entidade avaliada (o look no nível Look; a própria peça no nível Peça) */}
      <section aria-labelledby="sp-hype" className="seal-hype-policy surface p-3">
        <p id="sp-hype" className="label mb-1">{t("sealPolicy.hype.titulo")}</p>
        <p className="help mb-2">{tier === "PECA" ? t("sealPolicy.hype.dica_peca") : t("sealPolicy.hype.dica_look")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label={t("sealPolicy.hype.nivel_minimo")} id="sp-hype-level">
            <Dropdown id="sp-hype-level" block value={(hype.minLevel ?? "") as string} options={hypeLevelOptions(t("sealPolicy.hype.qualquer_nivel"))} onChange={(v) => setHype({ minLevel: (v || null) as HypeLevel | null })} />
          </Field>
          <Field label={t("sealPolicy.hype.score_minimo")} id="sp-hype-score" hint={t("sealPolicy.hype.score_dica")}>
            <Input id="sp-hype-score" type="number" inputMode="numeric" min={0} max={100} step={1} value={hype.minScore ?? ""} placeholder={t("sealPolicy.hype.sem_score")}
              onChange={(e) => { const raw = e.target.value.trim(); setHype({ minScore: raw === "" || !Number.isFinite(Number(raw)) ? null : Math.min(100, Math.max(0, Math.round(Number(raw)))) }); }} />
          </Field>
        </div>
        <ChipMultiSelect legend={t("sealPolicy.hype.momento")} max={MAX_HYPE_MOMENTUM} value={hype.momentum ?? []} onChange={(v) => setHype({ momentum: v as HypeMomentum[] })}
          options={HYPE_MOMENTUM_CHOICES.map((m) => ({ id: m, label: t(`sealPolicy.hype.chip.${m}`) }))} hint={t("sealPolicy.hype.momento_dica")} />
        <p className="type-caption text-muted">{t("sealPolicy.hype.sem_pay_to_win")}</p>
      </section>

      <div className="surface p-3" aria-live="polite">
        <p className="label mb-1">{t("sealPolicy.o_selo_sera_sugerido_quando")}</p>
        <p className="type-body-sm">{sentence || t("sealPolicy.sem_regras")}</p>
      </div>
    </div>
  );
}
