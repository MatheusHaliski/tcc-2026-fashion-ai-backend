import { describe, expect, it } from "vitest";
import { CAMERAS_DO_CAMPO, poseEscolhida } from "@/lib/flair/esporte/camera";
import { CAMPOS } from "@/lib/flair/esporte/campo";
import { CAMERA_AUTOMATICA, CAMERAS, cameraEmUso, camerasDe, opcoesDeCamera, proximaCamera } from "@/lib/flair/nucleos/camera/jogos";
import { afastadaDoCorpo, andaSozinha, aproximar, dentroDoLugar, DISTANCIA_MINIMA, poseDoRig, recuada, RIGS, type Assunto, type Camera } from "@/lib/flair/nucleos/camera/rigs";
import { comZoom, DIST_MINIMA, limitesDaSala, MIRA_NO_ROSTO, momentoDaCamera } from "@/lib/flair/nucleos/camera/sala";
import { SALAS, salaDe } from "@/lib/flair/nucleos/scene/registry";
import { NUCLEO_CODIGOS } from "@/lib/flair/nucleos/types";
import messages from "@/lib/i18n/messages/pt-BR.json";

/**
 * Câmeras dos jogos (pedido da dona de 15/11/2026): nenhum jogo fica com a câmera frontal chapada; cada um tem um
 * conjunto com a câmera do preparo, a da ação e a do resultado; os rigs põem a câmera onde dizem e nunca atravessam a
 * parede; e todo nome de câmera tem texto.
 */
const AVATAR: Assunto = { pos: [0, 0, 0], giro: 0 };
const cam = (over: Partial<Camera>): Camera => ({ id: "X", rig: "ORBITAL", dist: 4, altura: 1.4, ...over });
const horizontal = (p: { pos: number[]; alvo: number[] }) => Math.hypot(p.pos[0] - p.alvo[0], p.pos[2] - p.alvo[2]);

describe("rigs", () => {
  it("orbital gira em volta do assunto na distância pedida; parada, fica no ângulo de partida", () => {
    const c = cam({ velocidade: 90, angulo: 0 });
    const t0 = poseDoRig(c, AVATAR, 0);
    expect(t0.pos[0]).toBeCloseTo(0, 5);
    expect(t0.pos[2]).toBeCloseTo(4, 5);
    const t1 = poseDoRig(c, AVATAR, 1);
    expect(t1.pos[0]).toBeCloseTo(4, 5);
    expect(t1.pos[2]).toBeCloseTo(0, 5);
    expect(horizontal(t1)).toBeCloseTo(4, 5);
    expect(poseDoRig(c, AVATAR, 1, 1.5, true).pos).toEqual(t0.pos);
    expect(andaSozinha(c)).toBe(true);
    expect(andaSozinha(cam({}))).toBe(false);
  });

  it("segue fica atrás de quem anda e olha para a frente dele, para qualquer lado que ele vire", () => {
    const c = cam({ rig: "SEGUE", dist: 3, altura: 2 });
    const paraFrente = poseDoRig(c, { pos: [1, 0, 1], giro: 0 }, 0);
    expect(paraFrente.pos[2]).toBeCloseTo(-2, 5);
    expect(paraFrente.alvo[2]).toBeGreaterThan(1);
    const paraDireita = poseDoRig(c, { pos: [1, 0, 1], giro: 90 }, 0);
    expect(paraDireita.pos[0]).toBeCloseTo(-2, 5);
    expect(paraDireita.alvo[0]).toBeGreaterThan(1);
    expect(paraDireita.pos[1]).toBe(2);
  });

  it("trilho vai e volta entre dois ângulos; grua sobe e desce; lateral fica de lado; aérea olha de cima", () => {
    const trilho = cam({ rig: "TRILHO", angulo: -40, ate: 40, velocidade: 0.5 });
    expect(poseDoRig(trilho, AVATAR, 0).pos[0]).toBeLessThan(0);
    expect(poseDoRig(trilho, AVATAR, 1).pos[0]).toBeGreaterThan(0);
    expect(poseDoRig(trilho, AVATAR, 2).pos[0]).toBeCloseTo(poseDoRig(trilho, AVATAR, 0).pos[0], 5);
    const grua = cam({ rig: "GRUA", altura: 1.2, ate: 4, velocidade: 0.5 });
    expect(poseDoRig(grua, AVATAR, 0).pos[1]).toBeCloseTo(1.2, 5);
    expect(poseDoRig(grua, AVATAR, 1).pos[1]).toBeCloseTo(4, 5);
    const lateral = poseDoRig(cam({ rig: "LATERAL", dist: 5 }), AVATAR, 0);
    expect(lateral.pos[0]).toBeCloseTo(5, 5);
    expect(Math.abs(lateral.pos[2])).toBeLessThan(1e-6);
    const aerea = poseDoRig(cam({ rig: "AEREA", altura: 8, dist: 0.5 }), AVATAR, 0);
    expect(aerea.pos[1]).toBe(8);
    expect(aerea.alvo[1]).toBe(0);
    expect(horizontal(aerea)).toBeLessThan(1);
  });

  it("transmissão acompanha o assunto do alto da lateral, presa ao centro do lugar", () => {
    const c = cam({ rig: "TRANSMISSAO", dist: 20, altura: 12, acompanha: 0.5, mira: 0 });
    const pose = poseDoRig(c, { pos: [10, 0, 4], centro: [0, 0, 0] }, 0);
    expect(pose.pos).toEqual([5, 12, 20]);
    expect(pose.alvo[0]).toBeGreaterThan(5);
  });

  it("a câmera nunca sai das paredes nem do teto; em tela em pé recua; o close não recua", () => {
    const limites = { x: [-3, 3] as [number, number], z: [-4, 5] as [number, number], teto: 3 };
    for (const rig of RIGS) {
      for (const t of [0, 3, 7.5]) {
        const p = poseDoRig(cam({ rig, dist: 9, altura: 6, ate: 9, velocidade: 0.3 }), { ...AVATAR, limites }, t, 0.5);
        expect(p.pos[0]).toBeGreaterThanOrEqual(-3);
        expect(p.pos[0]).toBeLessThanOrEqual(3);
        expect(p.pos[2]).toBeLessThanOrEqual(5);
        expect(p.pos[1]).toBeLessThan(3);
      }
    }
    expect(dentroDoLugar([9, 9, 9], undefined)).toEqual([9, 9, 9]);
    expect(recuada([0, 1, 4], [0, 1, 0], 1.5)).toEqual([0, 1, 4]);
    expect(recuada([0, 1, 4], [0, 1, 0], 0.75)[2]).toBeCloseTo(8, 5);
    const close = cam({ rig: "CLOSE", dist: 2 });
    expect(poseDoRig(close, AVATAR, 0, 0.5).pos).toEqual(poseDoRig(close, AVATAR, 0, 2).pos);
    const meio = aproximar(poseDoRig(cam({}), AVATAR, 0), poseDoRig(cam({ dist: 8 }), AVATAR, 0), 0.5);
    expect(meio.pos[2]).toBeCloseTo(6, 5);
  });
});

describe("câmeras de cada jogo", () => {
  it("os 15 jogos têm conjunto próprio: preparo em três quartos, ação e resultado com câmera do gênero, e nenhuma frontal chapada", () => {
    expect(Object.keys(CAMERAS).sort()).toEqual([...NUCLEO_CODIGOS].sort());
    for (const codigo of NUCLEO_CODIGOS) {
      const { cameras, momento } = camerasDe(codigo);
      expect(cameras.length, codigo).toBeGreaterThanOrEqual(4);
      expect(new Set(cameras.map((c) => c.id)).size, codigo).toBe(cameras.length);
      for (const id of Object.values(momento)) expect(cameras.some((c) => c.id === id), `${codigo}:${id}`).toBe(true);
      expect(momento.ACAO, codigo).not.toBe(momento.PREPARO);
      // frontal chapada = de frente (ângulo 0), parada, na altura do corpo: nenhuma câmera de preparo ou de ação é assim
      for (const id of [momento.PREPARO, momento.ACAO]) {
        const c = cameras.find((x) => x.id === id) as Camera;
        const chapada = (c.rig === "ORBITAL" || c.rig === "CLOSE") && !c.velocidade && Math.abs(c.angulo ?? 0) < 5 && c.altura > 0.8 && c.altura < 2.2;
        expect(chapada, `${codigo}:${id}`).toBe(false);
      }
      // o preparo mostra o corpo inteiro: longe o bastante para 1,8 m caberem no quadro
      const preparo = poseDoRig(cameraEmUso(codigo, null, "PREPARO"), AVATAR, 0);
      expect(horizontal(preparo), codigo).toBeGreaterThan(1.8 / (2 * Math.tan((preparo.fov / 2) * (Math.PI / 180))));
    }
    expect(camerasDe("DRESS_FIGHTER").momento.ACAO).toBe("LATERAL");
    expect(camerasDe("FASHION_DETECTIVE").momento.ACAO).toBe("EXPLORACAO");
    expect(camerasDe("PASSARELA").momento.ACAO).toBe("TRAVELLING");
  });

  it("a automática segue o momento; a escolha da pessoa vale em qualquer momento; escolha estranha cai na automática", () => {
    expect(cameraEmUso("PASSARELA", CAMERA_AUTOMATICA, "ACAO").id).toBe("TRAVELLING");
    expect(cameraEmUso("PASSARELA", null, "RESULTADO").id).toBe("GRUA");
    expect(cameraEmUso("PASSARELA", "FOSSO", "PREPARO").id).toBe("FOSSO");
    expect(cameraEmUso("PASSARELA", "EXPLORACAO", "PREPARO").id).toBe("TRES_QUARTOS");
    const opcoes = opcoesDeCamera("PASSARELA");
    expect(opcoes[0]).toBe(CAMERA_AUTOMATICA);
    expect(proximaCamera(opcoes, CAMERA_AUTOMATICA)).toBe("TRES_QUARTOS");
    expect(proximaCamera(opcoes, opcoes[opcoes.length - 1])).toBe(CAMERA_AUTOMATICA);
    expect(proximaCamera(opcoes, null)).toBe("TRES_QUARTOS");
  });

  it("toda câmera de todo jogo e do campo tem nome em texto", () => {
    const ids = new Set<string>([CAMERA_AUTOMATICA, ...CAMERAS_DO_CAMPO]);
    for (const codigo of NUCLEO_CODIGOS) camerasDe(codigo).cameras.forEach((c) => ids.add(c.id));
    for (const id of ids) expect((messages as Record<string, string>)[`flair3d.camera.${id}`], id).toBeTruthy();
  });
});

describe("câmera dentro da sala", () => {
  it("o zoom aproxima qualquer câmera e sobe a mira até o rosto; as paredes limitam; deck e preparação são o preparo", () => {
    const base = cam({ dist: 4.2, altura: 1.35, mira: 1.1 });
    expect(comZoom(base, 0)).toBe(base);
    const perto = comZoom(base, 3);
    expect(perto.dist).toBeLessThan(2);
    expect(perto.mira).toBeCloseTo(1.46, 5);
    expect(comZoom(base, 9).dist).toBe(DIST_MINIMA);
    expect(comZoom(base, 9).mira).toBe(MIRA_NO_ROSTO);
    expect(comZoom(base, -2).dist).toBeGreaterThan(4.2);
    const alta = comZoom(cam({ dist: 5.2, altura: 5.4, mira: 0.6 }), 9);
    expect(alta.altura).toBeLessThan(3);
    const lim = limitesDaSala(SALAS.PASSARELA);
    expect(lim.x[0]).toBe(-SALAS.PASSARELA.dim.largura / 2);
    expect(lim.z[0]).toBe(-SALAS.PASSARELA.dim.fundo);
    expect(lim.z[1]).toBeLessThanOrEqual(SALAS.PASSARELA.dim.frente);
    expect(momentoDaCamera("DECK")).toBe("PREPARO");
    expect(momentoDaCamera("PREPARACAO")).toBe("PREPARO");
    expect(momentoDaCamera("ACAO")).toBe("ACAO");
    expect(momentoDaCamera("RESULTADO")).toBe("RESULTADO");
  });

  it("quando a parede empurra a lente para perto do corpo, ela sobe em vez de entrar nele (auditoria: fim da luta, calçada do Rio)", () => {
    const limites = { x: [-3, 3] as [number, number], z: [-3, 0.6] as [number, number], teto: 8 };
    const segue = cam({ rig: "SEGUE", dist: 3.6, altura: 1.2, mira: 1.1 });
    const pose = poseDoRig(segue, { pos: [0, 0, 0], giro: 180, limites }, 0);
    const longe = Math.hypot(pose.pos[0], pose.pos[1] - 1.1, pose.pos[2]);
    expect(longe).toBeGreaterThanOrEqual(DISTANCIA_MINIMA - 1e-6);
    expect(afastadaDoCorpo([0, 1, 3], { pos: [0, 0, 0] }, 1.1)).toEqual([0, 1, 3]);
    // o zoom de propósito continua perto
    expect(poseDoRig(cam({ dist: 0.6, altura: 1.5, mira: 1.5 }), { pos: [0, 0, 0] }, 0).pos[1]).toBeCloseTo(1.5, 5);
  });

  it("em toda sala a câmera do preparo fica dentro das paredes e vê o avatar de corpo inteiro", () => {
    for (const codigo of NUCLEO_CODIGOS) {
      const sala = salaDe(codigo);
      const pose = poseDoRig(cameraEmUso(codigo, null, "PREPARO"), { pos: [0, sala.zonas.avatar.altura, 0], limites: limitesDaSala(sala) }, 0);
      expect(Math.abs(pose.pos[0]), codigo).toBeLessThan(sala.dim.largura / 2);
      expect(horizontal(pose), codigo).toBeGreaterThan(2.9);
    }
  });
});

describe("câmeras do campo do Fashion Sports", () => {
  const campo = CAMPOS.FUTEBOL;
  it("a automática não tem pose fixa; as outras ficam fora do gramado, acima dele, olhando para dentro", () => {
    expect(poseEscolhida(CAMERA_AUTOMATICA, campo, [50, 30], 0)).toBeNull();
    expect(poseEscolhida("NAO_EXISTE", campo, [50, 30], 0)).toBeNull();
    for (const id of CAMERAS_DO_CAMPO.slice(1)) {
      const pose = poseEscolhida(id, campo, [80, 20], 3);
      expect(pose, id).not.toBeNull();
      expect(pose!.pos[1], id).toBeGreaterThan(1.5);
      expect(Math.abs(pose!.alvo[0]), id).toBeLessThanOrEqual(campo.comprimento / 2);
    }
    const lateral = poseEscolhida("LATERAL", campo, [80, 20], 0)!;
    expect(lateral.pos[2]).toBeGreaterThan(campo.largura / 2);
    expect(lateral.pos[0]).toBeCloseTo(12, 5);
    expect(poseEscolhida("AEREA", campo, [10, 10], 0)).toEqual(poseEscolhida("AEREA", campo, [90, 50], 0));
    expect(poseEscolhida("ATRAS_DO_GOL", campo, [50, 30], 0)!.pos[0]).toBeLessThan(-campo.comprimento / 2);
    expect(poseEscolhida("ORBITAL_360", campo, [50, 30], 0)!.pos).not.toEqual(poseEscolhida("ORBITAL_360", campo, [50, 30], 5)!.pos);
    expect(poseEscolhida("ORBITAL_360", campo, [50, 30], 5, 1.5, true)).toEqual(poseEscolhida("ORBITAL_360", campo, [50, 30], 0, 1.5, true));
  });
});
