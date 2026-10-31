"use client";
import { useEffect, useState } from "react";
import { type CatalogProduct } from "@/lib/api/catalog";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Field, Input, Select } from "@/components/ui";
import type { GenderEvidence } from "./contracts";
import styles from "./editor.module.css";
export function GenderPanel({
  ids,
  onSources,
  evidence,
  selected,
  onConfirm,
  disabled,
  search,
}: {
  search: (
    q: string,
    signal: AbortSignal,
  ) => Promise<{ items: CatalogProduct[] }>;
  ids: string[];
  onSources: (ids: string[]) => void;
  evidence: GenderEvidence | null;
  selected: string | null;
  onConfirm: (id: string | null) => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<CatalogProduct[]>([]),
    [failed, setFailed] = useState(false),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setLoading(true);
      setFailed(false);
      search(query, controller.signal)
        .then((r) => {
          if (!controller.signal.aborted) setResults(r.items);
        })
        .catch(() => {
          if (!controller.signal.aborted) setFailed(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 400);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, search]);
  const suggested = evidence?.suggestion;
  return (
    <section
      className={styles.evidence}
      aria-label={t("atelier3d.gender.title")}
    >
      <h2 className="type-h3">{t("atelier3d.gender.title")}</h2>
      <p>{t("atelier3d.gender.explanation")}</p>
      <Field label={t("atelier3d.gender.search")} id="atelier-catalog-search">
        <Input
          id="atelier-catalog-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
        />
      </Field>
      {loading && <p role="status">{t("common.loading")}</p>}
      {failed && <p role="alert">{t("atelier3d.gender.searchError")}</p>}
      <div className={styles.stack}>
        {results
          .filter((p) => !ids.includes(p.id))
          .map((p) => (
            <Button
              key={p.id}
              disabled={disabled || ids.length >= 40}
              onClick={() => {
                onSources([...ids, p.id]);
                setQuery("");
              }}
            >
              {p.productName} · {p.gender ?? t("atelier3d.gender.unknown")}
            </Button>
          ))}
      </div>
      {evidence?.sources.map((p) => (
        <div key={p.id} className={styles.toolbar}>
          <span>
            {p.name} · {p.gender ?? t("atelier3d.gender.unknown")}
          </span>
          <Button
            disabled={disabled}
            onClick={() => onSources(ids.filter((id) => id !== p.id))}
          >
            {t("common.remove")}
          </Button>
        </div>
      ))}
      <p role="status">
        {evidence
          ? t(`atelier3d.gender.${evidence.status}`)
          : t("common.loading")}
        {suggested && <> · {t(`atelier3d.gender.${suggested}`)}</>}
      </p>
      <Field label={t("atelier3d.gender.final")} id="atelier-tipo-look">
        <Select
          id="atelier-tipo-look"
          value={selected ?? ""}
          disabled={disabled || !evidence}
          onChange={(e) => onConfirm(e.target.value || null)}
        >
          <option value="">{t("atelier3d.gender.confirm")}</option>
          {evidence?.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </Select>
      </Field>
      <p className="type-caption">{t("atelier3d.gender.override")}</p>
    </section>
  );
}
