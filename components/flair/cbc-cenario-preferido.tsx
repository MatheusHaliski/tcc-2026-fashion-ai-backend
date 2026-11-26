"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api/client";
import type { ReferenceOption } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { temCenaDoCenario } from "@/lib/flair/cenas/catalogo";
import { useToast } from "@/components/ui";
import { ReferenceSelectField } from "@/components/reference-select-field";

/**
 * Exercício 16 — cenário que a pessoa prefere ver num Desafio de Montagem. É só dela e só troca a cena: o desafio, os
 * requisitos, as vagas, os pontos e as entregas continuam os mesmos. As opções vêm do servidor (só os cenários
 * permitidos naquele desafio); um cenário cadastrado que a tela ainda não sabe desenhar fica indisponível.
 */
interface Preference { challengeId: string; officialScenario: string; scenario: ReferenceOption | null }
type Preferidos = Record<string, ReferenceOption>;
const Contexto = createContext<Preferidos>({});

/** Código da cena a desenhar: o preferido, quando a tela sabe desenhá-lo; senão o oficial do desafio. */
export const cenarioVisivel = (preferido: ReferenceOption | null | undefined, oficial: string) =>
  preferido && temCenaDoCenario(preferido.codigo) ? preferido.codigo : oficial;

/** Lista de desafios: carrega as preferências da pessoa uma vez e as entrega aos cards. */
export function CbcPreferidos({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const mine = useApi<{ challengeId: string; scenario: ReferenceOption }[]>((signal) => api.get("/api/flair/challenge-preferences", { signal }), [user?.id], { enabled: !!user });
  const porDesafio = Object.fromEntries((mine.data ?? []).map((p) => [p.challengeId, p.scenario]));
  return <Contexto.Provider value={porDesafio}>{children}</Contexto.Provider>;
}
export const useCenarioPreferido = (challengeId: string): ReferenceOption | undefined => useContext(Contexto)[challengeId];

/** Escolha na tela do desafio. `onCodigo` recebe o código preferido (ou null = oficial) sempre que ele muda. */
export function CbcCenarioPreferido({ slug, onCodigo }: { slug: string; onCodigo: (codigo: string | null) => void }) {
  const { t } = useI18n(); const toast = useToast(); const { user } = useAuth();
  const base = `/api/flair/challenges/${encodeURIComponent(slug)}`;
  const pref = useApi<Preference>((signal) => api.get(`${base}/preference`, { signal }), [slug, user?.id], { enabled: !!user });
  const [saving, setSaving] = useState(false);
  const [semArte, setSemArte] = useState<string | null>(null);
  const atual = pref.data?.scenario ?? null;
  const codigo = atual && temCenaDoCenario(atual.codigo) ? atual.codigo : null;
  useEffect(() => { onCodigo(codigo); }, [codigo, onCodigo]);
  if (!user) return null;
  async function escolher(option: ReferenceOption | null) {
    setSemArte(null);
    if (option && !temCenaDoCenario(option.codigo)) { setSemArte(option.nome); return; }   // sem arte: não vira preferência
    setSaving(true);
    try {
      if (option) await api.put(`${base}/preference`, { scenarioId: option.id }); else await api.delete(`${base}/preference`);
      toast.success(t(option ? "cbc.cenarioPreferido.salvo" : "cbc.cenarioPreferido.oficial_de_volta"));
      pref.reload();
    } catch (e) { toast.fromError(e); } finally { setSaving(false); }
  }
  return (
    <div className="cbc-cenario-preferido mb-4 max-w-md" data-cbc-cenario={codigo ?? ""}>
      <ReferenceSelectField id="cbc-cenario" path={`${base}/scenarios`} messages="cbc.cenarioPreferido" stateAttr="cbc-cenario"
        value={atual?.id ?? ""} selectedName={atual?.nome} disabled={saving || pref.loading} onChange={() => {}} onSelect={escolher} />
      {semArte && <p role="status" className="error-text">{t("cbc.cenarioPreferido.sem_arte", { nome: semArte })}</p>}
      {pref.error && <p role="alert" className="error-text">{t("cbc.cenarioPreferido.erro_preferencia")}</p>}
    </div>
  );
}
