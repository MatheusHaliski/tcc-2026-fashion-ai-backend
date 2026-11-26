"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { ReferenceOption } from "@/lib/api/types";
import type { InstitutionalReferenceSource } from "@/lib/api/institutional-reference";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, useNotice } from "@/components/ui";
import { ReferenceSelectField } from "@/components/reference-select-field";

type Kind = "MARCA" | "CELEBRIDADE";

/** O que muda entre os dois perfis: a rota das opções, a do PATCH e os nomes dos campos. */
const CONFIG = {
  MARCA: { id: "categoriaMarcaId", clear: "clearCategoriaMarca", options: "/api/opcoes/categorias-marca", patch: "/api/me/brand-profile", messages: "institutionalReference.categoriaMarca", read: (h: InstitutionalReferenceSource) => h.categoriaPrincipal ?? null },
  CELEBRIDADE: { id: "areaArtisticaId", clear: "clearAreaArtistica", options: "/api/opcoes/areas-artisticas", patch: "/api/me/celebrity-profile", messages: "institutionalReference.areaArtistica", read: (h: InstitutionalReferenceSource) => h.areaPrincipal ?? null },
} as const;

/**
 * Categoria principal da marca (exercício 09) e área artística principal da celebridade (exercício 10) no Editar
 * perfil. O valor é o UUID da opção, gravado como FK no perfil da própria sessão; o texto/lista antigos do cadastro
 * aparecem ao lado, só para leitura, e não são convertidos. A escolha só vale depois da resposta do servidor: enquanto
 * as opções carregam ou falham, o que já estava salvo continua na tela.
 */
export function InstitutionalReferenceField({ kind, userId }: { kind: Kind; userId: string }) {
  const { t } = useI18n();
  const notice = useNotice();
  const cfg = CONFIG[kind];
  const { data, loading, error, reload } = useApi<{ header: InstitutionalReferenceSource }>((signal) => api.get(`/api/institutional/${encodeURIComponent(userId)}`, { signal }), [userId]);
  const [saved, setSaved] = useState<ReferenceOption | null>(null);
  const [value, setValue] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!data) return;
    const atual = cfg.read(data.header);
    setSaved(atual);
    setValue(atual?.id ?? "");
  }, [data, cfg]);

  if (error) {
    return <div role="alert" className="flex flex-wrap items-center gap-2"><span className="error-text">{t(`${cfg.messages}.profileError`)}</span><Button type="button" size="sm" onClick={reload}>{t("common.retry")}</Button></div>;
  }
  if (loading || !data) return <p role="status" className="help">{t("common.loading")}</p>;

  const header = data.header;
  const legado = kind === "MARCA" ? (header.category ?? header.fashionCategory ?? "") : (header.areas ?? []).join(", ");
  const changed = value !== (saved?.id ?? "");
  async function save() {
    setSaving(true); setFieldError(undefined);
    try {
      const card = await api.patch<InstitutionalReferenceSource>(cfg.patch, value ? { [cfg.id]: value } : { [cfg.clear]: true });
      const atual = cfg.read(card);
      setSaved(atual); setValue(atual?.id ?? "");
      notice.success(t(`${cfg.messages}.saved`));
    } catch (e) {
      // a escolha fica no campo para corrigir ou tentar de novo; o valor salvo continua o anterior
      setFieldError((e as { fields?: Record<string, string>; message?: string }).fields?.[cfg.id] ?? (e as Error).message);
      notice.fromError(e);
    } finally { setSaving(false); }
  }
  return (
    <div className="grid gap-2" data-institutional-reference={kind} data-saved-id={saved?.id ?? ""}>
      <ReferenceSelectField id={cfg.id} path={cfg.options} messages={cfg.messages} value={value} selectedName={saved?.id === value ? saved?.nome : null}
        onChange={(id) => { setValue(id); setFieldError(undefined); }} error={fieldError} disabled={saving} />
      {legado && <p className="help" data-institutional-legacy>{t(`${cfg.messages}.legacy`, { value: legado })}</p>}
      <div><Button type="button" size="sm" variant="primary" loading={saving} disabled={!changed} onClick={save}>{t(`${cfg.messages}.save`)}</Button></div>
    </div>
  );
}
