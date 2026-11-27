"use client";
/**
 * ACERVO — luz do ambiente (exercício 07). O tipo de iluminação vem do GET /api/opcoes/tipos-iluminacao (o campo só
 * libera depois de carregar; erro tem "Tentar de novo") e a temperatura de cor vai de 2700 K a 6500 K. "Aplicar luz"
 * grava no ambiente e relê o acervo: a cena só muda com a luz confirmada pelo GET. Ambiente legado aparece como
 * "Sem classificação" e mantém a luz padrão.
 */
import { useEffect, useState } from "react";
import { ReferenceSelectField } from "@/components/reference-select-field";
import { Button, Field, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { acervoApi } from "@/lib/acervo/api";
import { KELVIN_MAX, KELVIN_MIN, KELVIN_PASSO, kelvinValido } from "@/lib/acervo/luz";
import type { AcervoAmbiente, AcervoLuzForm } from "@/lib/acervo/types";
import { useAcervo } from "../acervo-contexto";
import { AcervoIcone } from "../acervo-icone";

/** O PUT só leva o que mudou: campo esvaziado vira pedido explícito de limpar; o resto mantém o valor gravado. */
export function formDaLuz(tipo: string, kelvin: string, tipoAtual: string, kelvinAtual: string): AcervoLuzForm {
  const numero = kelvin.trim() === "" ? null : Number(kelvin);
  return {
    tipoIluminacaoId: tipo || null,
    temperaturaKelvin: numero,
    limparTipo: !tipo && !!tipoAtual,
    limparTemperatura: numero === null && kelvinAtual !== "",
  };
}

export function PainelLuz({ ambiente }: { ambiente: AcervoAmbiente }) {
  const { t } = useI18n();
  const { dados } = useAcervo();
  const atual = ambiente.iluminacao ?? null;
  const tipoAtual = atual?.tipo?.id ?? "";
  const kelvinAtual = atual?.temperaturaKelvin == null ? "" : String(atual.temperaturaKelvin);
  const [tipo, setTipo] = useState(tipoAtual);
  const [kelvin, setKelvin] = useState(kelvinAtual);

  useEffect(() => {
    setTipo(tipoAtual);
    setKelvin(kelvinAtual);
  }, [ambiente.id, tipoAtual, kelvinAtual]);

  const fora = kelvin.trim() !== "" && !kelvinValido(Number(kelvin));
  const mudou = tipo !== tipoAtual || kelvin.trim() !== kelvinAtual;
  const aplicar = () => {
    if (fora || !mudou) return;
    void dados.executar(() => acervoApi.iluminarAmbiente(ambiente.id, formDaLuz(tipo, kelvin, tipoAtual, kelvinAtual)), t("acervo.luz.feito"));
  };
  const resumo = !atual?.tipo && atual?.temperaturaKelvin == null
    ? t("acervo.luz.padrao")
    : t("acervo.luz.atual", {
      tipo: atual?.tipo?.nome ?? t("acervo.luz.tipo.unselected"),
      kelvin: atual?.temperaturaKelvin == null ? t("acervo.luz.semTemperatura") : `${atual.temperaturaKelvin} K`,
    });

  return (
    <section className="acv-cartao acv-luz" aria-label={t("acervo.luz.titulo", { ambiente: ambiente.nome })}
      data-luz-tipo={atual?.tipo?.codigo ?? ""} data-luz-kelvin={atual?.temperaturaKelvin ?? ""}>
      <h3 className="acv-cartao-titulo"><AcervoIcone nome="luz" />{t("acervo.luz.titulo", { ambiente: ambiente.nome })}</h3>
      <p className="acv-dica" role="status">{resumo}</p>
      {/* bloco simples: o campo de opções traz col-span-2, que abriria uma 2ª coluna na grade do cartão */}
      <div className="acv-luz-campos">
        <ReferenceSelectField id="acv-luz-tipo" path="/api/opcoes/tipos-iluminacao" messages="acervo.luz.tipo" value={tipo}
          selectedName={atual?.tipo?.nome} onChange={setTipo} disabled={dados.ocupado} />
        <Field id="acv-luz-kelvin" label={t("acervo.luz.temperatura")}
          hint={t("acervo.luz.temperaturaDica", { min: KELVIN_MIN, max: KELVIN_MAX })}
          error={fora ? t("acervo.luz.temperaturaFora", { min: KELVIN_MIN, max: KELVIN_MAX }) : undefined}>
          <Input id="acv-luz-kelvin" type="number" inputMode="numeric" min={KELVIN_MIN} max={KELVIN_MAX} step={KELVIN_PASSO} value={kelvin}
            placeholder={t("acervo.luz.semTemperatura")} error={fora} disabled={dados.ocupado}
            onChange={(e) => setKelvin(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") aplicar(); }} />
        </Field>
      </div>
      <Button variant="primary" className="acv-luz-aplicar" onClick={aplicar} disabled={!mudou || fora} loading={dados.ocupado}>{t("acervo.luz.aplicar")}</Button>
    </section>
  );
}
