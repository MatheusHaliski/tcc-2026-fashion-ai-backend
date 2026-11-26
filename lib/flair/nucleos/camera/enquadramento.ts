/**
 * O enquadramento das câmeras dos jogos (auditoria dos jogos, mudança 6): o que precisa aparecer no quadro, os limites
 * de distância e de ângulo, e o que a lente nunca pode atravessar (o corpo da avatar, o das pessoas de cena, os móveis,
 * o piso e as paredes). As contas são as de uma câmera de perspectiva (a mesma do three.js), sem depender dela: servem
 * à câmera do jogo e aos testes, que não têm placa de vídeo. Tudo em metros; y para cima. Puro.
 */
import type { Assunto, Caixa, Pose } from "@/lib/flair/nucleos/camera/rigs";
import { ALTURA_DE_PISO } from "@/lib/flair/nucleos/scene/zones";
import { partesNoLugar, volumeDaParte } from "@/lib/flair/nucleos/scene/parts";
import type { Sala } from "@/lib/flair/nucleos/scene/types";
import type { NucleoCodigo, NucleoPersonagem, V3 } from "@/lib/flair/nucleos/types";

const RAD = Math.PI / 180;
/** A altura de uma pessoa de pé e o raio do corpo dela (ombros e braços), para o quadro e para a lente não entrar. */
export const ALTURA_DO_CORPO = 1.8;
export const RAIO_DO_CORPO = 0.35;
/** A folga entre a lente e um corpo, um móvel, o piso ou uma parede (o plano próximo da câmera é 0,1 m). */
export const FOLGA_DA_LENTE = 0.2;

/** Os limites de qualquer câmera de jogo: quão longe e em que ângulo de altura ela pode ficar em relação à mira. */
export const LIMITES_DA_CAMERA = {
  /** de baixo para cima (o fosso, o ângulo de herói): nunca mais que isto abaixo da mira */
  elevacaoMinima: -25,
  /** de cima (a aérea olha quase a prumo) */
  elevacaoMaxima: 89,
  /** distância máxima da lente à mira, com a tela em pé e o zoom todo afastado */
  distanciaMaxima: 16,
} as const;

/** Onde um ponto cai no quadro: x e y de −1 a 1 (o centro é 0) e a distância à frente da lente. */
export interface NoQuadro {
  x: number;
  y: number;
  frente: number;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const n = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};

/** Projeta um ponto da sala no quadro da câmera (a mesma conta do lookAt com o "para cima" em y). */
export function projetar(pose: Pose, ponto: V3, aspecto: number): NoQuadro {
  const frente = norm(sub(pose.alvo, pose.pos));
  // olhando a prumo, o "para cima" da imagem é o fundo da sala (−z), como na câmera aérea
  const cima: V3 = Math.abs(frente[1]) > 0.999 ? [0, 0, -1] : [0, 1, 0];
  const direita = norm(cross(frente, cima));
  const topo = cross(direita, frente);
  const d = sub(ponto, pose.pos);
  const z = dot(d, frente);
  const meia = Math.tan((pose.fov * RAD) / 2);
  return { x: dot(d, direita) / (Math.max(1e-6, z) * meia * aspecto), y: dot(d, topo) / (Math.max(1e-6, z) * meia), frente: z };
}

/** O ponto aparece no quadro? `margem`: quanto do quadro fica de respiro nas bordas (0,05 = 5%). */
export function noQuadro(pose: Pose, ponto: V3, aspecto: number, margem = 0): boolean {
  const p = projetar(pose, ponto, aspecto);
  return p.frente > 0.1 && Math.abs(p.x) <= 1 - margem && Math.abs(p.y) <= 1 - margem;
}

/** A pessoa de pé em `pes` aparece inteira, dos pés ao topo da cabeça? */
export function corpoInteiroNoQuadro(pose: Pose, pes: V3, aspecto: number, margem = 0): boolean {
  return noQuadro(pose, pes, aspecto, margem) && noQuadro(pose, [pes[0], pes[1] + ALTURA_DO_CORPO, pes[2]], aspecto, margem);
}

/** Ângulo de altura da lente em relação à mira, em graus (positivo = de cima). */
export function elevacao(pose: Pose): number {
  const d = sub(pose.pos, pose.alvo);
  return Math.atan2(d[1], Math.hypot(d[0], d[2])) / RAD;
}

export function distanciaDaMira(pose: Pose): number {
  const d = sub(pose.pos, pose.alvo);
  return Math.hypot(d[0], d[1], d[2]);
}

/** Distância da lente ao corpo de uma pessoa de pé em `pes` (um cilindro da altura do corpo); 0 = dentro dele. */
export function distanciaAoCorpo(lente: V3, pes: V3, altura = ALTURA_DO_CORPO, raio = RAIO_DO_CORPO): number {
  const horizontal = Math.max(0, Math.hypot(lente[0] - pes[0], lente[2] - pes[2]) - raio);
  const vertical = Math.max(0, pes[1] - lente[1], lente[1] - (pes[1] + altura));
  return Math.hypot(horizontal, vertical);
}

/** Os corpos das pessoas de cena, como obstáculos da lente (sentada, a pessoa é mais baixa). */
export function obstaculosDasPessoas(personagens: NucleoPersonagem[]): NonNullable<Assunto["evita"]> {
  return personagens.map((p) => ({ pos: p.pos, altura: p.postura === "sentada" ? 1.35 : ALTURA_DO_CORPO * (p.escala ?? 1) }));
}

const CAIXAS = new WeakMap<Sala, { tipo: string; caixa: Caixa }[]>();

/** As partes dos móveis da sala como caixas, sem o que é piso (linhas, tapete, marca): ali a lente nunca chega. */
function caixasComTipo(sala: Sala): { tipo: string; caixa: Caixa }[] {
  let lista = CAIXAS.get(sala);
  if (!lista) {
    lista = sala.moveis.flatMap((m) =>
      partesNoLugar(m).flatMap((p) => {
        const v = volumeDaParte(p);
        // o que é piso (linhas, tapete, marca) e as folhas sem espessura (planos) não têm "dentro"
        if (v.topo <= ALTURA_DE_PISO || p.forma === "plano") return [];
        return [{ tipo: m.tipo, caixa: { x: [p.pos[0] - v.meioX, p.pos[0] + v.meioX], y: [v.base, v.topo], z: [p.pos[2] - v.meioZ, p.pos[2] + v.meioZ] } as Caixa }];
      }),
    );
    CAIXAS.set(sala, lista);
  }
  return lista;
}

/** Os móveis da sala como obstáculos da lente, com a folga em volta de cada parte (a conta é feita uma vez por sala). */
const COM_FOLGA = new WeakMap<Sala, Map<number, Caixa[]>>();
export function obstaculosDaSala(sala: Sala, folga = FOLGA_DA_LENTE): Caixa[] {
  // uma lista por folga: a lente pede a dela e o andar pede zero (antes valia a de quem chamasse primeiro)
  const porFolga = COM_FOLGA.get(sala) ?? new Map<number, Caixa[]>();
  COM_FOLGA.set(sala, porFolga);
  let lista = porFolga.get(folga);
  if (!lista) {
    lista = caixasComTipo(sala).map(({ caixa: c }) => ({ x: [c.x[0] - folga, c.x[1] + folga], y: [c.y[0] - folga, c.y[1] + folga], z: [c.z[0] - folga, c.z[1] + folga] }));
    porFolga.set(folga, lista);
  }
  return lista;
}

/** A lente está dentro de alguma parte de um móvel da sala (com a folga)? Devolve o tipo do móvel, ou null. */
export function movelNaLente(sala: Sala, lente: V3, folga = FOLGA_DA_LENTE): string | null {
  for (const { tipo, caixa: c } of caixasComTipo(sala)) {
    if (lente[1] < c.y[0] - folga || lente[1] > c.y[1] + folga) continue;
    if (lente[0] >= c.x[0] - folga && lente[0] <= c.x[1] + folga && lente[2] >= c.z[0] - folga && lente[2] <= c.z[1] + folga) return tipo;
  }
  return null;
}

/**
 * O que importa na rodada, além da avatar, e precisa aparecer no quadro do preparo (o papel de quem divide a cena com
 * ela): a oponente da luta, o adversário da batalha, a cliente da loja, a estrela. Nos outros jogos a rodada é a
 * avatar e o lugar.
 */
export const PAPEL_DE_INTERESSE: Partial<Record<NucleoCodigo, string>> = {
  DRESS_FIGHTER: "OPONENTE",
  BATALHA_LOOKS: "ADVERSARIO",
  BOUTIQUE_3D: "CLIENTE",
};

/** Os pés de quem importa na rodada (vazio quando a rodada é só a avatar). */
export function interesseDaRodada(codigo: NucleoCodigo, personagens: NucleoPersonagem[]): V3[] {
  const papel = PAPEL_DE_INTERESSE[codigo];
  return papel ? personagens.filter((p) => p.papel === papel).map((p) => p.pos) : [];
}
