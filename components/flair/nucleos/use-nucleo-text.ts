"use client";
/**
 * Textos dos núcleos: a API devolve só códigos; cada código vira texto pelos catálogos de i18n. Código sem tradução
 * (novo no servidor) aparece como veio, em vez de uma chave crua.
 */
import { useMemo } from "react";
import { hasMessage } from "@/lib/i18n/core";
import { useI18n } from "@/lib/i18n/i18n";
import type { ResourceItem, ResourceTab } from "@/lib/flair/nucleos/selection";
import type { EfeitoItem } from "@/lib/flair/nucleos/types";

export function useNucleoText() {
  const { t, locale } = useI18n();
  return useMemo(() => {
    const ou = (key: string, fallback: string, vars?: Record<string, string | number>) =>
      hasMessage(locale, key) ? t(key, vars) : fallback;
    const aba = (tab: Pick<ResourceTab, "id" | "tipo">) => {
      if (tab.tipo === "vaga") return ou(`flair3d.ui.tab.${tab.id}`, tab.id);
      if (tab.tipo === "zona") return ou(`flair3d.ui.zona.${tab.id}`, tab.id);
      if (tab.tipo === "area") return ou(`flair3d.ui.area.${tab.id}`, tab.id);
      return t("flair3d.ui.tab.RESPOSTA");
    };
    const item = (nucleo: string, it: ResourceItem) => {
      switch (it.kind) {
        case "carta":
          return it.card.name;
        case "cor":
          return ou(`flair3d.ui.cor.${it.codigo}`, it.codigo);
        case "acabamento":
          return ou(`flair3d.ui.acabamento.${it.codigo}`, it.codigo);
        case "familia":
          return ou(`flair3d.ui.familia.${it.codigo}`, it.codigo);
        case "maqAcabamento":
          return ou(`flair3d.ui.maqAcabamento.${it.codigo}`, it.codigo);
        case "opcao":
          return ou(`flair3d.nucleo.${nucleo}.opcao.${it.codigo}`, it.codigo);
      }
    };
    return {
      t,
      ou,
      aba,
      item,
      nome: (codigo: string) => ou(`flair3d.nucleo.${codigo}.name`, codigo),
      regra: (codigo: string, regra: string) => ou(`flair3d.nucleo.${codigo}.rules.${regra}`, regra),
      efeito: (e: EfeitoItem) => ou(`flair3d.ui.efeito.${e.codigo}`, `${e.codigo} ${e.valor}`, { valor: e.valor }),
      resultado: (r: string) => ou(`flair3d.ui.result.resultado.${r}`, r),
      papel: (p: string) => ou(`flair3d.ui.papel.${p}`, p),
      posicao: (p: string) => ou(`flair3d.ui.tab.${p}`, p),
    };
  }, [t, locale]);
}
