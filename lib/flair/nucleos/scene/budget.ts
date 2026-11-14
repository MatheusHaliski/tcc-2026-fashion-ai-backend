/**
 * Orçamento do cenário (seção 3): até 60 mil triângulos, até 12 materiais e texturas de até 1024 px. A conta sai da
 * descrição pura da sala; o teste confere que a geometria gerada tem os mesmos triângulos.
 */
import type { NucleoPersonagem } from "@/lib/flair/nucleos/types";
import { glbDoMovel, type ManifestoGlb } from "@/lib/flair/nucleos/scene/assets";
import { MAT_FIGURANTE, partesDoFigurante } from "@/lib/flair/nucleos/scene/figurantes";
import { partesNoLugar, triangulosDaParte } from "@/lib/flair/nucleos/scene/parts";
import { cascaDaSala } from "@/lib/flair/nucleos/scene/shell";
import { ORCAMENTO, type Parte, type Sala } from "@/lib/flair/nucleos/scene/types";

/** material do texto do placar (painel de LED com números) */
export const MAT_PLACAR = "placar";

export interface Orcamento {
  triangulos: number;
  materiais: number;
  texturaPx: number;
  luzesProprias: number;
}

/** Todas as partes fixas e animadas da sala, já no lugar. */
export function partesDaSala(sala: Sala): Parte[] {
  return [...cascaDaSala(sala), ...sala.moveis.flatMap(partesNoLugar)];
}

/** Todos os figurantes da cena: os personagens do arquivo do núcleo e os de cenário da sala. */
export function figurantesDaCena(sala: Sala, personagens: NucleoPersonagem[]): NucleoPersonagem[] {
  return [...(sala.personagens ?? personagens), ...sala.figurantes];
}

const soma = (partes: Parte[]) => partes.reduce((n, p) => n + triangulosDaParte(p), 0);

/**
 * Orçamento da sala. Com o manifesto dos objetos GLB, cada móvel que tem um GLB disponível conta os triângulos do
 * arquivo (e um material) no lugar das partes procedurais; sem manifesto, vale a sala toda procedural.
 */
export function orcamentoDaSala(sala: Sala, personagens: NucleoPersonagem[] = [], manifesto: ManifestoGlb = []): Orcamento {
  const comGlb = sala.moveis.filter((m) => glbDoMovel(m, manifesto, sala.codigo));
  const semGlb = sala.moveis.filter((m) => !glbDoMovel(m, manifesto, sala.codigo));
  const partes = [...cascaDaSala(sala), ...semGlb.flatMap(partesNoLugar)];
  const figurantes = figurantesDaCena(sala, personagens);
  const usados = new Set(partes.map((p) => p.mat));
  for (const m of comGlb) usados.add(`glb:${glbDoMovel(m, manifesto, sala.codigo)?.slug}`);
  const triGlb = comGlb.reduce((n, m) => n + (glbDoMovel(m, manifesto, sala.codigo)?.triangles ?? 0), 0);
  if (figurantes.length > 0) usados.add(MAT_FIGURANTE);
  if (sala.placar) usados.add(MAT_PLACAR);
  const triFigurantes = figurantes.reduce((n, f) => n + soma(partesDoFigurante(f.postura)), 0);
  const texturas = Object.values(sala.materiais).map((m) => m.px);
  return {
    triangulos: soma(partes) + triGlb + triFigurantes + (sala.placar ? 2 : 0),
    materiais: usados.size,
    texturaPx: Math.max(0, ...texturas),
    luzesProprias: sala.luzes.proprias.length,
  };
}

/** O que estoura o orçamento (vazio = dentro). */
export function estourosDoOrcamento(o: Orcamento): string[] {
  const fora: string[] = [];
  if (o.triangulos > ORCAMENTO.triangulos) fora.push("triangulos");
  if (o.materiais > ORCAMENTO.materiais) fora.push("materiais");
  if (o.texturaPx > ORCAMENTO.texturaPx) fora.push("textura");
  if (o.luzesProprias > ORCAMENTO.luzesProprias) fora.push("luzes");
  return fora;
}
