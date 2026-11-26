"use client";
import { Badge } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import type { SealBrandReference } from "@/components/seal-policy-brand-field";

/**
 * Exercício 13 — leitura das marcas exigidas pela política de um selo (card do selo no perfil do emissor).
 * Marca escolhida na lista aparece com o tipo (catálogo ou perfil); a que não existe mais aparece como indisponível;
 * o texto das regras antigas aparece como texto não verificado, sem ser tratado como marca cadastrada.
 */
export function SealPolicyBrands({ policy }: {
  policy?: { rules?: { brand?: string | null; brandReference?: SealBrandReference | null }[] } | null;
}) {
  const { t } = useI18n();
  const rules = policy?.rules ?? [];
  const references = rules.flatMap((r) => (r.brandReference?.id ? [r.brandReference] : []));
  const legacy = rules.flatMap((r) => (!r.brandReference?.id && r.brand?.trim() ? [r.brand.trim()] : []));
  if (!references.length && !legacy.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2" aria-label={t("sealPolicy.marcaRef.exigidas")} data-seal-policy-brands>
      {references.map((r, i) => (
        <li key={`${r.kind}-${r.id}-${i}`}>
          <Badge tone={r.disponivel === false ? "chalk" : "thread"}>
            {t(r.disponivel === false ? "sealPolicy.marcaRef.lida_indisponivel" : "sealPolicy.marcaRef.lida", { b: r.nome ?? r.id, kind: t(`sealPolicy.marcaRef.kind.${r.kind}`) })}
          </Badge>
        </li>
      ))}
      {legacy.map((b, i) => <li key={`legacy-${i}`}><Badge tone="chalk">{t("sealPolicy.marcaRef.lida_legado", { b })}</Badge></li>)}
    </ul>
  );
}
