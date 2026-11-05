'use client';
import { useI18n } from '@/lib/i18n/i18n';
import { Badge, Button, Select } from '@/components/ui';
import type { Tool, View } from '@/components/atelier3d/viewport';
import type { Customization } from '@/lib/piece3d/customization';

const VIEWS: View[] = ['perspective', 'front', 'back', 'left', 'right', 'top'];

export function PieceEditorBadges({ info }: { info: Customization }) {
  const { t } = useI18n();
  return <div className="flex flex-wrap items-center gap-2">
    <Badge tone={info.tryOnApproved ? 'chalk' : 'mark'}>{t(info.tryOnApproved ? 'editor3d.approvedAsset' : info.quarantine ? 'editor3d.quarantine' : 'editor3d.showcaseOnly')}</Badge>
    {info.viewOnly && <Badge tone="thread">{t('editor3d.viewOnly')}</Badge>}
    {info.baseChanged && <Badge tone="mark">{t('editor3d.baseChanged')}</Badge>}
    <span className="type-caption text-muted">{t('editor3d.revision', { revision: info.revision })}</span>
  </div>;
}

/** Câmera, ferramentas de transformação, desfazer/refazer, restaurar e salvar — só o que o modelo suporta. */
export function PieceEditorToolbar({ info, tool, view, canUndo, canRedo, dirty, busy, onTool, onView, onFit, onUndo, onRedo, onRestore, onSave }: {
  info: Customization; tool: Tool; view: View; canUndo: boolean; canRedo: boolean; dirty: boolean; busy: boolean;
  onTool: (tool: Tool) => void; onView: (view: View) => void; onFit: () => void; onUndo: () => void; onRedo: () => void; onRestore: () => void; onSave: () => void;
}) {
  const { t } = useI18n();
  const editable = info.editable;
  return <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label={t('editor3d.toolbar')}>
    <Select aria-label={t('atelier3d.view')} value={view} onChange={(e) => onView(e.target.value as View)}>{VIEWS.map((v) => <option key={v} value={v}>{t(`atelier3d.view.${v}`)}</option>)}</Select>
    <Button onClick={onFit}>{t('atelier3d.fit')}</Button>
    {info.supports.transforms && (['translate', 'rotate', 'scale'] as Tool[]).map((mode) => <Button key={mode} aria-pressed={tool === mode} disabled={!editable} onClick={() => onTool(mode)}>{t(`atelier3d.${mode}`)}</Button>)}
    {info.supports.undoRedo && <><Button disabled={!editable || !canUndo} onClick={onUndo}>{t('atelier3d.undo')}</Button><Button disabled={!editable || !canRedo} onClick={onRedo}>{t('atelier3d.redo')}</Button></>}
    <Button disabled={!editable || busy} onClick={onRestore}>{t('editor3d.restore')}</Button>
    <Button variant="primary" disabled={!editable || !dirty || busy} loading={busy} onClick={onSave}>{t('common.save')}</Button>
  </div>;
}
