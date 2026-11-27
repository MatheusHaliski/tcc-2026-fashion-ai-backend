"use client";
/**
 * ACERVO — janelas da estrutura: criar ambiente, móvel (armário de "Meu espaço" ou módulo do Dream Space) ou
 * compartimento, renomear e apagar. Apagar avisa que as peças não somem: ficam sem lugar. O módulo pedido sem ambiente
 * (pelo Dream Space do diretório) pergunta em qual ambiente ele entra.
 */
import { useEffect, useState } from "react";
import { Button, Dialog, Field, Input, Select } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { acervoApi } from "@/lib/acervo/api";
import { chaveTipo, movelPadrao, TIPOS } from "@/lib/acervo/opcoes";
import type { AcervoModo, AcervoTipo } from "@/lib/acervo/types";
import { useAcervo } from "./acervo-contexto";

export type AlvoEstrutura = { classe: "AMBIENTE" | "MOVEL" | "COMPARTIMENTO"; id: string; nome: string };
export type PedidoEstrutura =
  | { acao: "NOVO_AMBIENTE" }
  | { acao: "NOVO_MOVEL"; ambienteId: string | null; modo: AcervoModo }
  | { acao: "NOVO_COMPARTIMENTO"; movelId: string }
  | { acao: "RENOMEAR"; alvo: AlvoEstrutura }
  | { acao: "APAGAR"; alvo: AlvoEstrutura };

/** Limite do nome na API (AcervoRegras): acima disso o servidor recusa, não corta. */
const NOME_MAX = 80;

const TITULO: Record<PedidoEstrutura["acao"], string> = {
  NOVO_AMBIENTE: "acervo.estrutura.novoAmbiente",
  NOVO_MOVEL: "acervo.estrutura.novoMovel",
  NOVO_COMPARTIMENTO: "acervo.estrutura.novoCompartimento",
  RENOMEAR: "acervo.estrutura.renomear",
  APAGAR: "acervo.estrutura.apagar",
};

export function EstruturaDialogo({ pedido, onClose }: { pedido: PedidoEstrutura | null; onClose: () => void }) {
  const { t } = useI18n();
  const { dados } = useAcervo();
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<AcervoTipo>("GAVETA");
  const [ambienteId, setAmbienteId] = useState("");
  const ambientes = dados.arvore?.ambientes ?? [];

  useEffect(() => {
    setNome(pedido?.acao === "RENOMEAR" ? pedido.alvo.nome : pedido ? nomeSugerido(pedido) : "");
    setTipo("GAVETA");
    setAmbienteId(pedido?.acao === "NOVO_MOVEL" ? pedido.ambienteId ?? ambientes[0]?.id ?? "" : "");
    // o nome sugerido e o ambiente inicial valem para o pedido que acabou de abrir
  }, [pedido]); // eslint-disable-line react-hooks/exhaustive-deps

  function nomeSugerido(p: PedidoEstrutura): string {
    if (p.acao !== "NOVO_MOVEL" || p.modo !== "DREAM_SPACE") return "";
    const modulos = ambientes.flatMap((a) => a.moveis).filter((m) => m.modo === "DREAM_SPACE").length;
    return t("acervo.dream.nomeModulo", { n: modulos + 1 });
  }

  if (!pedido) return null;
  const apagar = pedido.acao === "APAGAR";
  // compartimento pode ficar sem nome: ao criar ou renomear, o servidor devolve o nome padrão do tipo ("Gaveta 2")
  const nomeOpcional = pedido.acao === "NOVO_COMPARTIMENTO" || (pedido.acao === "RENOMEAR" && pedido.alvo.classe === "COMPARTIMENTO");
  const precisaNome = !apagar && !nomeOpcional;
  const escolheAmbiente = pedido.acao === "NOVO_MOVEL" && pedido.ambienteId === null;
  const valido = (!precisaNome || nome.trim().length > 0) && (!escolheAmbiente || ambienteId !== "");

  async function enviar() {
    if (!pedido || !valido) return;
    const limpo = nome.trim();
    const pedidoCompleto = pedido.acao === "NOVO_MOVEL" ? { ...pedido, ambienteId } : pedido;
    const ok = await dados.executar(() => acao(pedidoCompleto, limpo, tipo), t(apagar ? "acervo.estrutura.apagado" : "acervo.estrutura.salvo"));
    if (ok) onClose();
  }

  return (
    <Dialog open onClose={onClose} title={t(pedido.acao === "NOVO_MOVEL" && pedido.modo === "DREAM_SPACE" ? "acervo.estrutura.novoModulo" : TITULO[pedido.acao])} role={apagar ? "alertdialog" : "dialog"}
      footer={<>
        <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="primary" disabled={!valido} loading={dados.ocupado} onClick={() => { void enviar(); }}>
          {t(apagar ? "acervo.estrutura.confirmarApagar" : "common.save")}
        </Button>
      </>}>
      {apagar && <p className="type-body">{t("acervo.estrutura.apagarAviso", { nome: pedido.alvo.nome })}</p>}
      {escolheAmbiente && (
        <Field label={t("acervo.estrutura.ambiente")} id="acv-ambiente">
          <Select id="acv-ambiente" value={ambienteId} onChange={(e) => setAmbienteId(e.target.value)}>
            {ambientes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
        </Field>
      )}
      {pedido.acao === "NOVO_COMPARTIMENTO" && (
        <Field label={t("acervo.estrutura.tipo")} id="acv-tipo">
          <Select id="acv-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as AcervoTipo)}>
            {TIPOS.map((opcao) => <option key={opcao} value={opcao}>{t(chaveTipo(opcao))}</option>)}
          </Select>
        </Field>
      )}
      {!apagar && (
        <Field label={t("acervo.estrutura.nome")} id="acv-nome" required={precisaNome}
          hint={pedido.acao === "NOVO_COMPARTIMENTO" ? t("acervo.estrutura.nomeOpcional") : nomeOpcional ? t("acervo.estrutura.nomeVazioPadrao") : undefined}>
          <Input id="acv-nome" value={nome} maxLength={NOME_MAX} autoFocus aria-describedby="acv-nome-limite" onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void enviar(); }} />
          <p id="acv-nome-limite" className="help tabular">{t("acervo.estrutura.nomeLimite", { n: nome.length, max: NOME_MAX })}</p>
        </Field>
      )}
    </Dialog>
  );
}

function acao(pedido: PedidoEstrutura, nome: string, tipo: AcervoTipo): Promise<unknown> {
  switch (pedido.acao) {
    case "NOVO_AMBIENTE":
      return acervoApi.criarAmbiente(nome);
    case "NOVO_MOVEL":
      return acervoApi.criarMovel(pedido.ambienteId ?? "", movelPadrao(pedido.modo, nome));
    case "NOVO_COMPARTIMENTO":
      return acervoApi.criarCompartimento(pedido.movelId, tipo, nome || undefined);
    case "RENOMEAR":
      return renomear(pedido.alvo, nome);
    case "APAGAR":
      return apagar(pedido.alvo);
  }
}

function renomear(alvo: AlvoEstrutura, nome: string): Promise<unknown> {
  if (alvo.classe === "AMBIENTE") return acervoApi.renomearAmbiente(alvo.id, nome);
  if (alvo.classe === "MOVEL") return acervoApi.atualizarMovel(alvo.id, { nome });
  return acervoApi.renomearCompartimento(alvo.id, nome);
}

function apagar(alvo: AlvoEstrutura): Promise<unknown> {
  if (alvo.classe === "AMBIENTE") return acervoApi.apagarAmbiente(alvo.id);
  if (alvo.classe === "MOVEL") return acervoApi.apagarMovel(alvo.id);
  return acervoApi.apagarCompartimento(alvo.id);
}
