"use client";
/**
 * Textos dos núcleos: a API devolve só códigos; cada código vira texto pelos catálogos de i18n. Código sem tradução
 * (novo no servidor) aparece como veio, em vez de uma chave crua.
 */
import { useMemo } from "react";
import { hasMessage } from "@/lib/i18n/core";
import { useI18n } from "@/lib/i18n/i18n";
import { legivel, nomeDaEtapa, nomeDaRodada, nomeDoValor, objetivoDaRodada, regraComum, textoDaEtapa } from "@/lib/flair/nucleos/round-text";
import type { ResourceItem, ResourceTab } from "@/lib/flair/nucleos/selection";
import type { EfeitoItem } from "@/lib/flair/nucleos/types";

export function useNucleoText() {
  const { t, locale } = useI18n();
  return useMemo(() => {
    const ou = (key: string, fallback: string, vars?: Record<string, string | number>) =>
      hasMessage(locale, key) ? t(key, vars) : fallback;
    const aba = (tab: Pick<ResourceTab, "id" | "tipo" | "rotulo" | "rotuloReserva">) => {
      if (tab.tipo === "vaga") return ou(`flair3d.ui.tab.${tab.id}`, tab.id);
      if (tab.tipo === "zona") return ou(`flair3d.ui.zona.${tab.id}`, tab.id);
      if (tab.tipo === "area") return ou(`flair3d.ui.area.${tab.id}`, tab.id);
      return ou(tab.rotulo ?? "", ou(tab.rotuloReserva ?? "", t("flair3d.ui.tab.RESPOSTA")));
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
    /** "FAMILIA_AMARELO" → "Amarelo" no idioma da pessoa */
    const familiaCor = (codigo: string) => {
      const nome = codigo.replace(/^FAMILIA_/, "");
      return ou(`flair3d.ui.familiaCor.${nome}`, legivel(nome));
    };
    const motivo = (codigo: string | null) => ou(`flair3d.ui.fx.reason.${codigo ?? "default"}`, t("flair3d.ui.fx.reason.default"));
    return {
      t,
      ou,
      familiaCor,
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
        // regra comum a mais de um jogo, por vaga ou inteira; nas rodadas em etapas, o nome da etapa
        if (porVaga && hasMessage(locale, `flair3d.regra.${porVaga[1]}`)) return `${t(`flair3d.regra.${porVaga[1]}`)} · ${ou(`flair3d.ui.tab.${porVaga[2]}`, porVaga[2])}`;
        return regraComum(ou, regra);
      },
      rodadaNome: (codigo: string, rodada: string) => nomeDaRodada(ou, codigo, rodada),
      rodadaObjetivo: (codigo: string, rodada: string) => objetivoDaRodada(ou, codigo, rodada, t(`flair3d.nucleo.${codigo}.objective`)),
      etapaNome: (codigo: string) => nomeDaEtapa(ou, codigo),
      etapaTexto: (codigo: string) => textoDaEtapa(ou, codigo),
      /** o que trocar para cumprir a regra: a dica própria dela ou, sem uma, a própria regra */
      dica: (codigo: string, regra: string, texto: string) => {
        const base = regra.replace(/_(SUP|INF|CAL|ACE|VES)$/, "");
        return ou(`flair3d.dica.${codigo}.${base}`, ou(`flair3d.dica.${base}`, t("flair3d.ui.result.hintRule", { regra: texto })));
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
        if (vars.codigo) vars.nome = nomeDaEtapa(ou, vars.codigo);
        if (typeof v === "string" && e.codigo !== "FAMILIA") vars.valor = nomeDoValor(ou, v);
        if (vars.familia) vars.familia = familiaCor(vars.familia.toUpperCase()).toLowerCase();
        if (vars.item) vars.item = ou(`flair3d.ui.mercado.${vars.item}`, vars.item);
        // a ação da cor: no esporte, a ação do lance; nos efeitos de cena (jogada de cena), o nome do efeito
        if (vars.acao) vars.acao = ou(`flair3d.ui.acaoCor.${vars.modalidade}.${vars.acao}`, ou(`flair3d.ui.acaoCor.${vars.acao}`, ou(`flair3d.ui.efeito.COR_${vars.acao}`, vars.acao)));
        if (vars.venceu) vars.desfecho = t(`flair3d.ui.acaoCor.${vars.venceu === "true" ? "ok" : "falhou"}`);
        // o que o lance mudou (força do time, placar, um lance a menos do adversário); servidor antigo não manda: fica vazio
        vars.ganhoTexto = vars.efeito ? ou(`flair3d.ui.lanceEfeito.${vars.efeito}`, "", vars) : "";
        if (vars.atributo) vars.atributo = ou(`flair3d.ui.hud.attr.${vars.atributo}`, vars.atributo);
        // código novo do servidor ainda sem frase: o nome do código em letras comuns, nunca "FORCA_SEGUNDO_TEMPO"; um
        // valor de estrutura (o estado do caso do Detective) não vira texto: a linha fica vazia e o resultado a pula
        const semFrase = v != null && typeof v === "object" ? "" : `${legivel(e.codigo)}: ${vars.valor}`;
        return ou(`flair3d.ui.evento.${e.codigo}`, semFrase, vars);
      },
      resultado: (r: string) => ou(`flair3d.ui.result.resultado.${r}`, r),
      papel: (p: string) => ou(`flair3d.ui.papel.${p}`, p),
      posicao: (p: string) => ou(`flair3d.ui.tab.${p}`, p),
    };
  }, [t, locale]);
}
