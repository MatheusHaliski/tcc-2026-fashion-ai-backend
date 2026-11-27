"use client";
/** Os filtros da busca de adversários além da relação: nível FLAIR mínimo, estilo, país, cidade, ativa e deck para o jogo. */
import { Field, Input, Select, Switch } from "@/components/ui";
import { ESTILOS, NIVEIS } from "@/lib/flair/multi/filtros";
import type { FiltrosAdversario } from "@/lib/flair/multi/types";
import { useI18n } from "@/lib/i18n/i18n";

interface Props {
  filtros: FiltrosAdversario;
  jogo: string | null;
  onMudar: (parte: Partial<FiltrosAdversario>) => void;
}

export function FiltrosDaBusca({ filtros, jogo, onMudar }: Props) {
  const { t } = useI18n();
  return (
    <div className="fm-filtros" data-testid="fm-filtros">
      <Field label={t("flair3d.multi.filtro.nivel")} id="fm-nivel">
        <Select id="fm-nivel" value={filtros.nivel ?? ""} onChange={(e) => onMudar({ nivel: e.target.value || undefined })}>
          <option value="">{t("flair3d.multi.filtro.qualquer")}</option>
          {NIVEIS.map((n) => <option key={n} value={n}>{t(`flair3d.multi.nivel.${n}`)}</option>)}
        </Select>
      </Field>
      <Field label={t("flair3d.multi.filtro.estilo")} id="fm-estilo">
        <Select id="fm-estilo" value={filtros.estilo ?? ""} onChange={(e) => onMudar({ estilo: e.target.value || undefined })}>
          <option value="">{t("flair3d.multi.filtro.qualquer")}</option>
          {ESTILOS.map((s) => <option key={s} value={s}>{t(`flair3d.multi.estilo.${s}`)}</option>)}
        </Select>
      </Field>
      <Field label={t("flair3d.multi.filtro.pais")} id="fm-pais">
        <Input id="fm-pais" maxLength={2} value={filtros.pais ?? ""} placeholder="BR" onChange={(e) => onMudar({ pais: e.target.value })} />
      </Field>
      <Field label={t("flair3d.multi.filtro.cidade")} id="fm-cidade">
        <Input id="fm-cidade" value={filtros.cidade ?? ""} onChange={(e) => onMudar({ cidade: e.target.value })} />
      </Field>
      <Switch checked={!!filtros.ativo} onChange={(v) => onMudar({ ativo: v })} label={t("flair3d.multi.filtro.ativo")} />
      {jogo && <Switch checked={!!filtros.comDeck} onChange={(v) => onMudar({ comDeck: v })} label={t("flair3d.multi.filtro.comDeck")} />}
    </div>
  );
}
