"use client";
import { useReferenceOptions } from "@/lib/hooks/use-reference-options";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Field, Select } from "@/components/ui";

/** Props comuns dos campos de opções dos criadores (o valor é sempre o UUID da opção, nunca o nome). */
export interface ReferenceFieldProps {
  value: string;
  selectedName?: string | null;
  onChange: (id: string) => void;
  error?: string;
  disabled?: boolean;
  /** texto de ajuda; null esconde (no look o contexto já explica) */
  hint?: string | null;
}

/**
 * Campo de seleção de um catálogo de opções (conservação, lavagem, coleção, intensidade térmica, origem...), o mesmo
 * nos criadores de peça e de look. Para um campo novo: crie o GET de opções no backend e use este componente com o
 * caminho e o prefixo das mensagens (`<prefixo>.label|unselected|unavailable|loadError|empty|hint`); nada muda na
 * segurança. Receita em docs/correcoes/CRIADORES_ORIGEM_401.md.
 */
export function ReferenceSelectField({ id, path, messages, stateAttr, value, selectedName, onChange, error, disabled = false, hint }: ReferenceFieldProps & {
  /** id do select e nome do campo no formulário (ex.: "origemId") */ id: string;
  /** GET que lista as opções (ex.: "/api/origens") */ path: string;
  /** prefixo das mensagens i18n do campo (ex.: "pieceReferences.origem") */ messages: string;
  /** atributo data-<nome>-state legado, mantido para quem já o observa */ stateAttr?: string;
}) {
  const { t } = useI18n();
  const { options, status, retry } = useReferenceOptions(path);
  const unavailable = !!value && !options.some(option => option.id === value);
  const state = { "data-reference-state": status, ...(stateAttr ? { [`data-${stateAttr}-state`]: status } : {}) };
  return <div {...state} data-reference-path={path} aria-busy={status === "loading"} className="sm:col-span-2">
    <Field id={id} label={t(`${messages}.label`)} error={error}>
      <Select id={id} value={value} onChange={e => onChange(e.target.value)} error={!!error}
        disabled={disabled || status !== "ready" || options.length === 0} loading={status === "loading"}>
        <option value="">{t(`${messages}.unselected`)}</option>
        {unavailable && <option value={value} disabled>{selectedName || t(`${messages}.unavailable`)}</option>}
        {options.map(option => <option key={option.id} value={option.id}>{option.nome}</option>)}
      </Select>
      {status === "loading" && <p role="status" className="help">{t("common.loading")}</p>}
      {status === "error" && <div role="alert" className="mt-2 flex items-center gap-2">
        <span className="error-text">{t(`${messages}.loadError`)}</span>
        <Button type="button" disabled={disabled} onClick={retry}>{t("common.retry")}</Button>
      </div>}
      {status === "ready" && options.length === 0 && <p role="status" className="help">{t(`${messages}.empty`)}</p>}
      {hint !== null && <p className="help">{hint ?? t(`${messages}.hint`)}</p>}
    </Field>
  </div>;
}
