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
      regra: (codigo: string, regra: string) => {
        const key = `flair3d.nucleo.${codigo}.rules.${regra}`;
        if (hasMessage(locale, key)) return t(key);
        // regra por vaga (FIGURINO_SUP, PEDIDO_INF...): o texto da regra e a vaga
        const porVaga = /^(.+)_(SUP|INF|CAL|ACE|VES)$/.exec(regra);
        const base = porVaga && `flair3d.nucleo.${codigo}.rules.${porVaga[1]}`;
        if (porVaga && base && hasMessage(locale, base)) return `${t(base)} · ${ou(`flair3d.ui.tab.${porVaga[2]}`, porVaga[2])}`;
        return regra;
      },
      efeito: (e: EfeitoItem) => {
        const valor = typeof e.valor === "number" && e.valor > 0 ? `+${e.valor}` : String(e.valor);
        const familia = /^FAMILIA_(.+)$/.exec(e.codigo);
        if (familia && !hasMessage(locale, `flair3d.ui.efeito.${e.codigo}`)) return t("flair3d.ui.efeito.FAMILIA", { familia: familia[1].toLowerCase() });
        return ou(`flair3d.ui.efeito.${e.codigo}`, `${e.codigo} ${valor}`, { valor });
      },
      evento: (e: { codigo: string; valor?: unknown }) => {
        const v = e.valor;
        const vars: Record<string, string> = { valor: v != null && typeof v === "object" ? JSON.stringify(v) : String(v ?? "") };
        if (v && typeof v === "object") Object.entries(v as Record<string, unknown>).forEach(([k, x]) => (vars[k] = String(x)));
        return ou(`flair3d.ui.evento.${e.codigo}`, `${e.codigo}: ${vars.valor}`, vars);
      },
      resultado: (r: string) => ou(`flair3d.ui.result.resultado.${r}`, r),
      papel: (p: string) => ou(`flair3d.ui.papel.${p}`, p),
      posicao: (p: string) => ou(`flair3d.ui.tab.${p}`, p),
    };
  }, [t, locale]);
}
