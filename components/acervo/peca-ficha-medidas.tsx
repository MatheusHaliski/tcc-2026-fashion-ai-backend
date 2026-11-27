"use client";
/** ACERVO — medidas que a dona anotou para a peça (largura, comprimento e uma nota), em centímetros. */
import { useEffect, useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { acervoApi } from "@/lib/acervo/api";
import type { AcervoPeca } from "@/lib/acervo/types";
import { useAcervo } from "./acervo-contexto";
import { lerPreco } from "./desejo-form";

const texto = (valor: number | null) => (valor === null ? "" : String(valor).replace(".", ","));

/** "52 × 71 cm · Ombro 44", ou nulo quando nada foi anotado. */
export function resumoDasMedidas(peca: AcervoPeca, fmt: (n: number) => string): string | null {
  const { larguraCm, comprimentoCm, nota } = peca.medidas;
  const partes: string[] = [];
  if (larguraCm !== null && comprimentoCm !== null) partes.push(`${fmt(larguraCm)} × ${fmt(comprimentoCm)} cm`);
  else if (larguraCm !== null) partes.push(`${fmt(larguraCm)} cm`);
  else if (comprimentoCm !== null) partes.push(`${fmt(comprimentoCm)} cm`);
  if (nota) partes.push(nota);
  return partes.length > 0 ? partes.join(" · ") : null;
}

export function PecaFichaMedidas({ peca }: { peca: AcervoPeca }) {
  const { t } = useI18n();
  const { dados } = useAcervo();
  const [largura, setLargura] = useState("");
  const [comprimento, setComprimento] = useState("");
  const [nota, setNota] = useState("");

  useEffect(() => {
    setLargura(texto(peca.medidas.larguraCm));
    setComprimento(texto(peca.medidas.comprimentoCm));
    setNota(peca.medidas.nota ?? "");
  }, [peca.id, peca.medidas.larguraCm, peca.medidas.comprimentoCm, peca.medidas.nota]);

  const l = lerPreco(largura);
  const c = lerPreco(comprimento);
  const invalido = [l, c].some((valor) => Number.isNaN(valor) || (valor !== null && (valor <= 0 || valor >= 1000)));

  function salvar() {
    void dados.executar(() => acervoApi.medidas(peca.id, { larguraCm: l, comprimentoCm: c, nota: nota.trim() || null }), t("acervo.medidas.salvo"));
  }

  return (
    <details className="acv-ficha-medidas">
      <summary>{t("acervo.medidas.editar")}</summary>
      <div className="acv-form is-duas">
        <Field label={t("acervo.medidas.largura")} id={`acv-m-l-${peca.id}`}>
          <Input id={`acv-m-l-${peca.id}`} inputMode="decimal" value={largura} error={Number.isNaN(l)} onChange={(e) => setLargura(e.target.value)} />
        </Field>
        <Field label={t("acervo.medidas.comprimento")} id={`acv-m-c-${peca.id}`}>
          <Input id={`acv-m-c-${peca.id}`} inputMode="decimal" value={comprimento} error={Number.isNaN(c)} onChange={(e) => setComprimento(e.target.value)} />
        </Field>
      </div>
      <Field label={t("acervo.medidas.nota")} id={`acv-m-n-${peca.id}`} error={invalido ? t("acervo.medidas.invalido") : undefined}>
        <Input id={`acv-m-n-${peca.id}`} value={nota} maxLength={160} onChange={(e) => setNota(e.target.value)} />
      </Field>
      <Button size="sm" disabled={invalido} loading={dados.ocupado} onClick={salvar}>{t("acervo.medidas.salvar")}</Button>
    </details>
  );
}
