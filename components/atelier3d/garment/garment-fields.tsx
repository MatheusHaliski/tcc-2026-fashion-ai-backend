"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui";
import styles from "./garment.module.css";

/**
 * Controle deslizante que pré-visualiza enquanto arrasta e só grava uma entrada no histórico ao soltar
 * (ponteiro, teclado ou perda de foco), para o desfazer voltar o ajuste inteiro.
 */
export function RangeField({ label, value, min, max, step, onPreview, onCommit, disabled, format, reset }: {
  label: string; value: number; min: number; max: number; step: number; disabled?: boolean;
  /** Ajuste relativo: volta ao valor neutro depois de aplicado (cada aplicação soma sobre a forma atual). */
  reset?: boolean;
  onPreview?: (value: number) => void; onCommit: (value: number) => void; format?: (value: number) => string;
}) {
  const id = useId();
  const [local, setLocal] = useState(value);
  const dragging = useRef(false);
  useEffect(() => {
    if (!dragging.current) setLocal(value);
  }, [value]);
  const commit = () => {
    if (!dragging.current) return;
    dragging.current = false;
    onCommit(local);
    if (reset) setLocal(value);
  };
  return (
    <div className={styles.field}>
      <label htmlFor={id} className="type-caption">
        {label} <output htmlFor={id}>{format ? format(local) : local}</output>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={local} disabled={disabled}
        onChange={(e) => {
          dragging.current = true;
          setLocal(Number(e.target.value));
          onPreview?.(Number(e.target.value));
        }}
        onPointerUp={commit} onKeyUp={commit} onBlur={commit} />
    </div>
  );
}

/** Cor com pré-visualização durante a escolha e gravação no evento nativo "change" (seletor fechado). */
export function ColorField({ label, value, onPreview, onCommit, disabled }: {
  label: string; value: string; disabled?: boolean; onPreview?: (value: string) => void; onCommit: (value: string) => void;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const latest = useRef(onCommit);
  latest.current = onCommit;
  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    const listener = () => latest.current(input.value);
    input.addEventListener("change", listener);
    return () => input.removeEventListener("change", listener);
  }, [value]);
  return (
    <div className={styles.field}>
      <label htmlFor={id} className="type-caption">{label}</label>
      <input ref={ref} id={id} type="color" className={styles.color} defaultValue={value} key={value} disabled={disabled}
        onChange={(e) => onPreview?.(e.target.value)} />
    </div>
  );
}

/** Grupo de botões alternados (uma escolha), acessível por aria-pressed. */
export function Choice<T extends string>({ legend, options, value, onChange, disabled }: {
  legend: string; options: { id: T; label: string; swatch?: string }[]; value: T | null; onChange: (value: T) => void; disabled?: boolean;
}) {
  return (
    <fieldset className={styles.choice} disabled={disabled}>
      <legend className="type-caption">{legend}</legend>
      {options.map((option) => (
        <Button key={option.id} size="sm" aria-pressed={value === option.id} onClick={() => onChange(option.id)}>
          {option.swatch && <span aria-hidden className={styles.swatch} style={{ background: option.swatch }} />}
          {option.label}
        </Button>
      ))}
    </fieldset>
  );
}
