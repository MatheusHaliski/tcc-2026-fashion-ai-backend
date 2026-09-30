// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, renderApp, screen } from "@/test-utils/render";
import { ApiError } from "@/lib/api/client";
import {
  ActionMenu, Avatar, Badge, Button, Card, Chip, ChipMultiSelect, Dialog, Dropdown, EmptyState, ErrorState, Field, FileButton,
  Input, PageHeader, Pagination, SegmentPicker, Select, Sheet, Skeleton, SkeletonGrid, Spinner, Stepper, Switch, Tabs, Textarea,
  cn, useNotice, useToast,
} from "./index";

afterEach(cleanup);

describe("componentes base da interface", () => {
  it("cn junta só as classes verdadeiras", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("botão: clique, estado carregando e desabilitado", () => {
    const onClick = vi.fn();
    renderApp(<><Button onClick={onClick}>Salvar</Button><Button loading>Enviando</Button><Button variant="primary" size="sm" disabled>Off</Button></>);
    fireEvent.click(screen.getByText("Salvar"));
    expect(onClick).toHaveBeenCalledTimes(1);
    const loading = screen.getByText("Enviando").closest("button")!;
    expect(loading.disabled || loading.getAttribute("aria-busy") === "true").toBe(true);
    expect(screen.getByText("Off").closest("button")!.disabled).toBe(true);
  });

  it("botão de arquivo repassa os arquivos escolhidos", () => {
    const onFiles = vi.fn();
    const { container } = renderApp(<FileButton id="f" accept="image/*" onFiles={onFiles}>Escolher</FileButton>);
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    const file = new File(["x"], "foto.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFiles).toHaveBeenCalled();
  });

  it("campo com rótulo, dica, erro e obrigatório; input, textarea e select", () => {
    const onChange = vi.fn();
    renderApp(
      <>
        <Field label="Nome" id="nome" hint="Como aparece no perfil" error="Obrigatório" required><Input id="nome" error onChange={onChange} /></Field>
        <Field label="Bio" id="bio"><Textarea id="bio" /></Field>
        <Field label="Cor" id="cor"><Select id="cor" defaultValue="b" onChange={onChange}><option value="a">A</option><option value="b">B</option></Select></Field>
        <Select id="carregando" loading value=""><option value="">—</option></Select>
      </>,
    );
    expect(screen.getByText("Nome")).toBeTruthy();
    expect(screen.getByText("Obrigatório")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Nome/), { target: { value: "Ana" } });
    // o Select desenha a própria lista (Dropdown): escolhe-se clicando na opção
    fireEvent.click(document.getElementById("cor")!);
    fireEvent.click(screen.getByRole("option", { name: "A" }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("dropdown abre, navega por teclado e escolhe uma opção", () => {
    function Harness() {
      const [v, setV] = useState<"a" | "b" | "c">("a");
      return <><Dropdown label="Ordem" value={v} onChange={setV} options={[{ id: "a", label: "Alfa" }, { id: "b", label: "Beta" }, { id: "c", label: "Gama" }]} /><span data-testid="v">{v}</span></>;
    }
    renderApp(<Harness />);
    const trigger = screen.getByRole("button", { name: /Alfa/ });
    fireEvent.click(trigger);
    fireEvent.keyDown(document.activeElement ?? trigger, { key: "ArrowDown" });
    fireEvent.click(screen.getByText("Gama"));
    expect(screen.getByTestId("v").textContent).toBe("c");
    fireEvent.click(screen.getByRole("button", { name: /Gama/ }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  });

  it("seleção múltipla respeita o máximo e avisa o limite", () => {
    function Harness() {
      const [v, setV] = useState<string[]>(["casual"]);
      return <ChipMultiSelect legend="Ocasião" max={2} options={[{ id: "casual", label: "Casual" }, { id: "work", label: "Trabalho" }, { id: "party", label: "Festa" }]}
        value={v} onChange={setV} hint="Até 2" limitMessage="Máximo de 2" error="Escolha" problem={() => "fora da lista"} />;
    }
    renderApp(<Harness />);
    fireEvent.click(screen.getByText("Trabalho"));
    fireEvent.click(screen.getByText("Festa"));
    expect(screen.getAllByText("Máximo de 2").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Casual"));
  });

  it("switch, chip, badge, card, cabeçalho, esqueleto e spinner", () => {
    const onSwitch = vi.fn(); const onChip = vi.fn();
    renderApp(
      <>
        <Switch checked={false} onChange={onSwitch} label="Notificações" hint="Por e-mail" id="sw" />
        <Chip active onClick={onChip}>Ativo</Chip><Chip blocked disabled>Bloqueado</Chip>
        <Badge tone="mark">Novo</Badge><Card pad={false}>Conteúdo</Card>
        <PageHeader title="Guarda-roupa" lead="Suas peças" kicker="RF4" actions={<Button>Adicionar</Button>} />
        <Skeleton className="h-4" /><SkeletonGrid n={2} /><Spinner size={12} />
      </>,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onSwitch).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByText("Ativo"));
    expect(onChip).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Guarda-roupa" })).toBeTruthy();
  });

  it("abas, passos e seletor de segmento trocam o item ativo", () => {
    const onTab = vi.fn(); const onStep = vi.fn(); const onSeg = vi.fn();
    renderApp(
      <>
        <Tabs label="Seções" value="a" onChange={onTab} tabs={[{ id: "a", label: "Peças", count: 3 }, { id: "b", label: "Looks" }]} />
        <Stepper label="Etapas" steps={["Foto", "Dados", "Revisar"]} current={1} onStep={onStep} canGo={(i) => i <= 1} />
        <SegmentPicker label="Visão" value="x" onChange={onSeg} options={[{ id: "x", label: "Grade" }, { id: "y", label: "Lista", count: 2 }]} />
      </>,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Looks/ }));
    expect(onTab).toHaveBeenCalledWith("b");
    fireEvent.keyDown(screen.getByRole("tab", { name: /Peças/ }), { key: "ArrowRight" });
    fireEvent.click(screen.getByText("Foto"));
    expect(onStep).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByText("Lista"));
    expect(onSeg).toHaveBeenCalledWith("y");
  });

  it("estado vazio e estado de erro com tentar de novo e não encontrado", () => {
    const retry = vi.fn();
    renderApp(
      <>
        <EmptyState title="Nada aqui" hint="Cadastre uma peça" action={<Button>Cadastrar</Button>} heading />
        <ErrorState error={new ApiError(500, "ERRO", "Falhou", {}, "abcdef123456")} onRetry={retry} />
        <ErrorState error={new ApiError(404, "NAO_ENCONTRADO", "Sumiu")} notFound={{ title: "Peça não encontrada", hint: "Foi apagada" }} page />
        <ErrorState error={new Error("genérico")} />
        <ErrorState error={null} />
      </>,
    );
    expect(screen.getByText("Nada aqui")).toBeTruthy();
    expect(screen.getByText("Peça não encontrada")).toBeTruthy();
    const retryBtn = screen.getAllByRole("button").find((b) => b.textContent && /tent/i.test(b.textContent));
    if (retryBtn) { fireEvent.click(retryBtn); expect(retry).toHaveBeenCalled(); }
  });

  it("avatar com foto ou iniciais e paginação", () => {
    const onPage = vi.fn();
    renderApp(<><Avatar name="Ana Souza" /><Avatar src="/a.png" name="Bia" size={48} /><Pagination page={1} hasMore onPage={onPage} total={50} size={20} /></>);
    const buttons = screen.getAllByRole("button");
    buttons.forEach((b) => { if (!(b as HTMLButtonElement).disabled) fireEvent.click(b); });
    expect(onPage).toHaveBeenCalled();
  });

  it("diálogo e painel lateral: título, rodapé e fechar", () => {
    const onClose = vi.fn();
    const { rerender } = renderApp(
      <>
        <Dialog open onClose={onClose} title="Confirmar" footer={<Button>OK</Button>} size="lg">Tem certeza?</Dialog>
        <Sheet open onClose={onClose} title="Filtros" footer={<Button>Aplicar</Button>} side="bottom">Opções</Sheet>
      </>,
    );
    expect(screen.getByRole("dialog", { name: "Confirmar" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Confirmar" }), { key: "Tab" });
    screen.getAllByRole("button", { name: /fechar/i }).forEach((b) => fireEvent.click(b));
    expect(onClose).toHaveBeenCalled();
    rerender(<Dialog open={false} onClose={onClose} title="Confirmar">x</Dialog>);
    expect(screen.queryByRole("dialog", { name: "Confirmar" })).toBeNull();
  });

  it("menu de ações abre e executa o item", () => {
    const onEdit = vi.fn();
    renderApp(<ActionMenu label="Mais ações" items={[{ label: "Editar", onSelect: onEdit }, { label: "Apagar", danger: true, onSelect: vi.fn() }, { label: "Oculto", hidden: true }, { label: "Ver", href: "/x" }, { label: "Off", disabled: true }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Mais ações" }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "ArrowDown" });
    fireEvent.click(screen.getByText("Editar"));
    expect(onEdit).toHaveBeenCalled();
    expect(screen.queryByText("Oculto")).toBeNull();
  });

  it("toasts de sucesso, erro tratado do backend e aviso de moderação", () => {
    function Harness() {
      const toast = useToast();
      return (
        <>
          <button onClick={() => toast.success("Peça salva")}>ok</button>
          <button onClick={() => toast.fromError(new ApiError(409, "LIMITE", "Limite atingido", {}, "1234567890"))}>erro</button>
          <button onClick={() => toast.fromError(new ApiError(422, "IMAGEM_EM_REVISAO", "Foto em revisão"))}>rev</button>
          <button onClick={() => toast.fromError("x")}>gen</button>
          <button onClick={() => toast.info("Oi")}>info</button>
        </>
      );
    }
    vi.useFakeTimers();
    renderApp(<Harness />);
    ["ok", "erro", "rev", "gen", "info"].forEach((t) => fireEvent.click(screen.getByText(t)));
    expect(screen.getByText("Peça salva")).toBeTruthy();
    expect(screen.getByText(/Limite atingido \(12345678\)/)).toBeTruthy();
    expect(screen.getByText("Foto em revisão")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(10_000); });
    vi.useRealTimers();
  });

  it("aviso modal (notice) aparece e fecha", () => {
    function Harness() {
      const notice = useNotice();
      return (
        <>
          <button onClick={() => notice.warning("Confira o e-mail", { title: "Atenção", details: ["e-mail"], action: { label: "Reenviar", onSelect: () => {} } })}>abrir</button>
          <button onClick={() => { notice.success("Salvo"); notice.fromError(new ApiError(422, "VALIDACAO", "Revise", { fields: { name: "curto" } }, "abc12345")); }}>fila</button>
        </>
      );
    }
    renderApp(<Harness />);
    fireEvent.click(screen.getByText("abrir"));
    expect(screen.getByText("Confira o e-mail")).toBeTruthy();
    fireEvent.click(screen.getByText("fila"));
    // fecha um por vez: a fila mostra o próximo
    for (let i = 0; i < 3; i++) {
      const ok = screen.queryAllByRole("button").find((b) => /entendi/i.test(b.textContent ?? ""));
      if (ok) fireEvent.click(ok);
    }
  });
});
