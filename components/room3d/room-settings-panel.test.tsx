// @vitest-environment jsdom
/**
 * Configurações do Meu Quarto: luz, roupa e móvel no alto; câmera e pontos de vista, vistas favoritas, paredes,
 * ambiente, gráficos, interface, foto/visitas e acessibilidade. Cada controle manda a mudança certa para a página.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, renderApp, screen } from "@/test-utils/render";
import { RoomSettingsPanel, type RoomSettingsPanelProps } from "./room-settings-panel";
import { DEFAULT_ROOM_SETTINGS, type RoomSettings } from "@/lib/room3d/room-settings";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const SAVED = { position: [1, 2, 3] as [number, number, number], target: [0, 1, 0] as [number, number, number] };

function setup(over: Partial<RoomSettingsPanelProps> = {}, settings: Partial<RoomSettings> = {}) {
  const props: RoomSettingsPanelProps = {
    settings: { ...DEFAULT_ROOM_SETTINGS, ...settings }, onChange: vi.fn(), gl: true, walking: true, onWalking: vi.fn(),
    light: { on: true, busy: false, intensity: 0.42, onToggle: vi.fn(), onDim: vi.fn() },
    outfit: { names: [], onChange: vi.fn(), onVistaMe: vi.fn() },
    onFurniture: vi.fn(), onPhoto: vi.fn(), onKeys: vi.fn(), onSaveFavorite: vi.fn(), onRecallFavorite: vi.fn(), onClearFavorite: vi.fn(),
    ...over,
  };
  renderApp(<RoomSettingsPanel {...props} />);
  return props;
}
const radio = (name: string) => screen.getByRole("radio", { name });
const toggle = (name: string) => screen.getByRole("switch", { name });
const range = (name: string) => screen.getByRole("slider", { name });
/** escolhe na lista (Select) que está dentro do rótulo com este texto */
function pick(label: string, option: string) {
  const field = screen.getByText(label, { selector: "span" }).closest("label") as HTMLElement;
  fireEvent.click(field.querySelector("button")!);
  fireEvent.click(screen.getByRole("option", { name: option }));
}

describe("configurações do quarto — atalhos do alto", () => {
  it("luz, intensidade, roupa padrão, trocar roupa, Vista-me e móveis", () => {
    const p = setup({ help: <button type="button">Ajuda</button> });
    expect(screen.getByRole("heading", { name: "Configurações do quarto" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ajuda" })).toBeTruthy();
    expect(screen.getByText("42%")).toBeTruthy();
    fireEvent.click(toggle("Luz do teto acesa"));
    expect(p.light.onToggle).toHaveBeenCalledTimes(1);
    fireEvent.change(range("Intensidade da luz"), { target: { value: "80" } });
    expect(p.light.onDim).toHaveBeenCalledWith(0.8);
    expect(screen.getByText("Roupa padrão do quarto")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Trocar roupa" })); expect(p.outfit.onChange).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "+ ✨ Vista-me" })); expect(p.outfit.onVistaMe).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Abrir móveis" })); expect(p.onFurniture).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Modo foto" })); expect(p.onPhoto).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Chaves do quarto" })); expect(p.onKeys).toHaveBeenCalled();
  });

  it("luz ocupada desabilita o interruptor; a roupa vestida aparece pelos nomes", () => {
    setup({ light: { on: false, busy: true, intensity: 1, onToggle: vi.fn(), onDim: vi.fn() }, outfit: { names: ["Camiseta", "Calça"], onChange: vi.fn(), onVistaMe: vi.fn() } });
    expect((toggle("Luz do teto acesa") as HTMLButtonElement).disabled).toBe(true);
    expect(toggle("Luz do teto acesa").getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("Camiseta · Calça")).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("sem cena 3D: só o que não depende de câmera", () => {
    setup({ gl: false });
    expect(screen.queryByText("Câmera e pontos de vista")).toBeNull();
    expect(screen.queryByText("Paredes")).toBeNull();
    expect(screen.queryByRole("button", { name: "Modo foto" })).toBeNull();
    expect(screen.getByRole("button", { name: "Chaves do quarto" })).toBeTruthy();
    expect(screen.getByText("Acessibilidade")).toBeTruthy();
  });
});

describe("configurações do quarto — câmera", () => {
  it("modo da câmera e pontos de vista (a vista escolhida limpa a favorita)", () => {
    const p = setup();
    expect(radio("Andar com o avatar").getAttribute("aria-checked")).toBe("true");
    fireEvent.click(radio("Câmera livre"));
    expect(p.onWalking).toHaveBeenCalledWith(false);
    expect(radio("Geral").getAttribute("aria-checked")).toBe("true");
    fireEvent.click(radio("Canto da cama"));
    expect(p.onChange).toHaveBeenCalledWith({ view: "teto-cama", favorite: null });
    fireEvent.click(radio("Primeira pessoa"));
    expect(p.onChange).toHaveBeenCalledWith({ view: "primeira-pessoa", favorite: null });
  });

  it("primeira pessoa só andando com o avatar", () => {
    const p = setup({ walking: false });
    const first = radio("Primeira pessoa") as HTMLButtonElement;
    expect(first.disabled).toBe(true);
    expect(first.title).toBe("Disponível no modo Andar com o avatar");
    fireEvent.click(radio("Andar com o avatar"));
    expect(p.onWalking).toHaveBeenCalledWith(true);
  });

  it("vistas favoritas: ver, salvar e apagar; a favorita em uso fica marcada e nenhuma vista fica escolhida", () => {
    const p = setup({}, { favorites: [SAVED, null, null, null, null], favorite: 1 });
    expect(radio("Geral").getAttribute("aria-checked")).toBe("false");
    const go1 = screen.getByRole("button", { name: "Vista favorita 1" }) as HTMLButtonElement;
    expect(go1.textContent).toBe("Ver");
    expect(go1.closest("li")!.className).toBe("is-active");
    fireEvent.click(go1); expect(p.onRecallFavorite).toHaveBeenCalledWith(1);
    const go2 = screen.getByRole("button", { name: "Vista favorita 2" }) as HTMLButtonElement;
    expect(go2.disabled).toBe(true); expect(go2.textContent).toBe("Vazia");
    fireEvent.click(screen.getByRole("button", { name: "Salvar a câmera atual na vista 3" })); expect(p.onSaveFavorite).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole("button", { name: "Apagar a vista favorita 1" })); expect(p.onClearFavorite).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("button", { name: "Apagar a vista favorita 2" })).toBeNull();
  });

  it("campo de visão automático ou fixo, sensibilidade, eixos, seguir e troca de vista", () => {
    const p = setup();
    expect(screen.queryByRole("slider", { name: "Campo de visão" })).toBeNull();
    fireEvent.click(toggle("Campo de visão automático"));
    expect(p.onChange).toHaveBeenCalledWith({ fov: 60 });
    fireEvent.change(range("Sensibilidade da câmera"), { target: { value: "75" } });
    expect(p.onChange).toHaveBeenCalledWith({ sensitivity: 75 });
    fireEvent.click(toggle("Inverter eixo horizontal")); expect(p.onChange).toHaveBeenCalledWith({ invertX: true });
    fireEvent.click(toggle("Inverter eixo vertical")); expect(p.onChange).toHaveBeenCalledWith({ invertY: true });
    fireEvent.click(toggle("Câmera segue o avatar")); expect(p.onChange).toHaveBeenCalledWith({ follow: false });
    fireEvent.click(radio("Corte seco")); expect(p.onChange).toHaveBeenCalledWith({ transition: "corte" });
  });

  it("com campo de visão fixo aparece o controle em graus e voltar ao automático limpa", () => {
    const p = setup({}, { fov: 70 });
    expect(screen.getByText("70°")).toBeTruthy();
    fireEvent.change(range("Campo de visão"), { target: { value: "85" } });
    expect(p.onChange).toHaveBeenCalledWith({ fov: 85 });
    fireEvent.click(toggle("Campo de visão automático"));
    expect(p.onChange).toHaveBeenCalledWith({ fov: null });
  });
});

describe("configurações do quarto — cena e acessibilidade", () => {
  it("paredes: escolha e a explicação de cada modo", () => {
    const p = setup({}, { walls: "inteiras" });
    expect(screen.getByText("As paredes nunca somem: bom para ver o quarto por dentro.")).toBeTruthy();
    fireEvent.click(radio("Baixas"));
    expect(p.onChange).toHaveBeenCalledWith({ walls: "baixas" });
  });

  it("vista que exige paredes baixas avisa (a não ser numa vista favorita)", () => {
    setup({}, { view: "planta" });
    expect(screen.getByText("A vista Planta (de cima) usa as paredes baixas.")).toBeTruthy();
    cleanup();
    setup({}, { view: "planta", favorite: 2, favorites: [null, SAVED, null, null, null] });
    expect(screen.getByText("Somem só as paredes que tapam a vista.")).toBeTruthy();
  });

  it("ambiente: hora do dia e temperatura da lâmpada (ou a do quarto)", () => {
    const p = setup({}, { kelvin: 4000 });
    pick("Hora do dia", "Noite");
    expect(p.onChange).toHaveBeenCalledWith({ period: "night" });
    pick("Temperatura da lâmpada", "Fria · 6500 K");
    expect(p.onChange).toHaveBeenCalledWith({ kelvin: 6500 });
    pick("Temperatura da lâmpada", "A do quarto");
    expect(p.onChange).toHaveBeenCalledWith({ kelvin: null });
  });

  it("gráficos e interface na cena", () => {
    const p = setup();
    pick("Qualidade", "Leve (sem sombras)");
    expect(p.onChange).toHaveBeenCalledWith({ quality: "leve" });
    pick("Reflexo do espelho", "Desligado");
    expect(p.onChange).toHaveBeenCalledWith({ mirror: "desligado" });
    fireEvent.click(toggle("Resolução dinâmica"));
    expect(p.onChange).toHaveBeenCalledWith({ dynamicRes: !DEFAULT_ROOM_SETTINGS.dynamicRes });
    fireEvent.click(radio("Oculta"));
    expect(p.onChange).toHaveBeenCalledWith({ hud: "oculto" });
    fireEvent.click(toggle("Mostrar o nome da vista ao trocar"));
    expect(p.onChange).toHaveBeenCalledWith({ viewName: !DEFAULT_ROOM_SETTINGS.viewName });
  });

  it("acessibilidade: movimento, conforto e restaurar padrões mantendo as favoritas", () => {
    const favorites = [SAVED, null, null, null, null];
    const p = setup({}, { favorites, sensitivity: 90, walls: "baixas" });
    fireEvent.click(radio("Reduzido"));
    expect(p.onChange).toHaveBeenCalledWith({ motion: "reduzido" });
    fireEvent.click(toggle("Conforto contra enjoo"));
    expect(p.onChange).toHaveBeenCalledWith({ comfort: !DEFAULT_ROOM_SETTINGS.comfort });
    fireEvent.click(screen.getByRole("button", { name: "Restaurar padrões" }));
    expect(p.onChange).toHaveBeenLastCalledWith({ ...DEFAULT_ROOM_SETTINGS, favorites });
  });
});
