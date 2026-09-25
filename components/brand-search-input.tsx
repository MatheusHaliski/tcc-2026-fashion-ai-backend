"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import { localMonogram } from "@/lib/brand-logos";
import { useI18n, tr } from "@/lib/i18n/i18n";

/** Resultado do buscador web de marcas (GET /api/brand-search). */
export interface BrandHit {
  name: string; description?: string | null; source: string; sourceLabel: string; ref?: string | null; domain?: string | null; officialUrl?: string | null;
  brandColor?: string | null; fashion?: boolean | null; match: string; logoUrl?: string | null; logoWideUrl?: string | null;
  logo: { accepted: boolean; reason?: string | null; metrics?: Record<string, unknown>; pipeline?: string[] };
}
interface BrandSearch { query: string; results: BrandHit[]; sources: { source: string; label: string; status: string; count?: number; ms?: number; note?: string }[]; rejectedLogos: number; note: string; cache: boolean; ms: number; }
export interface BrandChoice { brandName: string; brandLogoUrl: string | null; brandLogoWideUrl?: string | null; brandSource: string | null; brandRef: string | null; brandDomain?: string | null; edgePx?: number | null; }

const REASON: Record<string, string> = {
  get SEM_NITIDEZ() { return tr("brandSearchInput.logo_recusado_sem_nitidez"); }, get RESOLUCAO_BAIXA() { return tr("brandSearchInput.logo_recusado_resolucao_baixa"); }, get FUNDO_NAO_UNIFORME() { return tr("brandSearchInput.logo_recusado_nao_e_logo"); },
  CONTRASTE_BAIXO: "logo recusado: contraste baixo", get BLOCO_SOLIDO() { return tr("brandSearchInput.logo_recusado_bloco_solido"); }, SEM_DESENHO: "logo recusado: vazio",
  get LOGO_NAO_BAIXOU() { return tr("brandSearchInput.logo_nao_baixou"); }, get SEM_LOGO_NA_FONTE() { return tr("brandSearchInput.fonte_sem_logo"); }, get LOGO_INVALIDO() { return tr("brandSearchInput.arquivo_de_logo_invalido"); }, get NAO_PROCESSADO() { return tr("brandSearchInput.logo_nao_processado"); },
};
const STATUS: Record<string, string> = { OK: "ok", get SEM_RESULTADO() { return tr("brandSearchInput.sem_resultado"); }, get INDISPONIVEL() { return tr("challenges.indisponivel"); }, get NAO_USADA() { return tr("brandSearchInput.nao_usada"); } };

/**
 * Campo marca do RF4: busca a marca na internet enquanto a pessoa digita (Wikidata, Simple Icons no GitHub e IA com
 * busca na web) — não há catálogo de marcas guardado no Fashion AI. Escolher um resultado preenche o nome e o slot do
 * logo com a imagem já filtrada (fundo branco, letras pretas nítidas).
 */
export function BrandSearchInput({ value, onChange, error }: { value: BrandChoice; onChange: (v: BrandChoice) => void; error?: string }) {
  const { t } = useI18n();
  const listId = useId();
  const [q, setQ] = useState(value.brandName ?? "");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<BrandSearch | null>(null);
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const seq = useRef(0);
  const chosen = !!value.brandName && (!!value.brandSource || !!value.brandLogoUrl);
  useEffect(() => { setQ(value.brandName ?? ""); }, [value.brandName]);

  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2 || (chosen && term === value.brandName)) return;
    const n = ++seq.current;
    const ctl = new AbortController();
    const h = setTimeout(async () => {
      setBusy(true); setFailed(null);
      try { const r = await api.get<BrandSearch>(`/api/brand-search?q=${encodeURIComponent(term)}`, { signal: ctl.signal }); if (n === seq.current) { setRes(r); setActive(0); } }
      catch (e) { if (n === seq.current && !(e instanceof DOMException)) setFailed(t("brandSearchInput.nao_foi_possivel_buscar_agora")); }
      finally { if (n === seq.current) setBusy(false); }
    }, 380);
    return () => { clearTimeout(h); ctl.abort(); };
  }, [q, open, chosen, value.brandName]);

  function pick(h: BrandHit) {
    const edge = h.logo?.metrics?.["larguraDaBordaFinalPx"];
    onChange({ brandName: h.name, brandLogoUrl: h.logoUrl ?? null, brandLogoWideUrl: h.logoWideUrl ?? null, brandSource: h.source, brandRef: h.ref ?? null, brandDomain: h.domain ?? null, edgePx: typeof edge === "number" ? edge : null });
    setQ(h.name); setOpen(false);
  }
  function free() { const n = q.trim(); onChange({ brandName: n, brandLogoUrl: null, brandSource: n ? "TEXTO_LIVRE" : null, brandRef: null }); setOpen(false); }
  function clear() { onChange({ brandName: "", brandLogoUrl: null, brandSource: null, brandRef: null }); setQ(""); setRes(null); setOpen(true); }
  const fresh = !!res && res.query.toLowerCase() === q.trim().replace(/\s+/g, " ").toLowerCase();
  const items = fresh ? res!.results : [];
  const total = items.length + (q.trim().length >= 2 ? 1 : 0);
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(total - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" && open) { e.preventDefault(); if (active < items.length) pick(items[active]); else free(); }
    else if (e.key === "Escape") setOpen(false);
  }
  const mono = localMonogram(value.brandName || "?");
  return (
    <div className="brand-search">
      <div className="relative">
        <input id="brand" role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" autoComplete="off"
          aria-activedescendant={open && total ? `${listId}-${active}` : undefined} aria-invalid={!!error || undefined}
          className={`input pr-9 ${error ? "input-error" : ""}`} placeholder={t("brandSearchInput.digite_a_marca_buscamos_na")} value={q} maxLength={60}
          onChange={(e) => { setQ(e.target.value); setOpen(true); if (chosen) onChange({ brandName: e.target.value, brandLogoUrl: null, brandSource: null, brandRef: null }); }}
          onFocus={() => q.trim().length >= 2 && !chosen && setOpen(true)} onKeyDown={onKey} onBlur={() => setTimeout(() => setOpen(false), 180)} />
        <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 type-caption text-muted">{busy ? "…" : "🌐"}</span>
      {open && q.trim().length >= 2 && (
        <div className="brand-search-pop" role="presentation" data-query={res?.query ?? ""} data-busy={busy ? "1" : "0"}>
          <ul id={listId} role="listbox" aria-label={t("brandSearchInput.marcas_encontradas_na_internet")}>
            {!fresh && <li className="brand-search-empty">{t("brandSearchInput.buscando_na_internet", { q: q.trim() })}</li>}
            {items.map((h, i) => (
              <li key={`${h.source}-${h.ref ?? h.name}`} id={`${listId}-${i}`} role="option" aria-selected={active === i}
                className={`brand-search-opt ${active === i ? "is-active" : ""}`} onMouseDown={(e) => { e.preventDefault(); pick(h); }} onMouseEnter={() => setActive(i)}>
                <span className="brand-search-logo">{h.logoUrl ? <img src={mediaUrl(h.logoUrl)} alt={t("common.logo", { name: h.name })} /> : <b style={{ background: localMonogram(h.name).color }}>{localMonogram(h.name).initials}</b>}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate type-body font-semibold">{h.name}</span>
                  <span className="block truncate type-caption text-muted">{h.description ?? "—"}{h.domain ? ` · ${h.domain}` : ""}</span>
                  {!h.logo?.accepted && h.logo?.reason && <span className="block type-caption brand-search-rejected">{REASON[h.logo.reason] ?? h.logo.reason}</span>}
                </span>
                <span className="badge shrink-0">{h.sourceLabel}</span>
              </li>
            ))}
            {fresh && items.length === 0 && <li className="brand-search-empty">{t("brandSearchInput.nenhuma_marca_encontrada_na_internet", { query: res.query })}</li>}
            <li id={`${listId}-${items.length}`} role="option" aria-selected={active === items.length} className={`brand-search-opt is-free ${active === items.length ? "is-active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); free(); }} onMouseEnter={() => setActive(items.length)}>
              <span className="brand-search-logo"><b style={{ background: localMonogram(q).color }}>{localMonogram(q).initials}</b></span>
              <span className="flex-1 type-body-sm">{t("brandSearchInput.usar_sem_logo_da_web", { q: q.trim() })}</span>
            </li>
          </ul>
          {fresh && res && <p className="brand-search-sources">{res.sources.map((s) => `${s.label}: ${STATUS[s.status] ?? s.status}${s.count ? ` (${s.count})` : ""}`).join(" · ")}{res.rejectedLogos > 0 ? t("brandSearchInput.logo_s_recusado_s_pelo", { rejectedLogos: res.rejectedLogos }) : ""}</p>}
          {failed && <p className="brand-search-sources error-text">{failed}</p>}
        </div>
      )}
      </div>
      {/* slot do logo da marca: preenchido pela busca web */}
      <div className="brand-logo-slot" aria-label={t("brandSearchInput.logo_da_marca")}>
        <span className="brand-logo-slot-img">
          {value.brandLogoWideUrl || value.brandLogoUrl ? <img src={mediaUrl(value.brandLogoWideUrl ?? value.brandLogoUrl)} alt={t("brandSearchInput.logo", { brandName: value.brandName })} />
            : value.brandName ? <b style={{ background: mono.color }}>{mono.initials}</b> : <em>{t("brandSearchInput.logo_da_marca")}</em>}
        </span>
        <span className="min-w-0 flex-1 type-caption">
          {value.brandName ? <><b className="type-body-sm">{value.brandName}</b><br />
            {value.brandLogoUrl ? <>{t("brandSearchInput.logo_via_filtro_fundo_branco", { labelOf: labelOf(value.brandSource), value: value.brandDomain ? ` · ${value.brandDomain}` : "", value2: value.edgePx != null ? t("brandSearchInput.borda_px", { replace: value.edgePx.toFixed(1).replace(".", ",") }) : "" })}</>
              : value.brandSource === "TEXTO_LIVRE" ? t("brandSearchInput.texto_livre_sem_logo_da") : t("brandSearchInput.escolha_um_resultado_da_busca")}</>
            : t("brandSearchInput.o_logo_aparece_aqui_quando")}
        </span>
        {value.brandName && <button type="button" className="btn btn-sm btn-ghost" onClick={clear}>{t("common.trocar")}</button>}
      </div>
    </div>
  );
}

function labelOf(source?: string | null) {
  return source === "WIKIDATA" ? "Wikidata" : source === "SIMPLE_ICONS" ? tr("brandSearchInput.simple_icons_github") : source === "IA_BUSCA_WEB" ? tr("brandSearchInput.ia_com_busca_na_web") : source === "PLATAFORMA" ? tr("common.perfil_da_marca") : "internet";
}
