"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/i18n";
import { qs } from "@/lib/api/client";
import { CATEGORY_KEYS, label } from "@/lib/api/taxonomy";
import { useApi } from "@/lib/hooks/use-api";
import { lensApi } from "@/lib/lens/api";
import { expiryDays, parseLensTab, type LensTab } from "@/lib/lens/model";
import type { LensDetectionView, LensScanView } from "@/lib/lens/types";
import { Button, Dialog, Dropdown, ErrorState, Field, PageHeader, Skeleton, Tabs, useToast } from "@/components/ui";
import { LensProvider, useLensImage, type LensResultCtx } from "./lens-context";
import { LensFocusBar, LensStage } from "./lens-stage";
import { LensReadingTab, LensStyleTab } from "./lens-tabs";
import { LensClosetTab, LensDiscoverTab } from "./lens-matches";
import { LensRecreateTab } from "./lens-recreate";

/** Avisos do scan: expiração, leitura local, rostos borrados e resultado parcial (sempre em texto). */
function Notices({ scan }: { scan: LensScanView }) {
  const { t } = useI18n();
  const days = expiryDays(scan.expiresAt, scan.savedAt);
  const items: { key: string; text: string; tone?: "warn" }[] = [];
  if (days != null) items.push({ key: "exp", text: days === 0 ? t("lens.notice.expires_today") : t("lens.notice.expires", { n: days }) });
  if (scan.aiSource === "local") items.push({ key: "local", text: t("lens.notice.local"), tone: "warn" });
  if (scan.status === "PARTIAL") items.push({ key: "partial", text: t("lens.notice.partial"), tone: "warn" });
  if (scan.facesRedacted > 0) items.push({ key: "faces", text: t("lens.notice.faces", { n: scan.facesRedacted }) });
  if (!items.length) return null;
  return <ul className="lens-notices">{items.map((i) => <li key={i.key} className={i.tone === "warn" ? "is-warn" : undefined}>{i.text}</li>)}</ul>;
}

/** "Não encontramos roupas" (§8.7): dicas de enquadramento e "Marcar uma peça" (a foto inteira como uma peça). */
function NoFashion({ scan, onAdded }: { scan: LensScanView; onAdded: () => void }) {
  const { t } = useI18n(); const toast = useToast();
  const [open, setOpen] = useState(false); const [category, setCategory] = useState<string>(CATEGORY_KEYS[0]); const [busy, setBusy] = useState(false);
  async function mark() {
    setBusy(true);
    try { await lensApi.addDetection(scan.id, { box: { x: 0, y: 0, w: 100, h: 100 }, category }); setOpen(false); onAdded(); }
    catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  return (
    <section className="surface lens-state" role="status">
      <h2 className="type-h2">{t("lens.state.no_fashion")}</h2>
      <p className="type-body text-muted">{t("lens.state.no_fashion_hint")}</p>
      <ul className="lens-tips">
        <li>{t("lens.tips.frame")}</li><li>{t("lens.tips.light")}</li><li>{t("lens.tips.one_person")}</li>
      </ul>
      <div className="lens-state-actions">
        <Link href="/lens" className="btn btn-primary">{t("lens.state.try_another")}</Link>
        <Button onClick={() => setOpen(true)} aria-haspopup="dialog">{t("lens.state.mark_piece")}</Button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("lens.state.mark_piece")}
        footer={<><Button onClick={() => setOpen(false)}>{t("common.cancel")}</Button><Button variant="primary" loading={busy} onClick={mark}>{t("lens.state.mark_confirm")}</Button></>}>
        <p className="type-body-sm text-muted mb-3">{t("lens.state.mark_hint")}</p>
        <Field label={t("common.category")} id="lens-mark-category">
          <Dropdown block id="lens-mark-category" value={category} onChange={setCategory} options={CATEGORY_KEYS.map((c) => ({ id: c, label: label(c) }))} />
        </Field>
      </Dialog>
    </section>
  );
}

/** Falha do scan: cota do dia, consentimento para IA externa ou erro genérico — com a saída. */
function Failed({ scan }: { scan: LensScanView }) {
  const { t } = useI18n();
  const code = scan.errorCode === "QUOTA" ? "quota" : scan.errorCode === "CONSENT_REQUIRED" ? "consent" : "failed";
  return (
    <section className="surface lens-state" role="alert">
      <h2 className="type-h2">{t(`lens.state.${code}`)}</h2>
      <p className="type-body text-muted">{t(`lens.state.${code}_hint`)}</p>
      <div className="lens-state-actions">
        {code === "consent" && <Link href="/settings" className="btn btn-primary">{t("lens.state.consent_cta")}</Link>}
        <Link href="/lens" className="btn">{t("lens.state.try_another")}</Link>
      </div>
    </section>
  );
}

/**
 * Resultado de um scan (/lens/[scanId]): imagem com hotspots, FOCO (seleção na URL, ?focus=) e as abas (?tab=)
 * Leitura · Seu guarda-roupa · Recriar · Estilo & Hype · Descobrir. Cabeçalho: salvar como inspiração e excluir.
 */
export function LensResult({ scanId }: { scanId: string }) {
  const { t } = useI18n(); const router = useRouter(); const sp = useSearchParams(); const toast = useToast();
  const { data: scan, loading, error, reload, setData } = useApi((signal) => lensApi.get(scanId, signal), [scanId]);
  const image = useLensImage(scanId, !!scan);
  const [tab, setTab] = useState<LensTab>(() => parseLensTab(sp.get("tab")));
  const [focusId, setFocusId] = useState<string | null>(() => sp.get("focus"));
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false); const [deleting, setDeleting] = useState(false);
  const [undo, setUndo] = useState<LensDetectionView | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setTab(parseLensTab(sp.get("tab"))); setFocusId(sp.get("focus")); }, [sp]);
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  const base = `/lens/${encodeURIComponent(scanId)}`;
  const urlFor = (nextTab: LensTab, nextFocus: string | null) => `${base}${qs({ tab: nextTab === "reading" ? undefined : nextTab, focus: nextFocus ?? undefined })}`;
  const validFocus = scan?.detections.some((d) => d.id === focusId) ? focusId : null;
  // aba: troca o contexto (replace); foco: seleção que vai para o histórico (o Voltar devolve o foco anterior)
  const changeTab = (next: LensTab) => { setTab(next); router.replace(urlFor(next, validFocus), { scroll: false }); };
  const setFocus = useCallback((id: string | null) => { setFocusId(id); router.push(urlFor(tab, id), { scroll: false }); }, [tab, scanId]); // eslint-disable-line react-hooks/exhaustive-deps
  const goTab = useCallback((next: LensTab, focus?: string | null) => {
    const f = focus === undefined ? validFocus : focus;
    setTab(next); setFocusId(f); router.push(urlFor(next, f), { scroll: false });
  }, [validFocus, scanId]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateDetection = useCallback((d: LensDetectionView, opts?: { refresh?: boolean }) => {
    setData((s) => (s ? { ...s, detections: s.detections.some((x) => x.id === d.id) ? s.detections.map((x) => (x.id === d.id ? d : x)) : [...s.detections, d] } : s));
    if (opts?.refresh) setVersion((v) => v + 1);
  }, [setData]);

  const dismissDetection = useCallback(async (d: LensDetectionView) => {
    try {
      await lensApi.patchDetection(scanId, d.id, { dismissed: true });
      setData((s) => (s ? { ...s, detections: s.detections.filter((x) => x.id !== d.id) } : s));
      if (focusId === d.id) setFocus(null);
      setVersion((v) => v + 1);
      setUndo(d);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndo(null), 5000);
    } catch (e) { toast.fromError(e); }
  }, [scanId, focusId, setData, setFocus, toast]);

  async function restore() {
    const d = undo; if (!d) return;
    setUndo(null);
    try { updateDetection(await lensApi.patchDetection(scanId, d.id, { dismissed: false }), { refresh: true }); }
    catch (e) { toast.fromError(e); }
  }

  async function toggleSaved() {
    if (!scan) return;
    setSaving(true);
    try {
      const next = await lensApi.setSaved(scan.id, !scan.savedAt);
      setData((s) => (s ? { ...s, savedAt: next.savedAt, expiresAt: next.expiresAt } : next));
      toast.success(next.savedAt ? t("lens.saved_toast") : t("lens.unsaved_toast"));
    } catch (e) { toast.fromError(e); } finally { setSaving(false); }
  }
  async function remove() {
    setDeleting(true);
    try { await lensApi.remove(scanId); setConfirmDelete(false); toast.success(t("lens.deleted_toast")); router.push("/lens"); }
    catch (e) { toast.fromError(e); setDeleting(false); }
  }

  const ctx = useMemo<LensResultCtx | null>(() => (scan ? {
    scan, imageUrl: image.url, version, focusId: validFocus, setFocus, goTab, updateDetection, dismissDetection: (d) => { void dismissDetection(d); },
  } : null), [scan, image.url, version, validFocus, setFocus, goTab, updateDetection, dismissDetection]);

  const header = (
    <PageHeader title={t("lens.title")} lead={scan && scan.detections.length ? t("lens.result.lead", { n: scan.detections.length }) : t("lens.lead")}
      actions={scan ? (
        <>
          <Link href="/lens" className="btn btn-ghost">{t("lens.result.new_scan")}</Link>
          <Button aria-pressed={!!scan.savedAt} loading={saving} onClick={toggleSaved}>{scan.savedAt ? t("lens.action.saved") : t("lens.action.save")}</Button>
          <Button variant="danger" onClick={() => setConfirmDelete(true)} aria-haspopup="dialog">{t("common.delete")}</Button>
        </>
      ) : undefined} />
  );

  if (loading && !scan) return (
    <>
      {header}
      <div aria-busy="true" className="lens-loading">
        <p className="type-body text-muted" role="status">{t("lens.result.loading")}</p>
        <Skeleton className="h-72" />
      </div>
    </>
  );
  if (error && !scan) return (
    <>{header}<ErrorState error={error} onRetry={reload} page notFound={{ title: t("lens.result.not_found"), hint: t("lens.result.not_found_hint"), action: <Link href="/lens" className="btn btn-primary">{t("lens.result.new_scan")}</Link> }} /></>
  );
  if (!scan || !ctx) return null;

  const pieces = scan.detections.length > 0;
  const tabs: { id: LensTab; label: string }[] = [
    { id: "reading", label: t("lens.tab.reading") }, { id: "closet", label: t("lens.tab.closet") }, { id: "recreate", label: t("lens.tab.recreate") },
    { id: "style", label: t("lens.tab.style") }, { id: "discover", label: t("lens.tab.discover") },
  ];
  return (
    <LensProvider value={ctx}>
      {header}
      <Notices scan={scan} />
      {undo && (
        <div className="lens-undo" role="status">
          <span>{t("lens.undo.text", { label: undo.label })}</span>
          <Button size="sm" onClick={restore}>{t("lens.undo.action")}</Button>
        </div>
      )}
      <div className="lens-result">
        <div className="lens-result-media">
          <LensStage detections={scan.detections} width={scan.width} height={scan.height} imageUrl={image.url} imageFailed={image.failed} focusId={validFocus} onFocus={setFocus} />
        </div>
        <div className="lens-result-main">
          {scan.status === "FAILED" && !pieces ? <Failed scan={scan} />
            : !pieces ? <NoFashion scan={scan} onAdded={reload} />
            : (
              <>
                <LensFocusBar detections={scan.detections} focusId={validFocus} onFocus={setFocus} />
                <Tabs label={t("lens.tabs_label")} value={tab} onChange={changeTab} tabs={tabs} className="lens-tabs" />
                <div role="tabpanel" aria-label={tabs.find((x) => x.id === tab)?.label}>
                  {tab === "reading" && <LensReadingTab />}
                  {tab === "closet" && <LensClosetTab />}
                  {tab === "recreate" && <LensRecreateTab />}
                  {tab === "style" && <LensStyleTab />}
                  {tab === "discover" && <LensDiscoverTab />}
                </div>
              </>
            )}
        </div>
      </div>
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} role="alertdialog" title={t("lens.delete.title")}
        footer={<><Button onClick={() => setConfirmDelete(false)}>{t("common.cancel")}</Button><Button variant="danger" loading={deleting} onClick={remove}>{t("lens.delete.confirm")}</Button></>}>
        <p className="type-body">{t("lens.delete.body")}</p>
      </Dialog>
    </LensProvider>
  );
}
