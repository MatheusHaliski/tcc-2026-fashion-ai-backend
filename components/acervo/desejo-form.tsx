"use client";
/** ACERVO — formulário de um item da lista de desejos. O preço é sempre uma estimativa de quem preenche. */
import { useEffect, useState } from "react";
import { Button, Dialog, Field, Input, Select } from "@/components/ui";
import { CATEGORY_KEYS, label } from "@/lib/api/taxonomy";
import { useI18n } from "@/lib/i18n/i18n";
import { acervoApi } from "@/lib/acervo/api";
import { destinos } from "@/lib/acervo/arvore";
import type { AcervoDesejo, AcervoDesejoForm } from "@/lib/acervo/types";
import { useAcervo } from "./acervo-contexto";

const VAZIO = { nome: "", categoria: "upper_piece", cor: "", tamanho: "", marca: "", preco: "", compartimentoId: "" };

/** Lê "1.234,56" ou "1234.56"; nulo quando vazio, NaN quando não é número. */
export function lerPreco(texto: string): number | null {
  const limpo = texto.trim();
  if (!limpo) return null;
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  return /^\d+(\.\d+)?$/.test(normal) ? Number(normal) : Number.NaN;
}

export function DesejoFormDialog({ aberto, desejo, onClose }: { aberto: boolean; desejo: AcervoDesejo | null; onClose: () => void }) {
  const { t } = useI18n();
  const { dados } = useAcervo();
  const [campos, setCampos] = useState(VAZIO);

  useEffect(() => {
    if (!aberto) return;
    setCampos(desejo ? {
      nome: desejo.nome,
      categoria: desejo.categoria,
      cor: desejo.cor ?? "",
      tamanho: desejo.tamanho ?? "",
      marca: desejo.marca ?? "",
      preco: desejo.precoEstimado === null ? "" : String(desejo.precoEstimado).replace(".", ","),
      compartimentoId: desejo.compartimentoId ?? "",
    } : VAZIO);
  }, [aberto, desejo]);

  if (!aberto || !dados.arvore) return null;
  const preco = lerPreco(campos.preco);
  const precoInvalido = Number.isNaN(preco) || (preco !== null && preco < 0);
  const valido = campos.nome.trim().length > 0 && !precoInvalido;
  const mudar = (campo: keyof typeof VAZIO, valor: string) => setCampos((atual) => ({ ...atual, [campo]: valor }));

  async function salvar() {
    if (!valido) return;
    const form: AcervoDesejoForm = {
      nome: campos.nome.trim(),
      categoria: campos.categoria,
      cor: campos.cor.trim() || null,
      tamanho: campos.tamanho.trim() || null,
      marca: campos.marca.trim() || null,
      precoEstimado: preco,
      compartimentoId: campos.compartimentoId || null,
    };
    const ok = await dados.executar(() => (desejo ? acervoApi.atualizarDesejo(desejo.id, form) : acervoApi.criarDesejo(form)), t("acervo.desejos.salvo"));
    if (ok) onClose();
  }

  return (
    <Dialog open onClose={onClose} title={t(desejo ? "acervo.desejos.editar" : "acervo.desejos.novo")}
      footer={<>
        <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="primary" disabled={!valido} loading={dados.ocupado} onClick={() => { void salvar(); }}>{t("common.save")}</Button>
      </>}>
      <div className="acv-form">
        <Field label={t("acervo.desejos.nome")} id="acv-d-nome" required>
          <Input id="acv-d-nome" value={campos.nome} maxLength={120} onChange={(e) => mudar("nome", e.target.value)} />
        </Field>
        <Field label={t("common.category")} id="acv-d-categoria">
          <Select id="acv-d-categoria" value={campos.categoria} onChange={(e) => mudar("categoria", e.target.value)}>
            {CATEGORY_KEYS.map((c) => <option key={c} value={c}>{label(c)}</option>)}
          </Select>
        </Field>
        <Field label={t("common.color")} id="acv-d-cor">
          <Input id="acv-d-cor" value={campos.cor} maxLength={80} onChange={(e) => mudar("cor", e.target.value)} />
        </Field>
        <Field label={t("common.size")} id="acv-d-tamanho">
          <Input id="acv-d-tamanho" value={campos.tamanho} maxLength={40} onChange={(e) => mudar("tamanho", e.target.value)} />
        </Field>
        <Field label={t("common.brand")} id="acv-d-marca">
          <Input id="acv-d-marca" value={campos.marca} maxLength={160} onChange={(e) => mudar("marca", e.target.value)} />
        </Field>
        <Field label={t("acervo.desejos.preco")} id="acv-d-preco" hint={t("acervo.desejos.precoDica")}
          error={precoInvalido ? t("acervo.desejos.precoInvalido") : undefined}>
          <Input id="acv-d-preco" inputMode="decimal" value={campos.preco} error={precoInvalido} onChange={(e) => mudar("preco", e.target.value)} />
        </Field>
        <Field label={t("acervo.desejos.lugar")} id="acv-d-lugar" hint={t("acervo.desejos.lugarDica")}>
          <Select id="acv-d-lugar" value={campos.compartimentoId} onChange={(e) => mudar("compartimentoId", e.target.value)}>
            <option value="">{t("acervo.desejos.semLugar")}</option>
            {destinos(dados.arvore).map((d) => <option key={d.id} value={d.id}>{d.caminho}</option>)}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}
