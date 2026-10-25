// @vitest-environment jsdom
/**
 * Componentes base: os caminhos de teclado, de estado e de erro que o teste geral não percorre (listas, abas roláveis,
 * passos, foco preso nos modais, menu, avisos em fila e mensagens tratadas do backend).
 */
import { Fragment, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, renderApp, screen, within } from "@/test-utils/render";
import { ApiError } from "@/lib/api/client";
import {
  ActionMenu, Avatar, Badge, Card, Chip, ChipMultiSelect, Dialog, Dropdown, EmptyState, ErrorState, Field, FileButton, Input, PageHeader, Pagination,
  SegmentPicker, Select, Stepper, Switch, Tabs, Textarea, useNotice, useNoticeOnError, useToast,
} from "./index";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("FileButton e campos", () => {
  it("o botão abre o seletor; vários arquivos mostram a contagem; nenhum arquivo não chama nada", () => {
    const onFiles = vi.fn();
    const { container } = renderApp(<FileButton id="up" onFiles={onFiles} multiple><span>Enviar</span> <b>fotos</b></FileButton>);
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    expect(input.getAttribute("aria-label")).toBe("Enviar fotos");
    const click = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: /Enviar/ }));
    expect(click).toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [] } });
    expect(onFiles).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [new File(["a"], "a.png"), new File(["b"], "b.png")] } });
    expect(onFiles).toHaveBeenCalledWith(expect.arrayContaining([expect.any(File)]));
    expect(screen.getByText("2 arquivos")).toBeTruthy();
  });

  it("um arquivo mostra o nome; sem nome visível e sem texto usa o rótulo padrão", () => {
    const { container } = renderApp(<><FileButton onFiles={() => {}}>Foto</FileButton><FileButton onFiles={() => {}} showName={false}>{null}</FileButton></>);
    const [a, b] = Array.from(container.querySelectorAll("input[type=file]")) as HTMLInputElement[];
    fireEvent.change(a, { target: { files: [new File(["a"], "minha.png")] } });
    expect(screen.getByText("minha.png")).toBeTruthy();
    fireEvent.change(b, { target: { files: [new File(["a"], "oculto.png")] } });
    expect(screen.queryByText("oculto.png")).toBeNull();
    expect(b.getAttribute("aria-label")!.length).toBeGreaterThan(0);
  });

  it("campo obrigatório com dica; input e textarea marcam erro", () => {
    renderApp(<><Field label="Nome" id="n" hint="Como aparece" required><Input id="n" error /></Field><Field id="b"><Textarea id="b" error /></Field></>);
    expect(screen.getByText("Como aparece").className).toBe("help");
    expect(screen.getByText("*")).toBeTruthy();
    expect(document.getElementById("n")!.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById("b")!.getAttribute("aria-invalid")).toBe("true");
  });
});

describe("Select e Dropdown", () => {
  it("Select sem valor controlado guarda a escolha; opções de fragmento, optgroup, número e sem value", () => {
    const onChange = vi.fn();
    renderApp(
      <Select id="s" name="cor" aria-label="Cor" onChange={onChange}>
        <option value={1}>Um {2}</option>
        <Fragment><option value="f">Frag</option></Fragment>
        <optgroup label="g"><option value="g1" disabled>Grupo</option></optgroup>
        <option>Livre</option>
        texto solto
      </Select>,
    );
    const trigger = screen.getByRole("button", { name: "Cor: Um 2" });
    fireEvent.click(trigger);
    const opts = screen.getAllByRole("option");
    expect(opts.map((o) => o.textContent)).toEqual(["Um 2", "Frag", "Grupo", "Livre"]);
    expect(opts[2].getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(opts[2]);   // desabilitada: nada acontece
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Livre"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: { value: "Livre", name: "cor", id: "s" } }));
    expect(screen.getByRole("button", { name: "Cor: Livre" })).toBeTruthy();
  });

  it("teclado da lista: Home, End, letras, Enter, Espaço, Tab e Escape; seta no botão abre", () => {
    function Harness() {
      const [v, setV] = useState<"a" | "b" | "c" | "d">("b");
      return <><Dropdown label="Ordem" prefix="Por:" value={v} onChange={setV} options={[{ id: "a", label: "Alfa" }, { id: "b", label: "Beta" }, { id: "c", label: "Bravo" }, { id: "d", label: "Delta" }]} /><span data-testid="v">{v}</span><button>fora</button></>;
    }
    renderApp(<Harness />);
    expect(screen.getByText("Por:")).toBeTruthy();
    const trigger = () => screen.getByRole("button", { name: /^Ordem:/ });
    fireEvent.keyDown(trigger(), { key: "ArrowUp" });
    const list = () => screen.getByRole("listbox");
    fireEvent.keyDown(list(), { key: "End" });
    fireEvent.keyDown(list(), { key: "Enter" });
    expect(screen.getByTestId("v").textContent).toBe("d");
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    fireEvent.keyDown(list(), { key: "Home" });
    fireEvent.keyDown(list(), { key: "ArrowUp" });
    fireEvent.keyDown(list(), { key: " " });
    expect(screen.getByTestId("v").textContent).toBe("a");
    fireEvent.click(trigger());
    fireEvent.keyDown(list(), { key: "b" });   // pula para Beta
    fireEvent.keyDown(list(), { key: "b" });   // e depois para Bravo
    fireEvent.keyDown(list(), { key: "z" });   // sem opção: fica
    fireEvent.keyDown(list(), { key: "b" });   // volta ao começo: Beta
    fireEvent.keyDown(list(), { key: "Enter" });
    expect(screen.getByTestId("v").textContent).toBe("b");
    fireEvent.click(trigger());
    fireEvent.keyDown(list(), { key: "Shift" });
    fireEvent.keyDown(list(), { key: "Tab" });
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.click(trigger());
    fireEvent.pointerEnter(screen.getByText("Delta"));
    expect(screen.getByText("Delta").closest("li")!.className).toContain("is-active");
    fireEvent.keyDown(list(), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.click(trigger());
    fireEvent.pointerDown(screen.getByText("fora"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("carregando ou desabilitado não abre; valor fora da lista mostra a primeira", () => {
    renderApp(<><Dropdown label="A" value={"x" as "a"} onChange={() => {}} options={[{ id: "a", label: "Alfa" }]} loading /><Dropdown labelledBy="lbl" id="dd" value="a" onChange={() => {}} options={[{ id: "a", label: "Alfa" }]} disabled invalid /></>);
    const [a, b] = screen.getAllByRole("button");
    expect(a.getAttribute("aria-busy")).toBe("true");
    expect(a.textContent).toContain("Alfa");
    expect(b.getAttribute("aria-labelledby")).toBe("lbl");
    expect(b.getAttribute("aria-invalid")).toBe("true");
    fireEvent.click(a); fireEvent.click(b);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("Seleção múltipla, chips e afins", () => {
  it("valor fora da lista vira alerta com remover; sem problema usa a mensagem padrão; erro só sem pendência", () => {
    function Harness() {
      const [v, setV] = useState<string[]>(["casual", "velho"]);
      return <ChipMultiSelect legend="Estilo" max={1} scroll options={[{ id: "casual", label: "Casual" }, { id: "work", label: "Trabalho" }]} value={v} onChange={setV} error="Escolha um" />;
    }
    renderApp(<Harness />);
    expect(screen.getByText("“velho” não está nesta lista. Remova e escolha uma opção da lista.")).toBeTruthy();
    expect(screen.queryByText("Escolha um")).toBeNull();
    expect(screen.getByText("1 de 1")).toBeTruthy();
    expect(screen.getByText("Escolha até 1; toque de novo para remover.")).toBeTruthy();
    fireEvent.click(screen.getByText("Trabalho"));   // cheio: mensagem padrão do limite
    expect(screen.getByText("Selecione até 1. Toque numa opção marcada para tirá-la e escolher outra.")).toBeTruthy();
    fireEvent.click(screen.getByText("Remover “velho”"));
    expect(screen.queryByText(/não está nesta lista/)).toBeNull();
    fireEvent.click(screen.getByText("Casual"));   // remove o marcado: limpa o aviso
    expect(screen.getByText("Escolha um")).toBeTruthy();
    fireEvent.click(screen.getByText("Trabalho"));
    expect(screen.getByText("Trabalho").closest("button")!.getAttribute("aria-pressed")).toBe("true");
  });

  it("chip de rádio usa aria-checked; switch sem dica e desabilitado; badge, card e avatar", () => {
    const onSw = vi.fn();
    renderApp(<>
      <Chip role="radio" active>R1</Chip><Chip role="radio" aria-checked={false} active>R2</Chip>
      <Switch checked onChange={onSw} label="Som" disabled />
      <Badge>Simples</Badge><Card className="extra">Com borda</Card>
      <Avatar /><Avatar name="maria clara souza" size={20} />
    </>);
    expect(screen.getByText("R1").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("R1").getAttribute("aria-pressed")).toBeNull();
    expect(screen.getByText("R2").getAttribute("aria-checked")).toBe("false");
    const sw = screen.getByRole("switch");
    expect(sw.getAttribute("aria-describedby")).toBeNull();
    expect((sw as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Simples").className).toBe("badge");
    expect(screen.getByText("Com borda").className).toContain("card-pad");
    expect(screen.getByText("?")).toBeTruthy();
    expect(screen.getByText("MC")).toBeTruthy();
  });

  it("paginação sem total mostra só a página; última página desabilita avançar", () => {
    const onPage = vi.fn();
    renderApp(<Pagination page={0} hasMore={false} onPage={onPage} />);
    expect(screen.getByText("Página 1")).toBeTruthy();
    expect((screen.getByText(/Voltar/).closest("button") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText(/Avançar/).closest("button") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Cabeçalho, abas, passos e segmentos", () => {
  it("trilha com botão, link e página atual; kicker de requisito some fora do modo apresentação", () => {
    const back = vi.fn();
    renderApp(<PageHeader title="Espelho" kicker="RF7 · RF31" trail={[{ label: "Início", href: "/feed" }, { label: "Meu Quarto", onClick: back }, { label: "Espelho" }]} />);
    expect(document.title).toBe("Espelho · Fashion AI");
    const nav = screen.getByRole("navigation", { name: "Você está em" });
    expect(within(nav).getByText("Início").getAttribute("href")).toBe("/feed");
    fireEvent.click(within(nav).getByText("Meu Quarto"));
    expect(back).toHaveBeenCalled();
    expect(within(nav).getByText("Espelho").getAttribute("aria-current")).toBe("page");
    expect(screen.queryByText("RF7 · RF31")).toBeNull();
    expect(document.querySelector(".page-header")!.getAttribute("data-rf")).toBe("RF7 · RF31");
  });

  it("kicker de requisito aparece no modo apresentação", () => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue("1");
    renderApp(<PageHeader title="X" kicker="RF4" />);
    expect(screen.getByText("RF4").className).toContain("text-thread");
  });

  it("abas: Home, End, seta esquerda volta ao fim e outras teclas não trocam", () => {
    const onChange = vi.fn();
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => { cb(0); return 0; });
    renderApp(<Tabs value="a" onChange={onChange} tabs={[{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }]} />);
    const tab = screen.getByRole("tab", { name: "A" });
    fireEvent.keyDown(tab, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith("c");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "C" }));
    fireEvent.keyDown(tab, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("c");
    fireEvent.keyDown(tab, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("a");
    fireEvent.keyDown(tab, { key: "x" });
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(raf).toHaveBeenCalled();
  });

  it("abas que transbordam: setas nas bordas, rolagem pela roda do mouse e centralizar a ativa", () => {
    const sw = vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(1000);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
    const scrollTo = vi.fn(); const scrollBy = vi.fn();
    Object.assign(HTMLElement.prototype, { scrollTo, scrollBy });
    const { rerender } = renderApp(<Tabs value="a" onChange={() => {}} tabs={[{ id: "a", label: "A" }, { id: "b", label: "B" }]} />);
    const list = screen.getByRole("tablist");
    expect(screen.getByLabelText("Próximas abas")).toBeTruthy();
    expect(screen.queryByLabelText("Abas anteriores")).toBeNull();
    fireEvent.wheel(list, { deltaY: -40 });   // no começo, para trás: a página rola
    expect(list.scrollLeft).toBe(0);
    fireEvent.wheel(list, { deltaY: 5, deltaX: 30 });   // gesto horizontal: deixa o navegador
    expect(list.scrollLeft).toBe(0);
    fireEvent.wheel(list, { deltaY: 120 });
    expect(list.scrollLeft).toBe(120);
    fireEvent.scroll(list);
    expect(screen.getByLabelText("Abas anteriores")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Abas anteriores"));
    fireEvent.click(screen.getByLabelText("Próximas abas"));
    expect(scrollBy).toHaveBeenCalledWith({ left: -210, behavior: "smooth" });
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 210, behavior: "smooth" });
    rerender(<Tabs value="b" onChange={() => {}} tabs={[{ id: "a", label: "A" }, { id: "b", label: "B" }]} />);
    expect(scrollTo).toHaveBeenCalled();
    // sem transbordar: a roda não mexe
    sw.mockReturnValue(300);
    list.scrollLeft = 0;
    fireEvent.wheel(list, { deltaY: 50 });
    expect(list.scrollLeft).toBe(0);
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollTo;
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollBy;
  });

  it("passos: sem onStep tudo fica travado; sem canGo só os anteriores; o atual tem aria-current", () => {
    const { rerender } = renderApp(<Stepper label="Etapas" steps={["Foto", "Dados", "Revisar"]} current={1} />);
    expect(screen.getAllByRole("button").every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    const onStep = vi.fn();
    rerender(<Stepper label="Etapas" steps={["Foto", "Dados", "Revisar"]} current={1} onStep={onStep} />);
    expect((screen.getByRole("button", { name: "Foto" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Revisar" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Dados" }).getAttribute("aria-current")).toBe("step");
    expect(screen.getByText("Passo 2 de 3")).toBeTruthy();
  });

  it("segmentos: setas, Home e End movem e escolhem com a volta circular", () => {
    function Harness() {
      const [v, setV] = useState<"x" | "y" | "z">("x");
      return <><SegmentPicker label="Visão" value={v} onChange={setV} options={[{ id: "x", label: "X" }, { id: "y", label: "Y" }, { id: "z", label: "Z" }]} /><i data-testid="v">{v}</i></>;
    }
    renderApp(<Harness />);
    const v = () => screen.getByTestId("v").textContent;
    fireEvent.keyDown(screen.getByRole("radio", { name: "X" }), { key: "ArrowUp" });
    expect(v()).toBe("z");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Z" }));
    fireEvent.keyDown(screen.getByRole("radio", { name: "Z" }), { key: "ArrowDown" });
    expect(v()).toBe("x");
    fireEvent.keyDown(screen.getByRole("radio", { name: "X" }), { key: "End" });
    expect(v()).toBe("z");
    fireEvent.keyDown(screen.getByRole("radio", { name: "Z" }), { key: "Home" });
    expect(v()).toBe("x");
    fireEvent.keyDown(screen.getByRole("radio", { name: "X" }), { key: "q" });
    expect(v()).toBe("x");
  });
});

describe("Estados vazio e de erro", () => {
  it("vazio com ícone e título em parágrafo", () => {
    renderApp(<EmptyState title="Sem peças" icon={<span>ícone</span>} />);
    expect(screen.getByText("Sem peças").tagName).toBe("P");
    expect(screen.getByText("ícone")).toBeTruthy();
  });

  it("offline oferece tentar de novo; 404 sem notFound explica; 403 sem acesso; erro de página vira h1", () => {
    const retry = vi.fn();
    renderApp(<>
      <ErrorState error={new ApiError(0, "OFFLINE", "rede")} onRetry={retry} page />
      <ErrorState error={new ApiError(404, "NAO_ENCONTRADO", "x")} onRetry={retry} />
      <ErrorState error={new ApiError(403, "PROIBIDO", "y", {}, "corr-1")} />
    </>);
    expect(screen.getByText("Sem conexão com o servidor.").tagName).toBe("H1");
    fireEvent.click(screen.getByText("Tentar de novo"));
    expect(retry).toHaveBeenCalled();
    expect(screen.getAllByText("Tentar de novo")).toHaveLength(1);
    expect(screen.getByText("Não encontramos esta página")).toBeTruthy();
    expect(screen.getByText("Você não tem acesso a este conteúdo")).toBeTruthy();
    expect(screen.getAllByText("Voltar ao feed")).toHaveLength(2);
    expect(screen.queryByText("corr-1")).toBeNull();
  });
});

describe("Modais, menus e avisos", () => {
  it("Tab e Shift+Tab dão a volta dentro do modal; clique no fundo fecha", () => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    const onClose = vi.fn();
    renderApp(<Dialog open onClose={onClose} title="Editar" role="alertdialog"><button>Primeiro</button><button>Último</button></Dialog>);
    const dlg = screen.getByRole("alertdialog");
    const close = screen.getByRole("button", { name: "Fechar" });
    expect(document.activeElement).toBe(close);
    const last = screen.getByText("Último");
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: "a" });
    fireEvent.mouseDown(dlg);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(dlg.parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape dentro de uma lista aberta não fecha o modal", () => {
    const onClose = vi.fn();
    renderApp(<Dialog open onClose={onClose} title="Com lista"><ul role="listbox"><li tabIndex={0}>item</li></ul></Dialog>);
    fireEvent.keyDown(screen.getByText("item"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("menu: gatilho próprio, setas circulares, Tab fecha, link fecha e Escape devolve o foco; sem itens visíveis não aparece", () => {
    const { container } = renderApp(<>
      <ActionMenu trigger={<span>Opções</span>} align="start" direction="up" items={[{ label: "Um", onSelect: () => {} }, { label: "Link", href: "#x" }]} />
      <ActionMenu items={[{ label: "Nada", hidden: true }]} />
    </>);
    expect(container.querySelectorAll("[aria-haspopup=menu]")).toHaveLength(1);
    const trigger = screen.getByText("Opções").closest("button")!;
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu", { name: "Mais opções" });
    expect(menu.className).toContain("is-up");
    expect(menu.className).toContain("left-0");
    expect(document.activeElement!.textContent).toBe("Um");
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(document.activeElement!.textContent).toBe("Link");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement!.textContent).toBe("Um");
    fireEvent.keyDown(menu, { key: "Tab" });
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText("Link"));
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("avisos: título padrão por tipo, ação com link e com callback, duplicado não entra, onClose ao fechar", () => {
    const onAct = vi.fn(); const onClose = vi.fn();
    function Harness() {
      const n = useNotice();
      return <>
        <button onClick={() => { n.info("Olá", { action: { label: "Ver mais", href: "#mais" } }); n.info("Olá"); n.success("Feito", { onClose, action: { label: "Desfazer", onSelect: onAct } }); n.error(""); }}>vai</button>
      </>;
    }
    renderApp(<Harness />);
    fireEvent.click(screen.getByText("vai"));
    expect(screen.getByRole("dialog", { name: "Aviso" })).toBeTruthy();
    fireEvent.click(screen.getByText("Ver mais"));
    expect(screen.getByRole("dialog", { name: "Tudo certo" })).toBeTruthy();
    fireEvent.click(screen.getByText("Desfazer"));
    expect(onAct).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("fromError: moderação vira aviso, erro desconhecido usa o genérico, campos e código de suporte vão na lista", () => {
    function Harness() {
      const n = useNotice();
      return <>
        <button onClick={() => n.fromError(new ApiError(422, "IMAGEM_EM_REVISAO", "Foto em análise"))}>rev</button>
        <button onClick={() => n.fromError("boom")}>gen</button>
        <button onClick={() => n.fromError(new ApiError(400, "VALIDACAO", "Revise os campos", { fields: { nome: "Nome curto", outro: "Revise os campos", n: 3 } }, "abcdef1234"), undefined, { details: ["extra"] })}>val</button>
        <button onClick={() => n.fromError(new ApiError(400, "X", "Sem suporte"))}>sem</button>
      </>;
    }
    renderApp(<Harness />);
    const ok = () => fireEvent.click(screen.getByText("Entendi"));
    fireEvent.click(screen.getByText("rev"));
    expect(screen.getByRole("dialog", { name: "Aviso" })).toBeTruthy();
    ok();
    fireEvent.click(screen.getByText("gen"));
    expect(screen.getByText("Algo deu errado. Tente de novo.")).toBeTruthy();
    expect(screen.getByRole("alertdialog", { name: "Não foi possível concluir" })).toBeTruthy();
    ok();
    fireEvent.click(screen.getByText("val"));
    const items = Array.from(document.querySelectorAll(".notice-list li")).map((l) => l.textContent);
    expect(items).toEqual(["Nome curto", "extra", "Código de suporte: abcdef12"]);
    ok();
    fireEvent.click(screen.getByText("sem"));
    expect(document.querySelector(".notice-list")).toBeNull();
  });

  it("useNoticeOnError abre o modal a cada erro novo, com as opções calculadas", () => {
    function Harness({ error }: { error: ApiError | null }) {
      useNoticeOnError(error, (e) => ({ title: `Falha ${e.status}` }));
      return null;
    }
    const { rerender } = renderApp(<Harness error={null} />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    rerender(<Harness error={new ApiError(409, "CONFLITO", "Já existe")} />);
    expect(screen.getByRole("alertdialog", { name: "Falha 409" })).toBeTruthy();
    expect(screen.getByText("Já existe")).toBeTruthy();
  });

  it("toasts: erro some em 7 s, aviso longo fica 10 s, erro de backend sem código e genérico personalizado", () => {
    vi.useFakeTimers();
    function Harness() {
      const toast = useToast();
      return <>
        <button onClick={() => toast.error("Falhou")}>e</button>
        <button onClick={() => toast.info("x".repeat(130))}>longo</button>
        <button onClick={() => toast.fromError(new ApiError(500, "E", "Servidor caiu"))}>api</button>
        <button onClick={() => toast.fromError(new Error("x"), "Tente mais tarde")}>gen</button>
      </>;
    }
    renderApp(<Harness />);
    ["e", "longo", "api", "gen"].forEach((b) => fireEvent.click(screen.getByText(b)));
    expect(screen.getByText("Servidor caiu")).toBeTruthy();
    expect(screen.getByText("Tente mais tarde").getAttribute("role")).toBe("alert");
    act(() => { vi.advanceTimersByTime(7100); });
    expect(screen.queryByText("Falhou")).toBeNull();
    expect(screen.getByText("x".repeat(130))).toBeTruthy();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByText("x".repeat(130))).toBeNull();
  });
});
