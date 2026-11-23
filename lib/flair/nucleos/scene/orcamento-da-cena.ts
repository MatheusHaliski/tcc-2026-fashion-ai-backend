/**
 * Orçamento por cena (auditoria dos jogos, mudança 7): quantos triângulos e quantas chamadas de desenho a cena de cada
 * jogo manda por quadro, com a sala, a avatar, as pessoas de corpo inteiro e as de corpo leve. Não há placa de vídeo no
 * ambiente de desenvolvimento, então a conta é conferida por teste, que monta a geometria de verdade e conta
 * (components/flair/nucleos/scene/orcamento.test.tsx).
 *
 * O que pesa é o corpo inteiro: cerca de 20 mil triângulos e 13 chamadas, que dobram quando ele faz sombra (medido na
 * transmissão do Fashion Sports e na Passarela, docs/flair/flair-3d/BASE_NUCLEOS.md). Por isso cada cena tem o próprio
 * número de corpos inteiros de figurante (quem importa de perto), e o resto da gente é corpo leve: 364 triângulos por
 * pessoa e cinco chamadas para todas juntas. A qualidade da cena (qualidade.ts) corta mais quando a máquina é lenta.
 * Puro.
 */
import { ehGente } from "@/lib/flair/nucleos/gente/figurantes";
import { CORPOS_CHEIOS, TRIANGULOS_POR_PESSOA } from "@/lib/flair/nucleos/gente/detalhe";
import { figurantesDaCena } from "@/lib/flair/nucleos/scene/budget";
import { partesDoFigurante } from "@/lib/flair/nucleos/scene/figurantes";
import { fazSombra } from "@/lib/flair/nucleos/scene/materials";
import { partesNoLugar, triangulosDaParte } from "@/lib/flair/nucleos/scene/parts";
import { AJUSTES, type Qualidade } from "@/lib/flair/nucleos/scene/qualidade";
import { cascaDaSala } from "@/lib/flair/nucleos/scene/shell";
import type { Parte, Sala } from "@/lib/flair/nucleos/scene/types";
import type { NucleoCodigo, NucleoPersonagem } from "@/lib/flair/nucleos/types";

/** O corpo inteiro (a avatar ou um figurante), sem a passada de sombra: a sombra desenha tudo outra vez. */
export const CORPO_INTEIRO = { triangulos: TRIANGULOS_POR_PESSOA.humano / 2, chamadas: 13 } as const;
/** As pessoas leves de uma cena: os triângulos de cada uma e as chamadas de todas juntas (malhas instanciadas). */
export const CORPO_LEVE = { triangulos: TRIANGULOS_POR_PESSOA.torcida, chamadasPorCena: 5 } as const;

/**
 * Quantos figurantes têm o corpo inteiro em cada jogo, na qualidade alta: quem divide a cena de perto com a avatar.
 * A Passarela é a sala mais pesada (14 pessoas): só os dois da plateia mais perto da lente ficam inteiros. Os jogos
 * que não estão aqui seguem com o limite comum (CORPOS_CHEIOS).
 */
export const CORPOS_CHEIOS_DA_CENA: Partial<Record<NucleoCodigo, number>> = {
  PASSARELA: 2,
  DRESS_FIGHTER: 1,
  DRESS_THE_STAR: 2,
  PERSONAGEM_FILME: 0,
  FASHION_DETECTIVE: 3,
  BOUTIQUE_3D: 2,
  LABIRINTO: 0,
  AROUND_THE_WORLD: 2,
  FASHION_SPORTS: 3,
  BATALHA_LOOKS: 2,
};

/** O teto de cada cena por qualidade: o que o teste confere em todos os jogos da auditoria. */
export const ORCAMENTO_DA_CENA: Record<Qualidade, { triangulos: number; chamadas: number }> = {
  ALTA: { triangulos: 180_000, chamadas: 140 },
  MEDIA: { triangulos: 80_000, chamadas: 75 },
  BAIXA: { triangulos: 35_000, chamadas: 36 },
};

/** Quantos figurantes de corpo inteiro a cena deste jogo tem agora, pela qualidade. */
export function corposCheiosDaCena(codigo: NucleoCodigo, qualidade: Qualidade = "ALTA"): number {
  return Math.min(CORPOS_CHEIOS_DA_CENA[codigo] ?? CORPOS_CHEIOS, AJUSTES[qualidade].corposCheios);
}

export interface ContaDaCena {
  triangulos: number;
  chamadas: number;
  /** de quem é a conta: a sala, a avatar, os figurantes de corpo inteiro e os de corpo leve */
  sala: { triangulos: number; chamadas: number };
  cheios: number;
  leves: number;
}

const soma = (partes: Parte[]) => partes.reduce((n, p) => n + triangulosDaParte(p), 0);
const materiais = (partes: Parte[]) => new Set(partes.map((p) => p.mat));

/**
 * A sala montada: a casca e os móveis fixos viram uma malha por material; cada móvel animado, uma por material dele;
 * o placar, uma. Com sombra, tudo o que faz sombra (móveis de material opaco) é desenhado mais uma vez.
 */
export function contaDaSala(sala: Sala, sombra: boolean, comPlacar = false): { triangulos: number; chamadas: number; naSombra: { triangulos: number; chamadas: number } } {
  const casca = cascaDaSala(sala);
  const fixos = sala.moveis.filter((m) => !m.id).flatMap(partesNoLugar);
  const animados = sala.moveis.filter((m) => !!m.id).map((m) => m.partes);
  const grupos = [fixos, ...animados];
  const opacas = grupos.map((g) => g.filter((p) => fazSombra(sala.materiais[p.mat])));
  const naSombra = { triangulos: opacas.reduce((n, g) => n + soma(g), 0), chamadas: opacas.reduce((n, g) => n + materiais(g).size, 0) };
  const placar = comPlacar && sala.placar ? 1 : 0;
  return {
    triangulos: soma(casca) + grupos.reduce((n, g) => n + soma(g), 0) + 2 * placar + (sombra ? naSombra.triangulos : 0),
    chamadas: materiais(casca).size + grupos.reduce((n, g) => n + materiais(g).size, 0) + placar + (sombra ? naSombra.chamadas : 0),
    naSombra,
  };
}

/** Os objetos de cena que não são gente (manequim, câmera, claquete): a silhueta deles, corpo e dois braços. */
function contaDosObjetos(personagens: NucleoPersonagem[], sombra: boolean): { triangulos: number; chamadas: number } {
  const objetos = personagens.filter((p) => !ehGente(p));
  const malhas = objetos.reduce((n, p) => n + (p.postura === "busto" ? 1 : 3), 0);
  const triangulos = objetos.reduce((n, p) => n + soma(partesDoFigurante(p.postura)), 0);
  return { triangulos: triangulos * (sombra ? 2 : 1), chamadas: malhas * (sombra ? 2 : 1) };
}

/**
 * A conta da cena de um jogo numa qualidade. `cheiosPedidos`: quantos figurantes de corpo inteiro (sem ele, o do
 * orçamento da cena); `levesInstanciados` = false refaz a conta de antes (cinco chamadas por pessoa leve).
 */
export function contaDaCena(codigo: NucleoCodigo, sala: Sala, personagens: NucleoPersonagem[], qualidade: Qualidade = "ALTA", cheiosPedidos?: number, levesInstanciados = true): ContaDaCena {
  const ajuste = AJUSTES[qualidade];
  const todos = figurantesDaCena(sala, personagens);
  const gente = todos.filter(ehGente).length;
  const cheios = Math.min(gente, cheiosPedidos ?? corposCheiosDaCena(codigo, qualidade));
  const leves = gente - cheios;
  const daSala = contaDaSala(sala, ajuste.sombra);
  const objetos = contaDosObjetos(todos, ajuste.sombra);
  // a avatar faz sombra sempre que a cena tem sombra; o figurante, só de perto na qualidade alta (conta o pior caso)
  const avatar = ajuste.sombra ? 2 : 1;
  const figurante = ajuste.sombra && ajuste.sombraDeFiguranteAte > 0 ? 2 : 1;
  const corpos = avatar + cheios * figurante;
  return {
    triangulos: daSala.triangulos + objetos.triangulos + corpos * CORPO_INTEIRO.triangulos + leves * CORPO_LEVE.triangulos,
    chamadas: daSala.chamadas + objetos.chamadas + corpos * CORPO_INTEIRO.chamadas + (levesInstanciados ? (leves > 0 ? CORPO_LEVE.chamadasPorCena : 0) : leves * CORPO_LEVE.chamadasPorCena),
    sala: { triangulos: daSala.triangulos, chamadas: daSala.chamadas },
    cheios,
    leves,
  };
}

/** O que estoura o orçamento da cena nesta qualidade (vazio = dentro). */
export function estourosDaCena(conta: ContaDaCena, qualidade: Qualidade = "ALTA"): string[] {
  const teto = ORCAMENTO_DA_CENA[qualidade];
  return [conta.triangulos > teto.triangulos ? "triangulos" : "", conta.chamadas > teto.chamadas ? "chamadas" : ""].filter(Boolean);
}
