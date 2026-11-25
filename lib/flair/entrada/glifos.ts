/**
 * O símbolo do botão de cada ação para mostrar na tela, pelo último aparelho usado: os símbolos do PlayStation, as
 * letras do Xbox, a tecla do teclado ou o botão da tela de toque. O símbolo é só visual; o nome lido pelo leitor de
 * tela vem do catálogo (flair3d.entrada.acao.<ACAO>). Puro.
 */
import type { AcaoEntrada, FamiliaControle, Origem } from "@/lib/flair/entrada/acoes";

const PLAYSTATION: Record<AcaoEntrada, string> = { INTERAGIR: "✕", CANCELAR: "○", ACAO: "□", INVENTARIO: "△", PAUSAR: "Options" };
const XBOX: Record<AcaoEntrada, string> = { INTERAGIR: "A", CANCELAR: "B", ACAO: "X", INVENTARIO: "Y", PAUSAR: "Menu" };
const GENERICO: Record<AcaoEntrada, string> = { INTERAGIR: "1", CANCELAR: "2", ACAO: "3", INVENTARIO: "4", PAUSAR: "Start" };
const TECLADO: Record<AcaoEntrada, string> = { INTERAGIR: "Espaço", CANCELAR: "Shift", ACAO: "F", INVENTARIO: "I", PAUSAR: "Esc" };
/** Na tela de toque os botões têm os símbolos de console (o padrão que a dona pediu). */
const TOQUE = PLAYSTATION;

export interface Glifo {
  simbolo: string;
  /** chave do catálogo com o nome da ação, para o leitor de tela e a legenda */
  rotuloKey: string;
}

export function glifo(acao: AcaoEntrada, origem: Origem, familia: FamiliaControle = "GENERICO"): Glifo {
  const tabela = origem === "CONTROLE" ? (familia === "PLAYSTATION" ? PLAYSTATION : familia === "XBOX" ? XBOX : GENERICO) : origem === "TOQUE" ? TOQUE : TECLADO;
  return { simbolo: tabela[acao], rotuloKey: `flair3d.entrada.acao.${acao}` };
}
