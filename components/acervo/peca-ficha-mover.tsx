"use client";
/**
 * ACERVO — "Mover para…": a alternativa de teclado e de toque ao arrastar. Escolhe o compartimento numa lista e move a
 * peça; a mudança é gravada pela API.
 */
import { useEffect, useState } from "react";
import { Button, Field, Select } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { destinos } from "@/lib/acervo/arvore";
import type { AcervoPeca } from "@/lib/acervo/types";
import { useAcervo } from "./acervo-contexto";

const SEM_LUGAR = "";

export function PecaFichaMover({ peca }: { peca: AcervoPeca }) {
  const { t } = useI18n();
  const { dados } = useAcervo();
  const [destino, setDestino] = useState(peca.compartimentoId ?? SEM_LUGAR);
  const [movendo, setMovendo] = useState(false);

  useEffect(() => {
    setDestino(peca.compartimentoId ?? SEM_LUGAR);
  }, [peca.id, peca.compartimentoId]);

  if (!dados.arvore) return null;
  const opcoes = destinos(dados.arvore);
  const mudou = destino !== (peca.compartimentoId ?? SEM_LUGAR);

  async function mover() {
    setMovendo(true);
    const caminho = opcoes.find((o) => o.id === destino)?.caminho;
    const aviso = caminho ? t("acervo.mover.feitoPara", { nome: peca.name, lugar: caminho }) : t("acervo.mover.feitoSemLugar", { nome: peca.name });
    await dados.mover([peca.id], destino || null, aviso);
    setMovendo(false);
  }

  return (
    <div className="acv-ficha-mover">
      <Field label={t("acervo.mover.titulo")} id={`acv-mover-${peca.id}`} hint={opcoes.length === 0 ? t("acervo.mover.semCompartimentos") : undefined}>
        <Select id={`acv-mover-${peca.id}`} value={destino} onChange={(e) => setDestino(e.target.value)}>
          <option value={SEM_LUGAR}>{t("acervo.dir.semLugar")}</option>
          {opcoes.map((o) => <option key={o.id} value={o.id}>{o.caminho}</option>)}
        </Select>
      </Field>
      <Button variant="primary" size="sm" disabled={!mudou} loading={movendo} onClick={() => { void mover(); }}>{t("acervo.mover.confirmar")}</Button>
    </div>
  );
}
