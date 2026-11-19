/**
 * Câmera dos jogos (auditoria dos jogos, mudança 6), jogo a jogo: o preparo mostra a avatar inteira e o que importa na
 * rodada; toda câmera de todo jogo, em qualquer instante, zoom e formato de tela, fica dentro dos limites de distância e
 * de ângulo e nunca dentro de um corpo, de um móvel, do piso ou de uma parede; e todo jogo tem pelo menos duas vistas
 * com nome. Sem placa de vídeo: as contas são as da lente.
 */
import { describe, expect, it } from "vitest";
import { CAMERAS_DO_CAMPO, poseDaCamera, poseEscolhida } from "@/lib/flair/esporte/camera";
import { CAMPOS } from "@/lib/flair/esporte/campo";
import { aproximarEmVolta, foraDosCorpos, fracaoDoQuadro, RAIO_LIVRE } from "@/lib/flair/nucleos/camera/colisao";
import {
  corpoInteiroNoQuadro,
  distanciaAoCorpo,
  distanciaDaMira,
  elevacao,
  FOLGA_DA_LENTE,
  interesseDaRodada,
  LIMITES_DA_CAMERA,
  movelNaLente,
  noQuadro,
  obstaculosDaSala,
  obstaculosDasPessoas,
  projetar,
} from "@/lib/flair/nucleos/camera/enquadramento";
import { cameraEmUso, CAMERAS, opcoesDeCamera } from "@/lib/flair/nucleos/camera/jogos";
import { poseDoRig, type Assunto, type Pose } from "@/lib/flair/nucleos/camera/rigs";
import { comZoom, limitesDaSala } from "@/lib/flair/nucleos/camera/sala";
import ptBR from "@/lib/i18n/messages/pt-BR.json";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import { figurantesDaCena } from "@/lib/flair/nucleos/scene/budget";
import { Diretor } from "@/lib/flair/nucleos/scene/director";
import { salaDe, VARIANTES } from "@/lib/flair/nucleos/scene/registry";
import { sequenciaDoResultado } from "@/lib/flair/nucleos/scene/sequences-auto";
import { sequenciaDeIda, sequenciaDeVolta } from "@/lib/flair/nucleos/scene/sequences-manual";
import type { Sala } from "@/lib/flair/nucleos/scene/types";
import type { NucleoCodigo, NucleoResultado, V3 } from "@/lib/flair/nucleos/types";

/** Os dez jogos da auditoria. */
const JOGOS: NucleoCodigo[] = ["PASSARELA", "DRESS_FIGHTER", "DRESS_THE_STAR", "PERSONAGEM_FILME", "FASHION_DETECTIVE", "BOUTIQUE_3D", "LABIRINTO", "AROUND_THE_WORLD", "FASHION_SPORTS", "BATALHA_LOOKS"];
const PAISAGEM = 1.6;
const EM_PE = 390 / 844;
const textos = ptBR as Record<string, string>;

function assuntoDe(codigo: NucleoCodigo, sala: Sala = salaDe(codigo), em: { x: number; z: number; giro: number } = { x: 0, z: 0, giro: 0 }): Assunto {
  const pessoas = figurantesDaCena(sala, NUCLEOS[codigo].personagens);
  return { pos: [em.x, sala.zonas.avatar.altura, em.z], giro: em.giro, limites: limitesDaSala(sala), evita: obstaculosDasPessoas(pessoas), caixas: obstaculosDaSala(sala) };
}

/** Por onde a avatar passa nas sequências do jogo (ida, volta e os desfechos): o lugar dela a cada meio segundo. */
function caminhoDaAvatar(codigo: NucleoCodigo): { x: number; z: number; giro: number }[] {
  const lugares = [{ x: 0, z: 0, giro: 0 }];
  const res = (resultado: string, estrelas: number): NucleoResultado => ({ pontos: 50, estrelas, resultado, regras: [], eventos: [{ codigo: "PLACAR", valor: "1-1" }] });
  const seqs = [sequenciaDeIda(codigo), sequenciaDeVolta(codigo), ...["VITORIA", "DERROTA", "ABRE", "FAVORAVEL", "APROVADO"].map((r) => sequenciaDoResultado(codigo, res(r, r === "DERROTA" ? 0 : 3)))];
  for (const seq of seqs) {
    if (!seq) continue;
    const d = new Diretor();
    d.tocar(seq, 0);
    for (let t = 0; t <= 40; t += 0.5) lugares.push(d.lugar("avatar", t, { x: 0, z: 0, giro: 0 }));
  }
  return lugares;
}

/** O que a lente não pode fazer nesta pose; devolve o motivo, ou null. */
function defeito(sala: Sala, s: Assunto, pose: Pose, perto: boolean): string | null {
  const lim = s.limites!;
  if (pose.pos[0] < lim.x[0] || pose.pos[0] > lim.x[1] || pose.pos[2] < lim.z[0] || pose.pos[2] > lim.z[1]) return "fora das paredes";
  if (pose.pos[1] < FOLGA_DA_LENTE) return "dentro do piso";
  if (pose.pos[1] > lim.teto) return "acima do teto";
  if (!perto && distanciaAoCorpo(pose.pos, s.pos) < FOLGA_DA_LENTE) return "dentro da avatar";
  for (const o of s.evita ?? []) if (distanciaAoCorpo(pose.pos, o.pos, o.altura) < FOLGA_DA_LENTE) return `dentro de uma pessoa de cena em ${o.pos}`;
  const movel = movelNaLente(sala, pose.pos, 0.1);
  if (movel) return `dentro do móvel ${movel}`;
  const e = elevacao(pose);
  if (e < LIMITES_DA_CAMERA.elevacaoMinima || e > LIMITES_DA_CAMERA.elevacaoMaxima) return `ângulo ${e.toFixed(0)}°`;
  if (distanciaDaMira(pose) > LIMITES_DA_CAMERA.distanciaMaxima) return "longe demais";
  return null;
}

describe("projeção da lente", () => {
  const pose: Pose = { pos: [0, 1, 4], alvo: [0, 1, 0], fov: 35 };
  it("o centro da mira cai no centro do quadro; o que está atrás da lente ou fora do ângulo não aparece", () => {
    expect(projetar(pose, [0, 1, 0], 1.5)).toMatchObject({ x: 0, y: 0, frente: 4 });
    expect(projetar(pose, [1, 1, 0], 1.5).x).toBeGreaterThan(0);
    expect(projetar(pose, [0, 2, 0], 1.5).y).toBeGreaterThan(0);
    expect(noQuadro(pose, [0, 1, 6], 1.5)).toBe(false);
    expect(noQuadro(pose, [3, 1, 0], 1.5)).toBe(false);
    expect(corpoInteiroNoQuadro({ ...pose, pos: [0, 1, 4.2] }, [0, 0, 0], 1.5)).toBe(true);
    expect(corpoInteiroNoQuadro({ ...pose, pos: [0, 1, 1.5] }, [0, 0, 0], 1.5)).toBe(false);
    expect(elevacao({ ...pose, pos: [0, 5, 4] })).toBeCloseTo(45, 5);
  });
});

describe.each(JOGOS)("%s", (codigo) => {
  const sala = salaDe(codigo);
  const pessoas = figurantesDaCena(sala, NUCLEOS[codigo].personagens);

  it("o enquadramento inicial mostra a avatar inteira, com respiro, e o que importa na rodada", () => {
    const s = assuntoDe(codigo);
    const preparo = cameraEmUso(codigo, null, "PREPARO");
    for (const aspecto of [PAISAGEM, 1.2, EM_PE]) {
      const pose = poseDoRig(preparo, s, 0, aspecto);
      expect(corpoInteiroNoQuadro(pose, s.pos, aspecto, 0.04), `aspecto ${aspecto.toFixed(2)}`).toBe(true);
      // a avatar ocupa uma boa parte da altura do quadro (não vira um ponto)
      const pes = projetar(pose, s.pos, aspecto).y;
      const cabeca = projetar(pose, [s.pos[0], s.pos[1] + 1.8, s.pos[2]], aspecto).y;
      expect(cabeca - pes, `aspecto ${aspecto.toFixed(2)}`).toBeGreaterThan(aspecto < 1 ? 0.45 : 0.9);
    }
    // quem divide a rodada com ela aparece inteiro no preparo e na ação, na tela deitada
    for (const momento of ["PREPARO", "ACAO"] as const) {
      const pose = poseDoRig(cameraEmUso(codigo, null, momento), s, 0, PAISAGEM);
      for (const p of interesseDaRodada(codigo, pessoas)) expect(corpoInteiroNoQuadro(pose, p, PAISAGEM), `${momento}: ${p}`).toBe(true);
    }
  });

  it("na ação e no resultado a câmera automática também mostra a avatar inteira, em qualquer instante", () => {
    const s = assuntoDe(codigo);
    for (const momento of ["ACAO", "RESULTADO"] as const) {
      const c = cameraEmUso(codigo, null, momento);
      if (c.rig === "CLOSE") continue;
      for (const aspecto of [PAISAGEM, EM_PE]) {
        for (let t = 0; t <= 30; t += 1) expect(corpoInteiroNoQuadro(poseDoRig(c, s, t, aspecto), s.pos, aspecto), `${momento} ${c.id} t=${t} aspecto ${aspecto.toFixed(2)}`).toBe(true);
      }
    }
  });

  it("pelo menos duas vistas com nome, além da automática, e a automática usa uma delas em cada momento", () => {
    const opcoes = opcoesDeCamera(codigo);
    expect(opcoes[0]).toBe("AUTO");
    expect(opcoes.length).toBeGreaterThanOrEqual(3);
    for (const id of opcoes) expect(textos[`flair3d.camera.${id}`], id).toBeTruthy();
    expect(new Set(opcoes).size).toBe(opcoes.length);
    for (const momento of ["PREPARO", "ACAO", "RESULTADO"] as const) expect(opcoes).toContain(cameraEmUso(codigo, null, momento).id);
    // as vistas são diferentes de verdade: nenhuma repete o lugar de outra
    const s = assuntoDe(codigo);
    const lugares = CAMERAS[codigo].cameras.map((c) => poseDoRig(c, s, 0, PAISAGEM).pos.map((n) => n.toFixed(1)).join());
    expect(new Set(lugares).size).toBe(lugares.length);
  });

  it("nenhuma câmera, em nenhum instante, zoom ou formato de tela, entra em corpo, móvel, piso ou parede, nem sai dos limites", () => {
    const salas = [sala, ...Object.values(VARIANTES[codigo] ?? {})];
    const caminho = caminhoDaAvatar(codigo);
    const achados = new Set<string>();
    for (const lugar of salas) {
      for (const c of CAMERAS[codigo].cameras) {
        for (const zoom of [-2, 0, 3]) {
          for (const aspecto of [PAISAGEM, EM_PE]) {
            for (const em of lugar === sala ? caminho : [caminho[0]]) {
              const s = assuntoDe(codigo, lugar, em);
              for (let t = 0; t <= 30; t += 1.5) {
                const motivo = defeito(lugar, s, poseDoRig(comZoom(c, zoom), s, t, aspecto), c.rig === "CLOSE" || zoom > 0);
                if (motivo) achados.add(`${c.id} zoom ${zoom}: ${motivo}`);
              }
            }
          }
        }
      }
    }
    expect([...achados]).toEqual([]);
  }, 60000);
});

describe("a lente não atravessa ninguém", () => {
  const s: Assunto = { pos: [0, 0, 0], limites: { x: [-4, 4], z: [-6, 6], teto: 6 }, evita: [{ pos: [3.2, 0.14, 0.7], altura: 1.8 }] };
  it("em cima de uma pessoa de cena a lente sai para o lado; encostada na parede, sobe acima da cabeça", () => {
    const livre = foraDosCorpos([3.0, 1.3, 0.7], s);
    expect(Math.hypot(livre[0] - 3.2, livre[2] - 0.7)).toBeCloseTo(RAIO_LIVRE, 5);
    expect(livre[1]).toBe(1.3);
    const naParede = foraDosCorpos([3.5, 1.3, 0.7], s);
    expect(naParede[1]).toBeGreaterThan(0.14 + 1.8);
    expect(foraDosCorpos([1, 1.3, 0.7], s)).toEqual([1, 1.3, 0.7]);
    // por cima da cabeça já está livre
    expect(foraDosCorpos([3.2, 2.4, 0.7], s)).toEqual([3.2, 2.4, 0.7]);
  });

  it("na troca da câmera da frente para a de trás a lente contorna a avatar (auditoria: colada no tronco no Rio)", () => {
    const frente: Pose = { pos: [0.4, 1.35, 4.2], alvo: [0, 1.1, 0], fov: 35 };
    const atras: Pose = { pos: [-0.4, 3.4, -3.6], alvo: [0, 0.7, 1.2], fov: 48 };
    let pose = frente;
    let menor = Infinity;
    for (let i = 0; i < 200; i++) {
      pose = aproximarEmVolta(pose, atras, fracaoDoQuadro(1 / 60), { pos: [0, 0, 0] });
      menor = Math.min(menor, Math.hypot(pose.pos[0], pose.pos[2]));
    }
    expect(menor).toBeGreaterThan(3.5);
    expect(pose.pos[2]).toBeCloseTo(atras.pos[2], 1);
    // a reta entre as duas passaria a menos de meio metro do corpo
    expect(Math.hypot(0.4 + (-0.8) * 0.54, 4.2 - 7.8 * 0.54)).toBeLessThan(0.5);
  });

  it("o tempo da troca é em segundos: a 60 quadros por segundo ou a 1, a lente chega no mesmo tempo de relógio", () => {
    expect(fracaoDoQuadro(1 / 60)).toBeCloseTo(0.12, 2);
    expect(fracaoDoQuadro(1)).toBeGreaterThan(0.99);
    expect(fracaoDoQuadro(0)).toBe(0);
    const meio = (dt: number) => {
      let resta = 1;
      for (let t = 0; t < 0.5 - 1e-9; t += dt) resta *= 1 - fracaoDoQuadro(dt);
      return resta;
    };
    expect(meio(1 / 60)).toBeCloseTo(meio(1 / 4), 5);
  });
});

describe("Fashion Sports: as câmeras do campo", () => {
  it.each(Object.keys(CAMPOS))("%s: quatro vistas com nome, todas acima do piso e fora dos jogadores", (modalidade) => {
    const campo = CAMPOS[modalidade as keyof typeof CAMPOS];
    expect(CAMERAS_DO_CAMPO.length).toBeGreaterThanOrEqual(3);
    for (const id of CAMERAS_DO_CAMPO) expect(textos[`flair3d.camera.${id}`], id).toBeTruthy();
    for (const bola of [[50, 30], [5, 5], [95, 55]] as [number, number][]) {
      for (const aspecto of [PAISAGEM, EM_PE]) {
        for (const id of CAMERAS_DO_CAMPO.slice(1)) {
          for (const t of [0, 7, 19]) {
            const pose = poseEscolhida(id, campo, bola, t, aspecto)!;
            expect(pose.pos[1], `${id}`).toBeGreaterThan(2);
            // fora do retângulo de jogo, ou bem acima da cabeça dos jogadores
            const fora = Math.abs(pose.pos[0]) > campo.comprimento / 2 || Math.abs(pose.pos[2]) > campo.largura / 2;
            expect(fora || pose.pos[1] > 4, `${id} em ${pose.pos}`).toBe(true);
          }
        }
        for (const plano of ["geral", "transmissao", "lance", "replay"] as const) {
          const pose = poseDaCamera(plano, campo, bola, bola, aspecto);
          expect(pose.pos[1], plano).toBeGreaterThan(2);
        }
      }
    }
  });

  it("no replay o jogador da carta aparece inteiro, e a lente fica a mais de 4 m dele", () => {
    const campo = CAMPOS.FUTEBOL;
    const pose = { ...poseDaCamera("replay", campo, [70, 30], [70, 30]), fov: 32 };
    const pes: V3 = [pose.alvo[0], 0, pose.alvo[2]];
    expect(corpoInteiroNoQuadro(pose, pes, PAISAGEM)).toBe(true);
    expect(Math.hypot(pose.pos[0] - pes[0], pose.pos[2] - pes[2])).toBeGreaterThan(4);
  });
});
