/**
 * O efeito de cena da cor da peça (docs/flair/flair-3d/CORES_E_ACOES.md, seção 2-A): ao vestir a carta, a cena 3D faz o
 * que o nome do efeito diz, com os atores que a sala já tem (plateia, fotógrafos, cliente, claquete, luzes do lugar) e
 * a luz de efeito, que acende atrás do avatar na cor da família. Nada passa na frente da roupa; cada efeito dura até 4
 * segundos e volta ao estado parado. Com "reduzir movimento" o diretor mostra o quadro parado (a luz acesa, sem piscar).
 * Não muda a nota: só mostra o efeito que o servidor deu à carta.
 */
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";
import type { Sequencia } from "@/lib/flair/nucleos/scene/director";
import { AVATAR, fig, luzId, movelId, Roteiro } from "@/lib/flair/nucleos/scene/script";

/** A luz de efeito: toda sala tem uma, atrás do avatar, apagada até uma carta com cor entrar. */
export const LUZ_DE_EFEITO = "efeito";

/** Um passo do efeito: quem age e com que clipe (todos começam juntos). */
type PassoDeCor = [ator: string, clip: string];

const luz = (clip = "L_ACENDE"): PassoDeCor => [luzId(LUZ_DE_EFEITO), clip];
const daSala = (id: string, clip = "L_ACENDE"): PassoDeCor => [luzId(id), clip];

/** O que acontece na cena em cada efeito, por jogo (os nomes são os de Flair3dCores.DE_CENA no servidor). */
export const EFEITOS_DE_COR: Partial<Record<NucleoCodigo, Record<string, PassoDeCor[]>>> = {
  PASSARELA: {
    SILHUETA: [luz()],
    BRISA: [luz("L_ONDULA")],
    HOLOFOTE: [daSala("spots"), luz()],
    FLASHES: [daSala("flash", "L_FLASH"), luz("L_FLASH")],
    APLAUSOS: [[fig("PLATEIA"), "F_APLAUSO"], luz()],
    PASSARELA_ACESA: [daSala("painel"), daSala("spots"), luz()],
  },
  DRESS_FIGHTER: {
    GUARDA: [[AVATAR, "GUARDA"], luz()],
    ESQUIVA: [[AVATAR, "ESQUIVA"], luz()],
    GOLPE_RAPIDO: [[AVATAR, "SOCO"], daSala("rastro", "L_RASTRO"), luz("L_FLASH")],
    FOLEGO: [luz("L_ONDULA")],
    GOLPE_FORTE: [[AVATAR, "CHUTE"], daSala("rastro", "L_RASTRO"), luz("L_FLASH")],
    FOCO: [daSala("neonRosa"), daSala("neonAzul"), luz()],
  },
  DRESS_THE_STAR: {
    ELEGANCIA: [daSala("canhoes"), luz()],
    FRESCOR: [luz("L_ONDULA")],
    BRILHO: [daSala("telao", "L_FLASH"), luz("L_FLASH")],
    SERENIDADE: [luz()],
    TAPETE_VERMELHO: [daSala("canhoes"), luz()],
    FLASH_FOTOGRAFOS: [[fig("PLATEIA"), "F_APLAUSO"], luz("L_FLASH")],
  },
  PERSONAGEM_FILME: {
    SUSPENSE: [daSala("set"), luz()],
    AVENTURA: [daSala("set2"), luz()],
    COMEDIA: [daSala("set"), daSala("set2"), luz()],
    FICCAO: [daSala("genero"), luz("L_ONDULA")],
    ROMANCE: [daSala("genero"), luz()],
    CLAQUETE: [[movelId("claquete"), "M_CLAQUETE"], luz("L_FLASH")],
  },
  ROAD_TO_GLORY: {
    CONTRASTE: [luz()],
    NATURAL: [luz()],
    LUZ_DOURADA: [daSala("espelho"), luz()],
    LUZ_FRIA: [luz()],
    DESTAQUE: [daSala("espelho"), luz()],
    REBATEDOR: [daSala("flash", "L_FLASH"), luz()],
  },
  BOUTIQUE_3D: {
    VITRINE_NOITE: [daSala("vitrine"), luz()],
    ETIQUETA: [luz("L_FLASH")],
    PLACA_DESTAQUE: [daSala("vitrine"), luz()],
    CLIENTE_OLHA: [[fig("CLIENTE", 0), "F_ACENA"], luz()],
    CLIENTE_SORRI: [[fig("CLIENTE", 0), "F_COMEMORA"], luz()],
    VITRINE_ACESA: [daSala("vitrine"), daSala("espelho"), luz()],
  },
  LABIRINTO: {
    SOMBRA: [daSala("fechadura", "L_ONDULA"), luz()],
    TRILHA: [luz("L_ONDULA")],
    LANTERNA: [luz()],
    REFLEXO: [daSala("espelho"), luz()],
    ALERTA: [daSala("falha", "L_FLASH"), luz("L_FLASH")],
    CLARAO: [daSala("espelho", "L_FLASH"), luz("L_FLASH")],
  },
  AROUND_THE_WORLD: {
    NOITE_NA_CIDADE: [daSala("vitrine"), luz()],
    PARQUE: [luz("L_ONDULA")],
    SOL: [daSala("mapa"), luz()],
    MAR: [[fig("PASSANTE"), "F_ACENA"], luz("L_ONDULA")],
    FESTA_DE_RUA: [[fig("PASSANTE"), "F_COMEMORA"], luz()],
    INVERNO: [luz()],
  },
  BATALHA_LOOKS: {
    IMPACTO: [daSala("painel", "L_FLASH"), luz("L_FLASH")],
    VIBRACAO: [[fig("PLATEIA"), "F_COMEMORA"], luz()],
    FAISCAS: [daSala("vencedor", "L_FLASH"), luz("L_FLASH")],
    ONDA: [luz("L_ONDULA")],
    CHAMAS: [daSala("painel"), luz("L_ONDULA")],
    ESTROBO: [daSala("spots", "L_FLASH"), luz("L_FLASH")],
  },
};

/** "COR_APLAUSOS" → "APLAUSOS"; código que não é de cena (ação do esporte, do detetive) devolve null. */
export function nomeDoEfeito(codigo: string): string | null {
  return codigo.startsWith("COR_") ? codigo.slice("COR_".length) : null;
}

/** A sequência do efeito de cor de uma carta neste jogo; jogo ou efeito sem cena devolve null. */
export function sequenciaDaCor(codigo: NucleoCodigo, efeito: string): Sequencia | null {
  const nome = nomeDoEfeito(efeito);
  const passos = nome ? EFEITOS_DE_COR[codigo]?.[nome] : undefined;
  if (!passos) return null;
  const r = new Roteiro(`cor-${nome}`);
  for (const [ator, clip] of passos) r.junto(ator, clip);
  return r.fim();
}
