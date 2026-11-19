"use client";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import type { ContextSuggestion, DailyLookContextInput } from "@/lib/daily-look/types";
import { Button, Chip, Dialog, Field, Input, Select, Skeleton } from "@/components/ui";
import { DailyLookMarks } from "./context-chips";

/**
 * "Hoje eu vesti isso para…" (Look do Dia Vivido F1, §7): ao marcar o Look do Dia, 3 propósitos sugeridos pelo que o app já
 * sabe (plano da semana, Momentos do dia, dia da semana), os demais numa lista, para quem, uma frase curta e as marcas do dia.
 * Tudo opcional: dá para registrar sem contar nada. Sem sugestão carregada, o registro continua possível.
 * A marca de clima só entra se a pessoa tocar "Usar minha posição": a posição vai para a API (WeatherService) e não é guardada.
 */
type Geo = { status: "idle" | "locating" | "ok" | "denied" | "unavailable"; latitude?: number; longitude?: number };

export function DailyLookContextPicker({ open, onClose, onConfirm, busy }: { open: boolean; onClose: () => void; onConfirm: (ctx: DailyLookContextInput) => void; busy?: boolean }) {
  const { t } = useI18n();
  const [geo, setGeo] = useState<Geo>({ status: "idle" });
  const coords = geo.status === "ok" ? `?latitude=${geo.latitude}&longitude=${geo.longitude}` : "";
  const sug = useApi<ContextSuggestion>((signal) => api.get(`/api/me/daily-looks/suggest-context${coords}`, { signal }), [coords], { enabled: open });
  const [purpose, setPurpose] = useState<string | null>(null);
  const [audience, setAudience] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const s = sug.data;
  const suggested = s?.suggestedPurposes ?? [];
  const others = (s?.purposes ?? []).filter((p) => !suggested.some((x) => x.code === p.code));
  const chosen = (s?.purposes ?? []).find((p) => p.code === purpose);
  const pick = (code: string) => setPurpose((cur) => (cur === code ? null : code));
  const hasWeather = (s?.marks ?? []).some((m) => m.kind === "WEATHER");
  function locate() {
    const g = typeof navigator !== "undefined" ? navigator.geolocation : undefined;
    if (!g) { setGeo({ status: "unavailable" }); return; }
    setGeo({ status: "locating" });
    g.getCurrentPosition((pos) => setGeo({ status: "ok", latitude: pos.coords.latitude, longitude: pos.coords.longitude }), (e) => setGeo({ status: e.code === 1 ? "denied" : "unavailable" }), { timeout: 10_000, maximumAge: 600_000 });
  }
  const position = geo.status === "ok" ? { latitude: geo.latitude ?? null, longitude: geo.longitude ?? null } : {};
  const footer = (
    <>
      <Button variant="ghost" onClick={() => onConfirm({})} disabled={busy}>{t("dailyLookContext.skip")}</Button>
      <Button variant="primary" onClick={() => onConfirm({ purpose, purposeNote: note.trim() || null, audience, ...position })} loading={busy}>{t("dailyLookContext.confirm")}</Button>
    </>
  );
  return (
    <Dialog open={open} onClose={onClose} title={s?.prompt ?? t("dailyLookContext.title")} footer={footer}>
      {sug.loading && <Skeleton className="h-24" />}
      {sug.error && <p className="type-caption text-muted">{t("dailyLookContext.load_error")}</p>}
      {s && (
        <div className="grid gap-3">
          {s.weekPlanDay?.eventLabel && <p className="type-body-sm text-muted">{t("dailyLookContext.planned", { event: s.weekPlanDay.eventLabel })}</p>}
          <div>
            <p className="label">{t("dailyLookContext.suggested")}</p>
            <div role="radiogroup" aria-label={t("dailyLookContext.suggested")} className="flex flex-wrap gap-2">
              {suggested.map((p) => <Chip key={p.code} role="radio" aria-checked={purpose === p.code} active={purpose === p.code} onClick={() => pick(p.code)}>{p.label}</Chip>)}
            </div>
          </div>
          <Field label={t("dailyLookContext.more")} id="dl-purpose-more">
            <Select id="dl-purpose-more" value={purpose && !suggested.some((x) => x.code === purpose) ? purpose : ""} onChange={(e) => setPurpose(e.target.value || null)}>
              <option value="">{t("dailyLookContext.none")}</option>
              {others.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
            </Select>
          </Field>
          {chosen?.sensitive && <p className="type-caption text-muted" role="note">{t("dailyLookContext.sensitive_hint")}</p>}
          <div>
            <p className="label">{t("dailyLookContext.audience")}</p>
            <div role="radiogroup" aria-label={t("dailyLookContext.audience")} className="flex flex-wrap gap-2">
              {s.audiences.map((a) => <Chip key={a.code} role="radio" aria-checked={audience === a.code} active={audience === a.code} onClick={() => setAudience((cur) => (cur === a.code ? null : a.code))}>{a.label}</Chip>)}
            </div>
            {audience === "SO_EU" && <p className="type-caption text-muted mt-1" role="note">{t("dailyLookContext.private_hint")}</p>}
          </div>
          <Field label={t("dailyLookContext.note")} id="dl-note" hint={t("dailyLookContext.note_hint", { n: 140 - note.length })}>
            <Input id="dl-note" value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <DailyLookMarks marks={s.marks} />
          {!hasWeather && geo.status !== "ok" && <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={locate} loading={geo.status === "locating"} disabled={geo.status === "locating"}>{t("dailyLookContext.use_location")}</Button>
            <span className="type-caption text-muted">{geo.status === "denied" ? t("dailyLookContext.location_denied") : geo.status === "unavailable" ? t("dailyLookContext.location_unavailable") : t("dailyLookContext.location_hint")}</span>
          </div>}
          {geo.status === "ok" && !hasWeather && !sug.loading && <p className="type-caption text-muted">{t("dailyLookContext.location_no_weather")}</p>}
        </div>
      )}
    </Dialog>
  );
}
