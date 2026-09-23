"use client";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { Button, Chip, Field, Input, Select, useToast } from "@/components/ui";
import { DEFAULT_DESIGN, ELEMENTS, GEOMETRY, MATERIALS, PALETTES, PATTERNS, SealMedallion, designFromPalette, validateSealImage, type SealDesign } from "@/components/seal-medallion";

type PartKey = "border" | "field" | "center" | "element";
const METALLIC = ["DOURADO", "PRATA", "BRONZE", "HOLOGRAFICO"];

/**
 * RF25 — criador de selo. Segue o desenho do logo FashionAI: 1) elemento central, 2) elemento entre a borda e o centro
 * (malha, grade, fluxo de pontos, raios…), 3) disco central, 4) borda — cada parte com material e cor. Também aceita
 * upload de um selo pronto, desde que respeite as proporções do logo (1:1, circular, 256–4096 px).
 */
export function SealCreator({ value, onChange, premium }: { value?: SealDesign | null; onChange: (d: SealDesign) => void; premium?: boolean }) {
  const toast = useToast();
  const d: SealDesign = value ?? DEFAULT_DESIGN;
  const mode = d.mode ?? "GENERATED";
  const [uploading, setUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);
  const setPart = (k: PartKey, patch: Record<string, unknown>) => onChange({ ...d, mode: "GENERATED", [k]: { ...(d[k] ?? {}), ...patch } });
  const nodes = d.field?.nodeColors?.length ? d.field.nodeColors : PALETTES.FAI.nodes;
  const elementId = d.element?.id ?? "BAG";

  function vary() {
    const seed = (((d.field?.seed ?? 1) * 37 + 11) % 9999) + 1;
    const pick = <T,>(arr: T[], salt: number) => arr[(seed * 7 + salt) % arr.length];
    const base = designFromPalette(pick(Object.keys(PALETTES), 1), d);
    onChange({
      ...base,
      field: { ...base.field, pattern: pick(PATTERNS.filter((p) => p.id !== "NENHUM"), 2).id, material: pick(["FOSCO", "BRILHO", "ESMALTE", "TECIDO", "VIDRO"], 3), density: 1 + ((seed >> 2) % 3), seed },
      border: { ...base.border, material: pick(["FOSCO", "DOURADO", "PRATA", "BRONZE", "HOLOGRAFICO", "MADEIRA", "COURO"], 4) },
      center: { ...base.center, material: pick(["FOSCO", "BRILHO", "ESMALTE", "VIDRO"], 5) },
      element: { ...base.element, id: pick(ELEMENTS, 6).id, material: pick(["FOSCO", "DOURADO", "PRATA", "NEON", "BRILHO"], 7) },
    });
  }

  async function onFile(file: File) {
    const v = await validateSealImage(file);
    if (!v.ok) { toast.error(v.message ?? "Imagem inválida."); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.upload<{ url: string; width: number; height: number; circular: boolean; warning?: string | null }>("/api/seals/uploads", fd);
      onChange({ ...d, mode: "UPLOAD", uploadUrl: r.url });
      setUploadInfo(r.warning ?? `Selo salvo em ${r.width} × ${r.height} px${r.circular ? " · conteúdo circular OK" : ""}.`);
    } catch (e) { toast.fromError(e); } finally { setUploading(false); }
  }

  const MaterialColor = ({ part, label: lbl }: { part: PartKey; label: string }) => {
    const p = (d[part] ?? {}) as { material?: string; color?: string };
    const metallic = METALLIC.includes(p.material ?? "");
    return (
      <div className="grid grid-cols-2 gap-2">
        <Field label={`Material — ${lbl}`} id={`m-${part}`}><Select id={`m-${part}`} value={p.material ?? "FOSCO"} onChange={(e) => setPart(part, { material: e.target.value })}>{MATERIALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select></Field>
        <Field label={`Cor — ${lbl}`} id={`c-${part}`} hint={metallic ? "metais e holográfico têm cor própria" : undefined}><input id={`c-${part}`} type="color" className="input h-9 w-full p-1" value={p.color ?? "#000000"} disabled={metallic} onChange={(e) => setPart(part, { color: e.target.value.toUpperCase() })} /></Field>
      </div>
    );
  };

  return (
    <div className="grid gap-4 md:grid-cols-[224px_1fr]">
      <div className="flex flex-col items-center gap-2">
        <SealMedallion design={d} size={200} premium={premium} title="pré-visualização do selo" />
        <div className="flex items-end gap-3 text-center">
          <div><SealMedallion design={d} size={44} premium={premium} /><p className="type-caption text-muted">card do look</p></div>
          <div><SealMedallion design={d} size={36} premium={premium} /><p className="type-caption text-muted">card da peça</p></div>
        </div>
        <p className="type-caption text-muted text-center">Proporções do logo FashionAI: bisel {Math.round(GEOMETRY.bezel * 100)} %, disco central {Math.round(GEOMETRY.centerDisc * 100)} %, elemento {Math.round(GEOMETRY.element * 100)} % do raio.</p>
        {premium && <p className="type-caption text-muted text-center">Selo Premium (celebridade): anel holográfico externo automático.</p>}
      </div>
      <div className="min-w-0">
        <div className="mb-3 flex gap-2">
          <Chip active={mode === "GENERATED"} onClick={() => onChange({ ...d, mode: "GENERATED" })}>Gerar no criador</Chip>
          <Chip active={mode === "UPLOAD"} onClick={() => onChange({ ...d, mode: "UPLOAD" })}>Enviar selo pronto</Chip>
          {mode === "GENERATED" && <Button size="sm" type="button" onClick={vary}>Variar</Button>}
        </div>
        {mode === "UPLOAD" ? (
          <div className="surface p-3">
            <p className="type-body-sm mb-2">Aceito apenas nas proporções do logo FashionAI: imagem <b>quadrada (1:1, tolerância {Math.round(GEOMETRY.uploadRatioTolerance * 100)} %)</b> com o selo <b>circular</b> ocupando todo o quadro, de {GEOMETRY.uploadMinPx} a {GEOMETRY.uploadMaxPx} px, PNG/WEBP com fundo transparente fora do círculo. Será salvo em 512 × 512.</p>
            <input type="file" accept="image/png,image/webp,image/jpeg" className="input" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
            {uploading && <p className="type-caption text-muted mt-1">Enviando…</p>}
            {uploadInfo && <p className="type-caption mt-1">{uploadInfo}</p>}
            {!d.uploadUrl && <p className="type-caption text-muted mt-1">Sem arquivo enviado, o selo continua usando o desenho gerado.</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="label mb-1">Paleta</p>
              <div className="flex flex-wrap gap-2">{Object.keys(PALETTES).map((id) => <Chip key={id} active={d.palette === id} onClick={() => onChange(designFromPalette(id, d))} title={id}><SealMedallion design={designFromPalette(id, d)} size={22} />{id.charAt(0) + id.slice(1).toLowerCase()}</Chip>)}</div>
            </div>
            <section>
              <p className="label mb-1">1 · Elemento central</p>
              <div className="mb-2 flex flex-wrap gap-2">{ELEMENTS.map((e) => <Chip key={e.id} active={elementId === e.id} onClick={() => setPart("element", { id: e.id })}><SealMedallion design={{ ...d, element: { ...(d.element ?? {}), id: e.id }, field: { ...(d.field ?? {}), pattern: "NENHUM" } }} size={22} />{e.label}</Chip>)}</div>
              {(elementId === "BAG" || elementId === "MONOGRAM") && <Field label="Texto (até 3 caracteres)" id="etext"><Input id="etext" value={d.element?.text ?? "FAI"} maxLength={3} onChange={(e) => setPart("element", { text: e.target.value.toUpperCase().replace(/[^A-Z0-9&+]/g, "") })} /></Field>}
              <MaterialColor part="element" label="elemento" />
            </section>
            <section>
              <p className="label mb-1">2 · Entre a borda e o centro</p>
              <div className="mb-2 flex flex-wrap gap-2">{PATTERNS.map((p) => <Chip key={p.id} active={(d.field?.pattern ?? "MALHA") === p.id} onClick={() => setPart("field", { pattern: p.id })}><SealMedallion design={{ ...d, field: { ...(d.field ?? {}), pattern: p.id } }} size={26} />{p.label}</Chip>)}</div>
              <MaterialColor part="field" label="campo" />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Field label="Cor das linhas" id="lc"><input id="lc" type="color" className="input h-9 w-full p-1" value={d.field?.lineColor ?? "#F6E8CF"} onChange={(e) => setPart("field", { lineColor: e.target.value.toUpperCase() })} /></Field>
                <Field label={`Densidade (${d.field?.density ?? 2})`} id="dens"><input id="dens" type="range" min={1} max={3} step={1} className="w-full" value={d.field?.density ?? 2} onChange={(e) => setPart("field", { density: Number(e.target.value) })} /></Field>
              </div>
              <p className="label mt-2 mb-1">Cores dos nós/pontos</p>
              <div className="flex flex-wrap items-center gap-2">
                {nodes.map((c, i) => <span key={i} className="flex items-center gap-1"><input type="color" className="input h-8 w-10 p-0.5" value={c} onChange={(e) => setPart("field", { nodeColors: nodes.map((n, j) => (j === i ? e.target.value.toUpperCase() : n)) })} />{nodes.length > 1 && <button type="button" className="type-caption text-muted" aria-label="remover cor" onClick={() => setPart("field", { nodeColors: nodes.filter((_, j) => j !== i) })}>×</button>}</span>)}
                {nodes.length < 6 && <Button size="sm" type="button" onClick={() => setPart("field", { nodeColors: [...nodes, "#FFFFFF"] })}>+ cor</Button>}
              </div>
            </section>
            <section>
              <p className="label mb-1">3 · Disco central</p>
              <MaterialColor part="center" label="disco" />
              <Field label={`Raio do disco (${Math.round((d.center?.radius ?? GEOMETRY.centerDisc) * 100)} % do raio)`} id="crad"><input id="crad" type="range" min={0.3} max={0.6} step={0.01} className="w-full" value={d.center?.radius ?? GEOMETRY.centerDisc} onChange={(e) => setPart("center", { radius: Number(e.target.value) })} /></Field>
            </section>
            <section>
              <p className="label mb-1">4 · Borda (bisel)</p>
              <MaterialColor part="border" label="borda" />
              <Field label={`Largura (${Math.round((d.border?.width ?? GEOMETRY.bezel) * 100)} % do raio)`} id="bw"><input id="bw" type="range" min={0.03} max={0.12} step={0.005} className="w-full" value={d.border?.width ?? GEOMETRY.bezel} onChange={(e) => setPart("border", { width: Number(e.target.value) })} /></Field>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
