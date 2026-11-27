"use client";
/**
 * Seletor da qualidade gráfica das cenas 3D (Automática, Alta, Média, Baixa). Alta carrega as salas high poly no nível
 * alto, Média no médio, Baixa fica com a sala procedural; a escolha vale para todos os jogos e fica no navegador.
 */
import { usePreferenciaDeQualidade } from "@/components/flair/salas-altas/use-salas-altas";
import { useI18n } from "@/lib/i18n/i18n";
import { gravarPreferencia, PREFERENCIAS, type PreferenciaDeQualidade } from "@/lib/flair/salas-altas/preferencia";

export function SeletorDeQualidade({ className }: { className?: string }) {
  const { t } = useI18n();
  const atual = usePreferenciaDeQualidade();
  return (
    <label className={`n3d-camera-btn${className ? ` ${className}` : ""}`} data-testid="seletor-de-qualidade" data-qualidade={atual}>
      <span className="n3d-camera-nome">{t("flair3d.qualidade.rotulo")}</span>
      <select value={atual} aria-label={t("flair3d.qualidade.rotulo")}
        onChange={(ev) => gravarPreferencia(ev.target.value as PreferenciaDeQualidade)}>
        {PREFERENCIAS.map((p) => <option key={p} value={p}>{t(`flair3d.qualidade.${p}`)}</option>)}
      </select>
    </label>
  );
}
