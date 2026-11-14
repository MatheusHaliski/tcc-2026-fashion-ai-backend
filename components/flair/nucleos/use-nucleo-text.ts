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
    const aba = (tab: Pick<ResourceTab, "id" | "tipo" | "rotulo">) => {
      if (tab.tipo === "vaga") return ou(`flair3d.ui.tab.${tab.id}`, tab.id);
      if (tab.tipo === "zona") return ou(`flair3d.ui.zona.${tab.id}`, tab.id);
      if (tab.tipo === "area") return ou(`flair3d.ui.area.${tab.id}`, tab.id);
      return ou(tab.rotulo ?? "", t("flair3d.ui.tab.RESPOSTA"));
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
    /** número do servidor com até duas casas no formato do idioma ("13,33", nunca "13.333333333333334") */
    const numero = (x: unknown) => (typeof x === "number" ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(x) : String(x));
    /** código cru em letras comuns, para o que ainda não tem frase própria */
    const legivel = (codigo: string) => codigo.charAt(0) + codigo.slice(1).toLowerCase().replace(/_/g, " ");
    /** "FAMILIA_AMARELO" → "Amarelo" no idioma da pessoa */
    const familiaCor = (codigo: string) => {
      const nome = codigo.replace(/^FAMILIA_/, "");
      return ou(`flair3d.ui.familiaCor.${nome}`, legivel(nome));
    };
    const motivo = (codigo: string | null) => ou(`flair3d.ui.fx.reason.${codigo ?? "default"}`, t("flair3d.ui.fx.reason.default"));
    return {
      t,
      ou,
      aba,
      item,
      nome: (codigo: string) => ou(`flair3d.nucleo.${codigo}.name`, codigo),
      /** objetivo, cenário ou personagens do jogo; com variante escolhida (a modalidade), o texto dela */
      daVariante: (codigo: string, parte: "objective" | "scene" | "characters", variante?: string | null) =>
        ou(`flair3d.nucleo.${codigo}.${parte}.${variante ?? ""}`, t(`flair3d.nucleo.${codigo}.${parte}`)),
      regra: (codigo: string, regra: string) => {
        const key = `flair3d.nucleo.${codigo}.rules.${regra}`;
        if (hasMessage(locale, key)) return t(key);
        // regra por vaga (FIGURINO_SUP, PEDIDO_INF...): o texto da regra e a vaga
        const porVaga = /^(.+)_(SUP|INF|CAL|ACE|VES)$/.exec(regra);
        const base = porVaga && `flair3d.nucleo.${codigo}.rules.${porVaga[1]}`;
        if (porVaga && base && hasMessage(locale, base)) return `${t(base)} · ${ou(`flair3d.ui.tab.${porVaga[2]}`, porVaga[2])}`;
        return regra;
      },
      /** pontos com até duas casas (os pontos por carta vêm assim do servidor) */
      pontos: (n: number) => t("flair3d.ui.points", { n: numero(n) }),
      /** total da partida por extenso ("73,33 pontos") */
      pontosTotal: (n: number) => t("flair3d.ui.result.points", { n: numero(n) }),
      /** motivo de a carta não pontuar, pelo código do servidor (MARCA_NAO_BR, FORA_DA_FAMILIA, SEM_BONUS...) */
      motivo,
      atributo: (codigo: string) => ou(`flair3d.ui.hud.attr.${codigo}`, codigo),
      efeito: (e: EfeitoItem) => {
        if (e.motivo) return motivo(e.codigo);
        const valor = typeof e.valor === "number" && e.valor > 0 ? `+${numero(e.valor)}` : numero(e.valor);
        const familia = /^FAMILIA_(.+)$/.exec(e.codigo);
        if (familia && !hasMessage(locale, `flair3d.ui.efeito.${e.codigo}`)) return t("flair3d.ui.efeito.FAMILIA", { familia: familiaCor(e.codigo).toLowerCase() });
        return ou(`flair3d.ui.efeito.${e.codigo}`, `${legivel(e.codigo).toLowerCase()} ${valor}`, { valor });
      },
      evento: (e: { codigo: string; valor?: unknown }) => {
        const v = e.valor;
        const vars: Record<string, string> = { valor: v != null && typeof v === "object" ? JSON.stringify(v) : numero(v ?? "") };
        if (v && typeof v === "object") Object.entries(v as Record<string, unknown>).forEach(([k, x]) => (vars[k] = numero(x)));
        if (e.codigo === "FAMILIA") vars.valor = familiaCor(vars.valor);
        if (vars.vaga) vars.vaga = ou(`flair3d.ui.tab.${vars.vaga}`, vars.vaga);
        if (e.codigo === "MODALIDADE") {
          vars.modalidadeNome = ou(`flair3d.nucleo.FASHION_SPORTS.opcao.${vars.valor}`, vars.valor);
          vars.unidade = ou(`flair3d.ui.modalidade.unidade.${vars.valor}`, "");
        }
        if (vars.codigo) vars.salaoNome = ou(`flair3d.ui.detetive.${vars.codigo}.name`, vars.codigo);
        if (vars.item) vars.item = ou(`flair3d.ui.mercado.${vars.item}`, vars.item);
        if (vars.acao) vars.acao = ou(`flair3d.ui.acaoCor.${vars.modalidade}.${vars.acao}`, ou(`flair3d.ui.acaoCor.${vars.acao}`, vars.acao));
        if (vars.venceu) vars.desfecho = t(`flair3d.ui.acaoCor.${vars.venceu === "true" ? "ok" : "falhou"}`);
        // o que o lance mudou (força do time, placar, um lance a menos do adversário); servidor antigo não manda: fica vazio
        vars.ganhoTexto = vars.efeito ? ou(`flair3d.ui.lanceEfeito.${vars.efeito}`, "", vars) : "";
        if (vars.atributo) vars.atributo = ou(`flair3d.ui.hud.attr.${vars.atributo}`, vars.atributo);
        // código novo do servidor ainda sem frase: o nome do código em letras comuns, nunca "FORCA_SEGUNDO_TEMPO"
        return ou(`flair3d.ui.evento.${e.codigo}`, `${legivel(e.codigo)}: ${vars.valor}`, vars);
      },
      resultado: (r: string) => ou(`flair3d.ui.result.resultado.${r}`, r),
      papel: (p: string) => ou(`flair3d.ui.papel.${p}`, p),
      posicao: (p: string) => ou(`flair3d.ui.tab.${p}`, p),
    };
  }, [t, locale]);
}
