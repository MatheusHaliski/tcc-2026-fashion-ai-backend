/**
 * Os quatro momentos da partida (docs/flair/flair-3d/DESENHO_DA_TELA.md, seção 4) como estado explícito: deck,
 * preparação, ação e resultado, com o que a pessoa pode fazer com a carta em cada um e o acionamento que cada jogo
 * permite. Puro (State como tabela de transições): a tela guarda o momento e pergunta aqui o que vale.
 */
import type { NucleoAcao, NucleoCodigo } from "@/lib/flair/nucleos/types";

export type Momento = "DECK" | "PREPARACAO" | "ACAO" | "RESULTADO";

export type MomentoEvento =
  | { type: "ENTRAR" }
  | { type: "ENTREGUE" }
  | { type: "FIM_ACAO" }
  | { type: "REINICIAR"; semDeck: boolean };

/** Núcleo sem deck (zonas do editor, guarda-roupa liberado) começa direto na preparação. */
export function momentoInicial(semDeck: boolean): Momento {
  return semDeck ? "PREPARACAO" : "DECK";
}

/** Transição; evento que não vale no momento atual não muda nada. */
export function proximoMomento(momento: Momento, evento: MomentoEvento): Momento {
  switch (evento.type) {
    case "ENTRAR":
      return momento === "DECK" ? "PREPARACAO" : momento;
    case "ENTREGUE":
      return momento === "PREPARACAO" ? "ACAO" : momento;
    case "FIM_ACAO":
      return momento === "ACAO" ? "RESULTADO" : momento;
    case "REINICIAR":
      return momentoInicial(evento.semDeck);
  }
}

/** O que a pessoa faz com a carta (e com a tela) em algum momento da partida. */
export type AcaoDeCarta =
  | "ESCOLHER"
  | "VESTIR"
  | "TROCAR"
  | "TIRAR"
  | "AMPLIAR"
  | "ENTREGAR"
  | "ACIONAR"
  | "CAMERA"
  | "PULAR";

/** Acionamento pela pessoa: um por jogo, no momento em que a tabela do desenho permite. */
export type AcionamentoTipo = "ESPECIAL" | "ESPELHO" | "TROCA" | "RESPOSTA";

export interface Acionamento {
  tipo: AcionamentoTipo;
  momento: Momento;
}

export const ACIONAMENTOS: Partial<Record<NucleoCodigo, Acionamento>> = {
  DRESS_FIGHTER: { tipo: "ESPECIAL", momento: "ACAO" },
  PERSONAGEM_FILME: { tipo: "RESPOSTA", momento: "PREPARACAO" },
  LABIRINTO: { tipo: "ESPELHO", momento: "PREPARACAO" },
  FASHION_SPORTS: { tipo: "TROCA", momento: "ACAO" },
};

export function acionamentoDe(codigo: NucleoCodigo): Acionamento | null {
  return ACIONAMENTOS[codigo] ?? null;
}

const PERMITIDO: Record<Momento, AcaoDeCarta[]> = {
  DECK: ["ESCOLHER", "AMPLIAR"],
  PREPARACAO: ["VESTIR", "TROCAR", "TIRAR", "AMPLIAR", "ENTREGAR", "CAMERA"],
  ACAO: ["CAMERA", "PULAR"],
  RESULTADO: ["CAMERA"],
};

/** A ação vale neste momento? "ACIONAR" só no momento do acionamento do jogo (e só nos jogos que têm um). */
export function permitido(momento: Momento, acao: AcaoDeCarta, codigo?: NucleoCodigo): boolean {
  if (acao === "ACIONAR") return !!codigo && acionamentoDe(codigo)?.momento === momento;
  return PERMITIDO[momento].includes(acao);
}

const DO_COMANDO: Record<NucleoAcao, AcaoDeCarta> = {
  NAVEGAR: "VESTIR",
  TROCAR_ABA: "VESTIR",
  VESTIR: "VESTIR",
  TIRAR: "TIRAR",
  GIRAR: "CAMERA",
  ZOOM: "CAMERA",
  POSAR: "CAMERA",
  DESFILAR: "VESTIR",
  ENTREGAR: "ENTREGAR",
  VER_OBJETIVO: "CAMERA",
};

/** Comando do controle (teclado, toque, gamepad) aceito no momento: na ação e no resultado só câmera e objetivo. */
export function comandoPermitido(momento: Momento, acao: NucleoAcao): boolean {
  return permitido(momento, DO_COMANDO[acao]);
}
