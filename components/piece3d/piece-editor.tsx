'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { useI18n } from '@/lib/i18n/i18n';
import { customizationApi, type Customization, type EditSource } from '@/lib/piece3d/customization';
import { availableSources, baseKeyFor, defaultSource, documentFor, loadSource, type AssetOrigin } from '@/lib/piece3d/base-source';
import { disposeAsset, downloadBlob, type LoadedAsset, type SceneDocument } from '@/lib/atelier3d/document';
import { commitSceneEdit, createSceneHistory, travelSceneHistory, type SceneHistory } from '@/lib/atelier3d/history';
import { SceneInspector } from '@/components/atelier3d/scene-inspector';
import type { Tool, View } from '@/components/atelier3d/viewport';
import { Button, Dialog, ErrorState, Skeleton, useToast } from '@/components/ui';
import { PieceEditorBadges, PieceEditorToolbar } from './piece-editor-toolbar';

const Viewport = dynamic(() => import('@/components/atelier3d/viewport'), { ssr: false, loading: () => <Skeleton className="h-96" /> });

/**
 * RF — editor 3D da peça. A edição parte sempre de uma base: a peça base da subcategoria (GLB publicado pela equipe ou
 * base procedural) ou o GLB próprio da peça. Personaliza cor/material e posição/rotação/escala sem alterar a base;
 * desfazer/refazer na sessão; restaurar e trocar de base pedem confirmação quando há alterações; salvar grava a
 * personalização da pessoa com a base usada. Escala é só visual: nunca vira medida oficial, tamanho ou passaporte.
 */
export function PieceEditor({ pieceId }: { pieceId: string }) {
  const { t, fmtDateTime } = useI18n(); const toast = useToast();
  const [info, setInfo] = useState<Customization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<LoadedAsset | null>(null);
  const [source, setSource] = useState<EditSource>('base'); const [origin, setOrigin] = useState<AssetOrigin | null>(null); const [pendingSource, setPendingSource] = useState<EditSource | null>(null);
  const [history, setHistory] = useState<SceneHistory>(() => createSceneHistory({ nodes: {}, materials: {}, vertices: {} }));
  const [selected, setSelected] = useState('');
  const [tool, setTool] = useState<Tool>('translate'); const [view, setView] = useState<View>('perspective'); const [fit, setFit] = useState(0);
  const [vertex, setVertex] = useState(0); const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false); const [confirmRestore, setConfirmRestore] = useState(false);
  const asset = useRef<LoadedAsset | null>(null); const bytes = useRef<ArrayBuffer | null>(null);
  const requestId = useRef<string>(''); const alive = useRef(true);

  const open = useCallback(async (next: Customization, chosen: EditSource) => {
    const result = await loadSource(next, chosen);
    if (!alive.current) { disposeAsset(result.asset); return; }
    if (asset.current) disposeAsset(asset.current);
    asset.current = result.asset; bytes.current = result.bytes;
    setLoaded(result.asset); setOrigin(result.origin); setSource(chosen); setSelected('');
    setHistory(createSceneHistory(documentFor(next, chosen)));
  }, []);

  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        const next = await customizationApi.get(pieceId);
        if (!alive.current) return;
        setInfo(next);
        const chosen = defaultSource(next);
        if (!next.modelAvailable || !chosen) { setError(t('editor3d.noModel')); return; }
        await open(next, chosen);
      } catch (failure) {
        if (alive.current) setError(failure instanceof ApiError ? failure.message : t('editor3d.loadError'));
      }
    })();
    return () => { alive.current = false; if (asset.current) { disposeAsset(asset.current); asset.current = null; } };
  }, [pieceId, t, open]);

  const doc = history.doc;
  const editable = !!info?.editable;
  function change(next: SceneDocument) { if (!editable) return; setHistory((h) => commitSceneEdit(h, next)); setDirty(true); }
  function travel(direction: 'undo' | 'redo') { if (!editable) return; setHistory((h) => travelSceneHistory(h, direction)); setDirty(true); }
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.closest('input,textarea,select')) return; if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); travel(e.shiftKey ? 'redo' : 'undo'); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });
  function restore() {
    if (!loaded) return;
    setHistory(createSceneHistory(structuredClone(loaded.baseline))); setDirty(true); setConfirmRestore(false);
  }
  async function switchSource(next: EditSource) {
    if (!info || busy || next === source) return;
    setPendingSource(null); setBusy(true); setError(null);
    try { await open(info, next); setDirty(true); }
    catch { if (alive.current) setError(t('editor3d.base.loadError')); }
    finally { if (alive.current) setBusy(false); }
  }
  async function save() {
    if (!info || busy || !editable) return;
    setBusy(true);
    if (!requestId.current) requestId.current = crypto.randomUUID();
    try {
      const next = await customizationApi.save(pieceId, { expectedRevision: info.revision, document: doc, requestId: requestId.current, baseKey: baseKeyFor(info, source) });
      requestId.current = ''; setInfo(next); setDirty(false); toast.success(t('editor3d.saved'));
    } catch (failure) { toast.fromError(failure); if (failure instanceof ApiError && failure.status === 409) setError(t('editor3d.conflict')); }
    finally { setBusy(false); }
  }
  function download() {
    if (!bytes.current || !info) return;
    downloadBlob(new Blob([bytes.current], { type: 'model/gltf-binary' }), `fai-${source === 'glb' ? 'piece' : info.basePiece.subcategory ?? 'base'}-base.glb`);
  }
  if (error && !loaded) return <div className="grid gap-3">{info && <PieceEditorBadges info={info} origin={origin} />}<ErrorState error={new Error(error)} /></div>;
  if (!info || !loaded) return <Skeleton className="h-96" />;
  return <div className="grid gap-3">
    <PieceEditorBadges info={info} origin={origin} />
    <p className="type-body-sm text-muted">{t('editor3d.base.hint')}</p>
    {error && <p role="alert" className="type-body-sm text-critical">{error}</p>}
    <PieceEditorToolbar info={info} tool={tool} view={view} source={source} sources={availableSources(info)} canUndo={history.past.length > 0} canRedo={history.future.length > 0} dirty={dirty} busy={busy}
      onTool={setTool} onView={setView} onSource={(next) => (dirty ? setPendingSource(next) : void switchSource(next))} onDownload={download} onFit={() => setFit((n) => n + 1)} onUndo={() => travel('undo')} onRedo={() => travel('redo')} onRestore={() => (dirty ? setConfirmRestore(true) : restore())} onSave={() => void save()} />
    <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
      <div className="h-[480px] overflow-hidden rounded-lg border border-line-soft"><Viewport asset={loaded} document={doc} selected={selected} tool={tool} view={view} fit={fit} wireframe={false} snap={false} editable={editable} onSelect={setSelected} onTransform={(value) => change({ ...doc, nodes: { ...doc.nodes, [selected]: value } })} /></div>
      {selected ? <SceneInspector loaded={loaded} document={doc} selected={selected} editable={editable} vertex={vertex} onVertexChange={setVertex} onChange={change} /> : <p className="type-body-sm text-muted">{t('editor3d.pickNode')}</p>}
    </div>
    <p className="type-caption text-muted">{t('editor3d.scaleNote')}</p>
    {info.savedAt && <p className="type-caption text-muted">{t('editor3d.savedAt', { date: fmtDateTime(info.savedAt) })}</p>}
    <Dialog open={confirmRestore} onClose={() => setConfirmRestore(false)} title={t('editor3d.restore')} footer={<><Button onClick={() => setConfirmRestore(false)}>{t('common.cancel')}</Button><Button variant="danger" onClick={restore}>{t('editor3d.restoreConfirm')}</Button></>}><p className="type-body">{t('editor3d.restoreHint')}</p></Dialog>
    <Dialog open={pendingSource !== null} onClose={() => setPendingSource(null)} title={t('editor3d.base.switchTitle')} footer={<><Button onClick={() => setPendingSource(null)}>{t('common.cancel')}</Button><Button variant="danger" onClick={() => pendingSource && void switchSource(pendingSource)}>{t('editor3d.base.switchConfirm')}</Button></>}><p className="type-body">{t('editor3d.base.switchHint')}</p></Dialog>
  </div>;
}
