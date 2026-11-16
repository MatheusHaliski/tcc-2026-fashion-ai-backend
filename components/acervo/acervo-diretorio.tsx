"use client";
/**
 * ACERVO — diretório lateral: Meu espaço e Dream Space → ambientes → móveis → cabideiros, prateleiras e gavetas, com a
 * contagem de peças. Escolher um compartimento lista as peças dele; soltar uma peça numa linha move a peça para lá.
 * Ambientes, móveis e compartimentos mudam de ordem pelo arrasto ou pelo menu da linha (use-ordem-do-diretorio.ts).
 */
import { useState, type DragEvent } from "react";
import { ActionMenu, type MenuItem } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { lerArrasto, temArrasto } from "@/lib/acervo/arrasto";
import type { AcervoAmbiente, AcervoCompartimento, AcervoModo, AcervoMovel } from "@/lib/acervo/types";
import { acervoApi } from "@/lib/acervo/api";
import type { NivelDeOrdem } from "@/lib/acervo/ordem";
import { useAcervo } from "./acervo-contexto";
import { EstruturaDialogo, type AlvoEstrutura, type PedidoEstrutura } from "./acervo-estrutura-dialogo";
import { AcervoIcone, type AcervoIconeNome } from "./acervo-icone";
import { useOrdemDoDiretorio } from "./use-ordem-do-diretorio";

const ICONE_TIPO: Record<AcervoCompartimento["tipo"], AcervoIconeNome> = { CABIDEIRO: "cabide", PRATELEIRA: "prateleira", GAVETA: "gaveta" };

export function AcervoDiretorio() {
  const { t } = useI18n();
  const { dados, tela, busca } = useAcervo();
  const [pedido, setPedido] = useState<PedidoEstrutura | null>(null);
  const [fechados, setFechados] = useState<string[]>([]);
  const [alvoDoArrasto, setAlvoDoArrasto] = useState<string | null>(null);
  const ordem = useOrdemDoDiretorio();
  const arvore = dados.arvore;
  if (!arvore) return null;

  const alternar = (id: string) => setFechados((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  const menu = (alvo: AlvoEstrutura, extras: MenuItem[] = []): MenuItem[] => [
    ...extras,
    { label: t("acervo.estrutura.renomear"), onSelect: () => setPedido({ acao: "RENOMEAR", alvo }) },
    { label: t("acervo.estrutura.apagar"), danger: true, onSelect: () => setPedido({ acao: "APAGAR", alvo }) },
  ];
  const soltar = (evento: DragEvent, compartimentoId: string | null) => {
    evento.preventDefault();
    setAlvoDoArrasto(null);
    void dados.mover(lerArrasto(evento), compartimentoId, t("acervo.mover.feito"));
  };
  const sobre = (evento: DragEvent, id: string) => {
    if (!temArrasto(evento)) return;
    evento.preventDefault();
    setAlvoDoArrasto(id);
  };

  const compartimento = (c: AcervoCompartimento, nivel: NivelDeOrdem) => {
    const atual = tela.local.tipo === "COMPARTIMENTO" && tela.local.id === c.id;
    const classes = ["acv-dir-linha", "is-folha", atual && "is-atual", busca.acesos.has(c.id) && "is-aceso", alvoDoArrasto === c.id && "is-alvo"];
    return (
      <li key={c.id} className="acv-dir-item" {...ordem.linha(nivel, c.id)}>
        <button type="button" className={classes.filter(Boolean).join(" ")} aria-current={atual ? "true" : undefined}
          onClick={() => tela.setLocal({ tipo: "COMPARTIMENTO", id: c.id })}
          onDragOver={(e) => sobre(e, c.id)} onDragLeave={() => setAlvoDoArrasto(null)} onDrop={(e) => soltar(e, c.id)}>
          <AcervoIcone nome={ICONE_TIPO[c.tipo]} tamanho={16} />
          <span className="acv-dir-nome">{c.nome}</span>
          <span className="acv-dir-conta" aria-label={t("acervo.pecas", { count: c.pecas })}>{c.pecas}</span>
        </button>
        <ActionMenu label={t("acervo.estrutura.opcoesDe", { nome: c.nome })} items={menu({ classe: "COMPARTIMENTO", id: c.id, nome: c.nome }, ordem.menu(nivel, c.id))} />
      </li>
    );
  };

  const movel = (m: AcervoMovel, nivel: NivelDeOrdem) => {
    const aberto = !fechados.includes(m.id);
    const ids = m.compartimentos.map((c) => c.id);
    const nivelDosCompartimentos: NivelDeOrdem = {
      chave: `compartimentos-${m.id}`, todos: ids, visiveis: ids, salvar: (novos) => acervoApi.ordenarCompartimentos(m.id, novos),
    };
    return (
      <li key={m.id} {...ordem.linha(nivel, m.id)}>
        <div className="acv-dir-item">
          <button type="button" className="acv-dir-linha" aria-expanded={aberto} onClick={() => alternar(m.id)}>
            <AcervoIcone nome="armario" tamanho={16} />
            <span className="acv-dir-nome">{m.nome}</span>
            <span className="acv-dir-conta" aria-label={t("acervo.pecas", { count: m.pecas })}>{m.pecas}</span>
          </button>
          <ActionMenu label={t("acervo.estrutura.opcoesDe", { nome: m.nome })} items={menu({ classe: "MOVEL", id: m.id, nome: m.nome }, [
            { label: t("acervo.estrutura.novoCompartimento"), onSelect: () => setPedido({ acao: "NOVO_COMPARTIMENTO", movelId: m.id }) },
            ...ordem.menu(nivel, m.id),
          ])} />
        </div>
        {aberto && <ul className="acv-dir-lista is-nivel3">{m.compartimentos.map((c) => compartimento(c, nivelDosCompartimentos))}</ul>}
      </li>
    );
  };

  const ambiente = (a: AcervoAmbiente, modo: AcervoModo, nivel: NivelDeOrdem) => {
    const doModo = a.moveis.filter((m) => m.modo === modo);
    const nivelDosMoveis: NivelDeOrdem = {
      chave: `moveis-${modo}-${a.id}`, todos: a.moveis.map((m) => m.id), visiveis: doModo.map((m) => m.id),
      salvar: (novos) => acervoApi.ordenarMoveis(a.id, novos),
    };
    return (
      <li key={`${modo}-${a.id}`} {...ordem.linha(nivel, a.id)}>
        <div className="acv-dir-item">
          <span className="acv-dir-linha is-titulo">
            <AcervoIcone nome="cabide" tamanho={16} />
            <span className="acv-dir-nome">{a.nome}</span>
          </span>
          <ActionMenu label={t("acervo.estrutura.opcoesDe", { nome: a.nome })} items={menu({ classe: "AMBIENTE", id: a.id, nome: a.nome }, [
            { label: t("acervo.estrutura.novoMovel"), hidden: modo !== "MEU_ESPACO", onSelect: () => setPedido({ acao: "NOVO_MOVEL", ambienteId: a.id, modo }) },
            { label: t("acervo.estrutura.novoModulo"), onSelect: () => setPedido({ acao: "NOVO_MOVEL", ambienteId: a.id, modo: "DREAM_SPACE" }) },
            ...ordem.menu(nivel, a.id),
          ])} />
        </div>
        <ul className="acv-dir-lista is-nivel2">{doModo.map((m) => movel(m, nivelDosMoveis))}</ul>
      </li>
    );
  };

  const raiz = (modo: AcervoModo, icone: AcervoIconeNome, titulo: string) => {
    const ambientes = arvore.ambientes.filter((a) => modo === "MEU_ESPACO" || a.moveis.some((m) => m.modo === modo));
    const nivelDosAmbientes: NivelDeOrdem = {
      chave: `ambientes-${modo}`, todos: arvore.ambientes.map((a) => a.id), visiveis: ambientes.map((a) => a.id),
      salvar: (novos) => acervoApi.ordenarAmbientes(novos),
    };
    return (
      <section className="acv-dir-raiz" aria-label={titulo}>
        <h3 className="acv-dir-cabeca"><AcervoIcone nome={icone} />{titulo}</h3>
        {ambientes.length === 0 && <p className="acv-dir-vazio">{t(modo === "DREAM_SPACE" ? "acervo.dir.semDream" : "acervo.dir.semAmbiente")}</p>}
        <ul className="acv-dir-lista">{ambientes.map((a) => ambiente(a, modo, nivelDosAmbientes))}</ul>
        {modo === "DREAM_SPACE" && arvore.ambientes.length > 0 && (
          <button type="button" className="acv-dir-novo" onClick={() => setPedido({ acao: "NOVO_MOVEL", ambienteId: null, modo })}>
            {t("acervo.estrutura.novoModulo")}
          </button>
        )}
      </section>
    );
  };

  const fixo = (tipo: "TODAS" | "SEM_LUGAR", rotulo: string, total: number) => (
    <button type="button" className={`acv-dir-linha is-fixo${tela.local.tipo === tipo ? " is-atual" : ""}${alvoDoArrasto === tipo ? " is-alvo" : ""}`}
      aria-current={tela.local.tipo === tipo ? "true" : undefined} onClick={() => tela.setLocal({ tipo })}
      onDragOver={tipo === "SEM_LUGAR" ? (e) => sobre(e, tipo) : undefined} onDragLeave={() => setAlvoDoArrasto(null)}
      onDrop={tipo === "SEM_LUGAR" ? (e) => soltar(e, null) : undefined}>
      <span className="acv-dir-nome">{rotulo}</span>
      <span className="acv-dir-conta">{total}</span>
    </button>
  );

  return (
    <nav className="acv-dir" aria-label={t("acervo.dir.titulo")}>
      {fixo("TODAS", t("acervo.dir.todas"), arvore.total)}
      {fixo("SEM_LUGAR", t("acervo.dir.semLugar"), arvore.semLugar)}
      {raiz("MEU_ESPACO", "casa", t("acervo.modo.meuEspaco"))}
      {raiz("DREAM_SPACE", "brilho", t("acervo.modo.dreamSpace"))}
      <button type="button" className="acv-dir-novo" onClick={() => setPedido({ acao: "NOVO_AMBIENTE" })}>
        {t("acervo.estrutura.novoAmbiente")}
      </button>
      <EstruturaDialogo pedido={pedido} onClose={() => setPedido(null)} />
    </nav>
  );
}
