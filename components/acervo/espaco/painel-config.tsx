"use client";
/**
 * ACERVO — configuração do móvel: medidas em centímetros, quantidade de cabideiros, prateleiras e gavetas, material,
 * cor, porta e puxador. Cada mudança é gravada e a cena se refaz com o móvel novo.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { Field, Input, Select } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { acervoApi } from "@/lib/acervo/api";
import {
  ACABAMENTOS, ACABAMENTO_HEX, chaveAcabamento, chaveCor, chaveMaterial, chavePorta, chavePuxador, COR_HEX, CORES, LIMITES, MATERIAIS,
  PORTAS, PUXADORES,
} from "@/lib/acervo/opcoes";
import type { AcervoMovel, AcervoMovelForm, AcervoTipo } from "@/lib/acervo/types";
import { useAcervo } from "../acervo-contexto";
import { AcervoIcone } from "../acervo-icone";

type Medida = "larguraCm" | "alturaCm" | "profundidadeCm";
type Quantidade = "cabideiros" | "prateleiras" | "gavetas";
const MEDIDAS: Medida[] = ["larguraCm", "alturaCm", "profundidadeCm"];
const QUANTIDADES: [Quantidade, AcervoTipo][] = [["cabideiros", "CABIDEIRO"], ["prateleiras", "PRATELEIRA"], ["gavetas", "GAVETA"]];

export function PainelConfig({ movel, resumo }: { movel: AcervoMovel; resumo: string }) {
  const { t } = useI18n();
  const { dados } = useAcervo();
  const [medidas, setMedidas] = useState<Record<Medida, string>>({ larguraCm: "", alturaCm: "", profundidadeCm: "" });

  useEffect(() => {
    setMedidas({ larguraCm: String(movel.larguraCm), alturaCm: String(movel.alturaCm), profundidadeCm: String(movel.profundidadeCm) });
  }, [movel.id, movel.larguraCm, movel.alturaCm, movel.profundidadeCm]);

  const gravar = (form: AcervoMovelForm) => {
    void dados.executar(() => acervoApi.atualizarMovel(movel.id, form));
  };
  const foraDoLimite = (campo: Medida) => {
    const valor = Number(medidas[campo]);
    return !Number.isInteger(valor) || valor < LIMITES[campo][0] || valor > LIMITES[campo][1];
  };
  const gravarMedida = (campo: Medida) => {
    if (foraDoLimite(campo) || Number(medidas[campo]) === movel[campo]) return;
    gravar({ [campo]: Number(medidas[campo]) });
  };
  const quantos = (tipo: AcervoTipo) => movel.compartimentos.filter((c) => c.tipo === tipo).length;
  const amostra = (cor: string) => <span className="acv-amostra" style={{ "--acv-amostra": cor } as CSSProperties} aria-hidden />;

  return (
    <section className="acv-cartao acv-config" aria-label={t("acervo.config.titulo", { nome: movel.nome })}>
      <h3 className="acv-cartao-titulo"><AcervoIcone nome="armario" />{movel.nome}</h3>
      <ul className="acv-config-resumo">
        <li><AcervoIcone nome="gaveta" tamanho={16} />{resumo}</li>
        <li>{amostra(COR_HEX[movel.cor].base)}{t("common.color")} · {t(chaveCor(movel.cor))}</li>
        <li>{amostra(ACABAMENTO_HEX[movel.puxadorAcabamento])}{t("acervo.config.puxador")} · {t(chaveAcabamento(movel.puxadorAcabamento))}</li>
      </ul>
      <div className="acv-form">
        {MEDIDAS.map((campo) => (
          <Field key={campo} label={t(`acervo.config.${campo}`)} id={`acv-c-${campo}`}
            error={foraDoLimite(campo) ? t("acervo.config.limite", { min: LIMITES[campo][0], max: LIMITES[campo][1] }) : undefined}>
            <Input id={`acv-c-${campo}`} type="number" inputMode="numeric" min={LIMITES[campo][0]} max={LIMITES[campo][1]} value={medidas[campo]}
              error={foraDoLimite(campo)} onChange={(e) => setMedidas((atual) => ({ ...atual, [campo]: e.target.value }))}
              onBlur={() => gravarMedida(campo)} onKeyDown={(e) => { if (e.key === "Enter") gravarMedida(campo); }} />
          </Field>
        ))}
      </div>
      <div className="acv-form is-tres">
        {QUANTIDADES.map(([campo, tipo]) => (
          <Field key={campo} label={t(`acervo.config.${campo}`)} id={`acv-c-${campo}`}>
            <Select id={`acv-c-${campo}`} value={String(quantos(tipo))} onChange={(e) => gravar({ [campo]: Number(e.target.value) })}>
              {Array.from({ length: LIMITES.porTipo + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </Field>
        ))}
      </div>
      <div className="acv-form">
        <Field label={t("acervo.config.material")} id="acv-c-material">
          <Select id="acv-c-material" value={movel.material} onChange={(e) => gravar({ material: e.target.value as AcervoMovel["material"] })}>
            {MATERIAIS.map((v) => <option key={v} value={v}>{t(chaveMaterial(v))}</option>)}
          </Select>
        </Field>
        <Field label={t("common.color")} id="acv-c-cor">
          <Select id="acv-c-cor" value={movel.cor} onChange={(e) => gravar({ cor: e.target.value as AcervoMovel["cor"] })}>
            {CORES.map((v) => <option key={v} value={v}>{t(chaveCor(v))}</option>)}
          </Select>
        </Field>
        <Field label={t("acervo.config.porta")} id="acv-c-porta">
          <Select id="acv-c-porta" value={movel.porta} onChange={(e) => gravar({ porta: e.target.value as AcervoMovel["porta"] })}>
            {PORTAS.map((v) => <option key={v} value={v}>{t(chavePorta(v))}</option>)}
          </Select>
        </Field>
        <Field label={t("acervo.config.puxador")} id="acv-c-puxador">
          <Select id="acv-c-puxador" value={movel.puxador} onChange={(e) => gravar({ puxador: e.target.value as AcervoMovel["puxador"] })}>
            {PUXADORES.map((v) => <option key={v} value={v}>{t(chavePuxador(v))}</option>)}
          </Select>
        </Field>
        <Field label={t("acervo.config.acabamento")} id="acv-c-acabamento">
          <Select id="acv-c-acabamento" value={movel.puxadorAcabamento}
            onChange={(e) => gravar({ puxadorAcabamento: e.target.value as AcervoMovel["puxadorAcabamento"] })}>
            {ACABAMENTOS.map((v) => <option key={v} value={v}>{t(chaveAcabamento(v))}</option>)}
          </Select>
        </Field>
      </div>
      <p className="acv-dica">{t("acervo.config.dica")}</p>
    </section>
  );
}
