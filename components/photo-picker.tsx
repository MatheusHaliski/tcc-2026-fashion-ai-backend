"use client";
import { useId, useRef, useState } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import { Button, useToast } from "@/components/ui";

export type PreUploadKind = "avatar" | "logo" | "official-photo" | "identity" | "activity-proof";

/**
 * RF1 — foto enviada pelo formulário de cadastro, antes de a conta existir (POST /api/auth/uploads). O servidor valida
 * pelo conteúdo, recodifica em JPEG (sem EXIF/GPS) e devolve a URL que vai no cadastro. Documentos (identidade,
 * comprovante) ficam numa área que só a administração lê.
 */
export function PhotoPicker({ kind, value, onChange, label, hint, round = false, error }: {
  kind: PreUploadKind; value: string | null; onChange: (url: string | null) => void; label: string; hint?: string; round?: boolean; error?: string;
}) {
  const id = useId(); const input = useRef<HTMLInputElement>(null); const toast = useToast();
  const [busy, setBusy] = useState(false); const [local, setLocal] = useState<string | null>(null);
  const privateDoc = kind === "identity" || kind === "activity-proof";
  async function pick(file?: File) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error("A imagem deve ter até 8 MB."); return; }
    setBusy(true); setLocal(URL.createObjectURL(file));
    try {
      const form = new FormData(); form.append("file", file);
      const r = await api.post<{ url: string }>(`/api/auth/uploads?kind=${kind}`, form, { anonymous: true });
      onChange(r.url);
    } catch (e) { setLocal(null); onChange(null); toast.fromError(e); } finally { setBusy(false); }
  }
  // documento privado: o navegador mostra a prévia local (a URL do servidor não é pública)
  const preview = privateDoc ? local : mediaUrl(value) ?? local;
  return (
    <div className="mb-3">
      <p className="label mb-1" id={`${id}-l`}>{label}</p>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => input.current?.click()} aria-labelledby={`${id}-l`} disabled={busy}
          className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-dashed border-line bg-surface-2 text-muted hover:bg-surface-3 ${round ? "h-20 w-20 rounded-full" : "h-20 w-28 rounded-md"}`}>
          {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <span aria-hidden className="text-2xl">＋</span>}
          {busy && <span className="absolute inset-0 flex items-center justify-center bg-surface/70 type-caption">enviando…</span>}
        </button>
        <div className="min-w-0 flex-1">
          {hint && <p className="type-caption text-muted">{hint}</p>}
          <div className="mt-1 flex gap-2">
            <Button size="sm" onClick={() => input.current?.click()} disabled={busy}>{value ? "Trocar" : "Escolher foto"}</Button>
            {value && <Button size="sm" variant="ghost" onClick={() => { onChange(null); setLocal(null); }}>Remover</Button>}
          </div>
          {error && <p className="error-text mt-1" role="alert">{error}</p>}
        </div>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" tabIndex={-1}
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

/** RF1 — sexo do manequim (Passarela 3D e provador): radios com o desenho do manequim (a silhueta nunca é o único sinal). */
export function MannequinSexPicker({ value, onChange, error, optional }: { value: string | null; onChange: (v: "FEMININO" | "MASCULINO") => void; error?: string; optional?: boolean }) {
  return (
    <fieldset className="mb-3">
      <legend className="label mb-1">Manequim{optional ? " (opcional)" : ""}</legend>
      <div role="radiogroup" aria-label="sexo do manequim" className="flex gap-2">
        {(["FEMININO", "MASCULINO"] as const).map((s) => (
          <button key={s} type="button" role="radio" aria-checked={value === s} onClick={() => onChange(s)}
            className={`chip inline-flex items-center gap-2 ${value === s ? "is-active" : ""}`}>
            <MannequinGlyph sex={s} />{s === "FEMININO" ? "Feminino" : "Masculino"}
          </button>
        ))}
      </div>
      <p className="mt-1 type-caption text-muted">Define o manequim que desfila o seu Look do Dia na Passarela 3D e o do provador.</p>
      {error && <p className="error-text mt-1" role="alert">{error}</p>}
    </fieldset>
  );
}

export function MannequinGlyph({ sex, size = 18 }: { sex: "FEMININO" | "MASCULINO"; size?: number }) {
  return sex === "FEMININO"
    ? <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="4" r="2.6" fill="currentColor" /><path d="M9 8h6l1 5-2 1 2.5 8h-9L10 14l-2-1z" fill="currentColor" /></svg>
    : <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="4" r="2.6" fill="currentColor" /><path d="M8 8h8l1 7h-2l-1 7h-4l-1-7H7z" fill="currentColor" /></svg>;
}
