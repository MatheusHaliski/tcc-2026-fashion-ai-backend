// @vitest-environment jsdom
/**
 * ACERVO · Meu espaço. No jsdom não há WebGL: a tela cai no esquema 2D, com as mesmas interações. A cena 3D é montada
 * à parte no renderizador de teste (sem GPU) para conferir as partes do móvel, as peças, o Raio-X e a gaveta aberta.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useThree } from "@react-three/fiber";
import { I18nProvider } from "@/lib/i18n/i18n";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { ARMARIO_1, ARMARIO_2, ARVORE, rotasDoAcervo } from "@/test-utils/acervo";
import { frames, meshes, mount3d, ReactThreeTestRenderer } from "@/test-utils/three";
import { AcervoApp } from "../acervo-app";
import { CenaConteudo } from "./cena-conteudo";
import type { CenaProps } from "./cena-tipos";

// as fotos são carregadas pelo navegador; aqui a peça com foto recebe direto uma textura
const FOTO = vi.hoisted(() => ({ textura: null as unknown }));
vi.mock("./use-foto-da-peca", () => ({ useFotoDaPeca: (url?: string | null) => (url ? FOTO.textura : null) }));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const texto = (el: Element | null) => (el?.textContent ?? "").replace(/ /g, " ");
const celula = (id: string) => document.querySelector(`.acv-palco [data-compartimento="${id}"]`) as HTMLElement;

async function abrirEspaco(rotas: Record<string, unknown> = {}) {
  const api = loggedAs(undefined, rotasDoAcervo(rotas));
  renderApp(<AcervoApp />);
  fireEvent.click(await screen.findByRole("button", { name: "Gaveta 01 de Armário 01, 2 peças" }));
  await screen.findByTestId("acervo-cena-2d");
  return api;
}

function arrasto(ids: string[]) {
  const dados = new Map([["application/x-acervo-pecas", JSON.stringify(ids)]]);
  return { dataTransfer: { getData: (k: string) => dados.get(k) ?? "", setData: () => undefined, types: [...dados.keys()], effectAllowed: "move", dropEffect: "move" } };
}

describe("ACERVO · Meu espaço (esquema 2D, sem WebGL)", () => {
  it("clicar no mapa abre a view no compartimento, com o conteúdo dele ampliado", async () => {
    await abrirEspaco();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Meu espaço");
    expect(screen.getByText("Vista em 2D: este aparelho não mostra a cena em 3D.")).toBeTruthy();
    expect(celula("c-gav1").className).toContain("is-atual");
    const expandida = screen.getByTestId("acervo-expandida");
    expect(expandida.getAttribute("aria-label")).toBe("Conteúdo de Gaveta 01");
    expect(texto(expandida)).toContain("2 peças");
    expect(within(expandida).getByRole("button", { name: "Abrir a ficha de Camiseta básica" })).toBeTruthy();
    expect(within(expandida).getByRole("button", { name: "Abrir a ficha de Camiseta oversized" })).toBeTruthy();
    expect(within(expandida).queryByRole("button", { name: "Abrir a ficha de Jaqueta de couro" })).toBeNull();
  });

  it("Raio-X deixa ver por trás das portas e “Abrir gavetas” mostra o que há nelas", async () => {
    await abrirEspaco();
    expect(celula("c2-cab").className).toContain("is-porta");
    expect(celula("c-gav2").querySelectorAll(".acv-mini")).toHaveLength(0);
    expect(celula("c-gav1").querySelectorAll(".acv-mini")).toHaveLength(0);
    const raioX = screen.getByRole("button", { name: "Raio-X" });
    expect(raioX.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(raioX);
    expect(raioX.getAttribute("aria-pressed")).toBe("true");
    expect(celula("c2-cab").className).not.toContain("is-porta");
    fireEvent.click(screen.getByRole("button", { name: "Abrir gavetas" }));
    expect(celula("c-gav1").querySelectorAll(".acv-mini")).toHaveLength(2);
    expect(celula("c-cab").querySelectorAll(".acv-mini")).toHaveLength(1);
  });

  it("arrastar uma peça da gaveta expandida para outro compartimento grava o novo lugar", async () => {
    const { calls } = await abrirEspaco({ "POST /api/me/acervo/pecas/mover": { movidas: 1, compartimentoId: "c-pra" } });
    fireEvent.drop(within(celula("c-pra")).getByRole("button", { name: /^Prateleira 1 de Armário 01/ }), arrasto(["p2"]));
    await waitFor(() => expect(calls.find((c) => c.path === "/api/me/acervo/pecas/mover")?.body).toEqual({ pieceIds: ["p2"], compartimentoId: "c-pra" }));
    await waitFor(() => expect(texto(screen.getByTestId("acervo-expandida"))).toContain("1 peça"));
    expect(screen.getByText("Peça movida.")).toBeTruthy();
  });

  it("o painel de configuração grava medidas, quantidade de gavetas, material e puxador", async () => {
    const { calls } = await abrirEspaco({ "PUT /api/me/acervo/moveis/m1": ARMARIO_1 });
    const painel = screen.getByRole("region", { name: "Configuração de Armário 01" });
    expect(texto(painel)).toContain("2 armários · 2 gavetas");
    expect(texto(painel)).toContain("Cor · Nogueira");
    expect(texto(painel)).toContain("Puxador · Latão escovado");
    const largura = within(painel).getByLabelText("Largura (cm)") as HTMLInputElement;
    expect(largura.value).toBe("120");
    fireEvent.change(largura, { target: { value: "999" } });
    expect(within(painel).getByText("Use um número inteiro de 40 a 400.")).toBeTruthy();
    fireEvent.blur(largura);
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
    fireEvent.change(largura, { target: { value: "240" } });
    fireEvent.blur(largura);
    await waitFor(() => expect(calls.find((c) => c.method === "PUT" && c.path === "/api/me/acervo/moveis/m1")?.body).toEqual({ larguraCm: 240 }));
    fireEvent.click(within(painel).getByLabelText("Gavetas"));
    fireEvent.click(await screen.findByRole("option", { name: "4" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT" && JSON.stringify(c.body) === JSON.stringify({ gavetas: 4 }))).toBe(true));
    fireEvent.click(within(painel).getByLabelText("Material"));
    fireEvent.click(await screen.findByRole("option", { name: "Laca" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT" && JSON.stringify(c.body) === JSON.stringify({ material: "LACA" }))).toBe(true));
  });

  it("Dream Space: começa vazio, mostra o orçamento estimado dos desejos e cresce com um módulo novo", async () => {
    const { calls } = await abrirEspaco({ "POST /api/me/acervo/ambientes/a1/moveis": { id: "m3" } });
    fireEvent.click(screen.getByRole("radio", { name: "Dream Space" }));
    expect(await screen.findByText("Seu Dream Space está vazio.")).toBeTruthy();
    const painel = screen.getByRole("region", { name: "Projeto Dream Space" });
    expect(within(painel).getByText("Conceito")).toBeTruthy();
    expect(texto(screen.getByTestId("acervo-dream-orcamento"))).toBe("R$ 480,00");
    expect(within(painel).getByText("Estimado")).toBeTruthy();
    fireEvent.click(within(painel).getByRole("button", { name: "Adicionar módulo" }));
    await waitFor(() => expect(calls.find((c) => c.path === "/api/me/acervo/ambientes/a1/moveis")?.body)
      .toMatchObject({ nome: "Módulo 1", modo: "DREAM_SPACE", material: "VIDRO", porta: "VIDRO" }));
  });

  it("a simulação de compra põe a peça desejada como fantasma no compartimento escolhido", async () => {
    await abrirEspaco();
    fireEvent.click(screen.getByRole("radio", { name: "Dream Space" }));
    fireEvent.click(within(screen.getByRole("region", { name: "Projeto Dream Space" })).getByRole("switch", { name: "Bota de couro" }));
    fireEvent.click(screen.getByRole("radio", { name: "Meu espaço" }));
    await screen.findByTestId("acervo-cena-2d");
    expect(within(celula("c-pra")).getByRole("img", { name: "Bota de couro (simulação de compra)" })).toBeTruthy();
    expect(celula("c-cab").querySelector(".is-fantasma")).toBeNull();
  });
});

describe("ACERVO · cena 3D (renderizador de teste)", () => {
  const base: CenaProps = {
    moveis: [ARMARIO_1, ARMARIO_2],
    itensDe: (id) => ARVORE.pecas.filter((p) => p.compartimentoId === id).map((p) => ({ id: p.id, categoria: p.category, cor: "#335577" })),
    selecionado: null,
    acesos: new Set(),
    parados: new Set(),
    marcadores: new Map(),
    raioX: false,
    gavetasAbertas: false,
    vista: "PERSPECTIVA",
    reduzido: true,
    rotulo: "cena",
    onEscolher: () => undefined,
    onSoltar: () => undefined,
    onPeca: () => undefined,
  };
  const material = (m: { instance: THREE.Object3D }) => (m.instance as THREE.Mesh).material as THREE.MeshStandardMaterial;

  it("monta os dois móveis com carcaça, cabideiros, gavetas, portas, puxadores e as peças no lugar", async () => {
    const cena = await mount3d(<CenaConteudo {...base} rotulos={false} />);
    await frames(cena);
    const nomes = meshes(cena).map((m) => m.instance.name);
    expect(nomes.filter((n) => n === "lado-esq")).toHaveLength(2);
    expect(nomes).toEqual(expect.arrayContaining(["cabideiro-c-cab", "gaveta-c-gav1", "gaveta-c-gav2", "puxador-c-gav1", "porta-0", "piso", "tapete", "pufe"]));
    expect(nomes.filter((n) => n.startsWith("alvo-"))).toHaveLength(5);
    expect(nomes.filter((n) => n.startsWith("roupa-")).sort()).toEqual(["roupa-p1", "roupa-p2", "roupa-p3"]);
    expect(material(meshes(cena).find((m) => m.instance.name === "roupa-p1")!).color.getHexString()).toBe("335577");
    expect(material(meshes(cena).find((m) => m.instance.name === "lado-esq")!).roughness).toBeCloseTo(0.62);
    expect(material(meshes(cena).find((m) => m.instance.name === "porta-0")!).opacity).toBe(1);
  });

  it("Raio-X deixa as portas transparentes; a busca acende o compartimento; a gaveta escolhida sai do móvel", async () => {
    const cena = await mount3d(<CenaConteudo {...base} rotulos={false} raioX acesos={new Set(["c-cab"])} selecionado="c-gav1"
      itensDe={(id) => (id === "c-pra" ? [{ id: "d1", categoria: "shoes_piece", cor: "#DDF247", fantasma: true }] : base.itensDe(id))} />);
    await frames(cena);
    const malha = (nome: string) => meshes(cena).find((m) => m.instance.name === nome)!;
    expect(material(malha("porta-0")).opacity).toBeCloseTo(0.12);
    expect(material(malha("porta-0")).transparent).toBe(true);
    expect(material(malha("alvo-c-cab")).opacity).toBeGreaterThan(0.3);
    expect(material(malha("alvo-c-pra")).opacity).toBe(0);
    expect(malha("gaveta-c-gav1").instance.parent?.position.z).toBeCloseTo(0.42);
    expect(malha("gaveta-c-gav2").instance.parent?.position.z).toBe(0);
    expect(material(malha("fantasma-d1")).opacity).toBeLessThan(1);
  });

  it("Raio-X num móvel sem porta deixa ver dentro das gavetas fechadas (auditoria 10.3, ACERVO item 4)", async () => {
    const sem = await mount3d(<CenaConteudo {...base} moveis={[ARMARIO_1]} rotulos={false} />);
    await frames(sem);
    expect(material(meshes(sem).find((m) => m.instance.name === "gaveta-c-gav1")!).opacity).toBe(1);
    const com = await mount3d(<CenaConteudo {...base} moveis={[ARMARIO_1]} rotulos={false} raioX />);
    await frames(com);
    const frente = material(meshes(com).find((m) => m.instance.name === "gaveta-c-gav1")!);
    expect(frente.transparent).toBe(true);
    expect(frente.opacity).toBeLessThan(0.3);
  });

  it("a gaveta com a peça simulada abre sozinha: a simulação aparece na cena", async () => {
    const cena = await mount3d(<CenaConteudo {...base} moveis={[ARMARIO_1]} rotulos={false}
      itensDe={(id) => (id === "c-gav2" ? [{ id: "d1", categoria: "upper_piece", cor: "#DDF247", fantasma: true }] : base.itensDe(id))} />);
    await frames(cena);
    const malha = (nome: string) => meshes(cena).find((m) => m.instance.name === nome)!;
    expect(malha("gaveta-c-gav2").instance.parent?.position.z).toBeCloseTo(0.42);
    expect(malha("gaveta-c-gav1").instance.parent?.position.z).toBe(0);
  });

  it("a câmera gira pelos botões (alternativa ao arrasto) até o limite e Frontal/Perspectiva voltam ao quadro pronto", async () => {
    const vista: { camera: THREE.Camera | null; controles: { enabled: boolean; target: THREE.Vector3 } | null } = { camera: null, controles: null };
    function Espia() {
      const estado = useThree();
      vista.camera = estado.camera;
      vista.controles = estado.controls as unknown as { enabled: boolean; target: THREE.Vector3 };
      return null;
    }
    const cena = (comando?: { vez: number; giro: number }) => (
      <I18nProvider initial="pt-BR"><CenaConteudo {...base} rotulos={false} comandoDeCamera={comando} /><Espia /></I18nProvider>
    );
    const r = await mount3d(cena());
    await frames(r);
    const alvo = vista.controles!.target;
    const azimute = (p = vista.camera!.position) => Math.atan2(p.x - alvo.x, p.z - alvo.z);
    const inicio = vista.camera!.position.clone();
    expect(vista.controles?.enabled).toBe(true);
    await ReactThreeTestRenderer.act(async () => r.update(cena({ vez: 1, giro: 15 })));
    await frames(r);
    expect(azimute() - azimute(inicio)).toBeCloseTo((15 * Math.PI) / 180, 2);
    for (let vez = 2; vez < 10; vez++) {
      await ReactThreeTestRenderer.act(async () => r.update(cena({ vez, giro: 15 })));
      await frames(r);
    }
    expect(azimute()).toBeCloseTo((55 * Math.PI) / 180, 2);
    await ReactThreeTestRenderer.act(async () => r.update(cena({ vez: 10, giro: 0 })));
    await frames(r);
    expect(vista.camera!.position.distanceTo(inicio)).toBeLessThan(0.01);
    // segurar uma peça para arrastar não gira a câmera; soltar devolve o giro
    await r.fireEvent(meshes(r).find((m) => m.instance.name === "roupa-p1")!, "onPointerDown");
    expect(vista.controles?.enabled).toBe(false);
    await ReactThreeTestRenderer.act(async () => {
      window.dispatchEvent(new Event("pointerup"));
      await new Promise((fim) => setTimeout(fim, 5));
    });
    expect(vista.controles?.enabled).toBe(true);
  });

  it("a peça com foto tem a silhueta da foto (não um bloco com a foto); dobrada sem foto é um bloco macio na cor", async () => {
    const foto = new THREE.Texture();
    foto.userData.recorte = { removido: 0.45, caixa: [0.2, 0.05, 0.8, 0.95] };
    FOTO.textura = foto;
    const cena = await mount3d(<CenaConteudo {...base} moveis={[ARMARIO_1]} rotulos={false} gavetasAbertas
      itensDe={(id) => base.itensDe(id).map((item) => (item.id === "p1" || item.id === "p2" ? { ...item, foto: `/fotos/${item.id}.webp` } : item))} />);
    await frames(cena);
    const malha = (nome: string) => meshes(cena).find((m) => m.instance.name === nome)?.instance as THREE.Mesh;
    // pendurada: um painel recortado (alphaTest) com só o trecho da peça na textura, no cabide — não uma caixa
    const pendurada = malha("roupa-p1");
    const mat = pendurada.material as THREE.MeshStandardMaterial;
    expect(mat.map).toBe(foto);
    expect(mat.alphaTest).toBeCloseTo(0.5);
    expect(pendurada.geometry).toBeInstanceOf(THREE.PlaneGeometry);
    expect(Array.from(pendurada.geometry.getAttribute("uv").array).map((v) => +v.toFixed(2))).toEqual([0.2, 0.95, 0.8, 0.95, 0.2, 0.05, 0.8, 0.05]);
    expect(meshes(cena).some((m) => m.instance.parent?.name === "cabide-p1")).toBe(true);
    // dobrada: bloco macio na cor, com o miolo da peça (o tecido) por cima
    expect((malha("roupa-p2").material as THREE.MeshStandardMaterial).map).toBeNull();
    expect((malha("tecido-p2").material as THREE.MeshStandardMaterial).map?.source).toBe(foto.source);
    // dobrada sem foto (p3, na gaveta): o bloco macio de bordas arredondadas, só na cor e sem tecido por cima
    const semFoto = malha("roupa-p3");
    expect(semFoto.geometry).toBeInstanceOf(RoundedBoxGeometry);
    expect(malha("tecido-p3")).toBeUndefined();
    expect((semFoto.material as THREE.MeshStandardMaterial).map).toBeNull();
    expect((semFoto.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("335577");
    FOTO.textura = null;
  });

  it("foto cujo fundo não saiu não vira bloco nem painel: a peça fica com a silhueta da categoria", async () => {
    const foto = new THREE.Texture();
    foto.userData.recorte = { removido: 0.01, caixa: [0, 0, 1, 1] };
    FOTO.textura = foto;
    const cena = await mount3d(<CenaConteudo {...base} moveis={[ARMARIO_1]} rotulos={false}
      itensDe={(id) => base.itensDe(id).map((item) => ({ ...item, foto: `/fotos/${item.id}.webp` }))} />);
    await frames(cena);
    const p1 = meshes(cena).find((m) => m.instance.name === "roupa-p1")!.instance as THREE.Mesh;
    expect(p1.geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect((p1.material as THREE.MeshStandardMaterial).map).toBeNull();
    FOTO.textura = null;
  });
});
