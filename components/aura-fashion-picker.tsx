'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Button, Dialog } from '@/components/ui';
import { useI18n } from '@/lib/i18n/i18n';
import { ArtVideo } from '@/components/card-art';
import { AURA_FAMILIES, fashionPreset, suggestBrandAuras, type AuraFamily, type FashionPreset } from '@/lib/aura-fashion';
export function AuraFashionPicker({ value, onChange, brandName, colorHex, colorName, familyContent, exclusiveFamilies = [], activeFamilies = [], pieceId }: {
  brandName?: string | null; colorHex?: string | null; colorName?: string | null;
  value?: FashionPreset | null; onChange: (preset: FashionPreset | null) => void;
  pieceId?:string;
  familyContent?: Partial<Record<AuraFamily, ReactNode>>;
  exclusiveFamilies?: readonly AuraFamily[]; activeFamilies?: readonly AuraFamily[];
}) {
  const { t } = useI18n();
  const [family, setFamily] = useState<AuraFamily | null>(null);
  const [presets, setPresets] = useState<FashionPreset[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const exclusive = family !== null && exclusiveFamilies.includes(family);
  useEffect(() => {
    const controller = new AbortController(); setStatus('loading'); setPresets([]);
    Promise.resolve().then(() => fetch('/aura/fashion-curated/catalog.json', { cache: 'no-store', signal: controller.signal }))
      .then(r => { if (!r.ok) throw new Error('catalog'); return r.json(); })
      .then(data => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(data?.presets)) throw new Error('catalog');
        setPresets(data.presets.map(fashionPreset).filter((p: FashionPreset | null): p is FashionPreset => !!p)); setStatus('ready');
      }).catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [attempt]);
  const list = presets.filter(p => p.family === family);
  /** imagem que identifica a família no bloquinho: a primeira composição dela no catálogo */
  const cover = (f: AuraFamily) => presets.find(p => p.family === f);
  const thumb = (p?: FashionPreset) => p?.video ? <span className="opt-thumb relative overflow-hidden"><ArtVideo src={p.video} poster={p.image} /></span>
    : p ? <img className="opt-thumb" src={p.image} alt="" loading="lazy" /> : <span className="opt-thumb" aria-hidden />;
  const suggested = suggestBrandAuras(presets, brandName, colorHex, colorName);
  return <div className="opt-group"><p className="label">{t('fashionAura.title')}</p><div className="opt-grid">
    {AURA_FAMILIES.map(f => <button className="opt-tile" type="button" key={f} onClick={() => setFamily(f)} aria-haspopup="dialog" aria-pressed={value?.family === f || activeFamilies.includes(f)} title={t('fashionAura.variations')}>{thumb(value?.family === f ? value : cover(f))}<span className="opt-name">{t(`fashionAura.${f}`)}</span></button>)}
    <Link href={pieceId?`/atelier?tab=metamorphoses&pieceId=${encodeURIComponent(pieceId)}`:"/atelier?tab=metamorphoses"} className="opt-tile" title={t('auraGuide.impersonation.access')}><span className="opt-thumb aura-impersonation-thumb" aria-hidden /><span className="opt-name">{t('auraGuide.impersonation.title')}</span></Link>
    {value && <button type="button" className="opt-tile" onClick={() => onChange(null)}>{t('fashionAura.remove')}</button>}
  </div><Dialog open={!!family} onClose={() => setFamily(null)} title={family ? t(`fashionAura.${family}`) : t('fashionAura.title')} size="xl">
    <p className="type-caption text-muted">{t('fashionAura.hint')}</p>
    {family && familyContent?.[family]}
    {!exclusive && <>
      {status === 'loading' && <p role="status">{t('fashionAura.loading')}</p>}
      {status === 'error' && <div><p role="alert">{t('fashionAura.error')}</p><Button onClick={() => setAttempt(n => n + 1)}>{t('sealHypeIssuer.retry')}</Button></div>}
      {status === 'ready' && !list.length && <p role="status">{t('fashionAura.empty')}</p>}
      {family === 'METAMORPHOSE' && suggested[0] && <p className="type-caption" role="status">{t('fashionAura.suggested', { name: suggested[0].name })}</p>}
      {status === 'ready' && <div className="opt-grid">{(family === 'METAMORPHOSE' ? [...suggested, ...list.filter(p => !suggested.includes(p))] : list).map(p => <button type="button" className="opt-tile" key={p.id} aria-pressed={value?.id === p.id} onClick={() => { onChange(p); setFamily(null); }}>{thumb(p)}<span className="opt-name">{p.name}</span>{p.source && <span className="type-caption text-muted">{p.source}</span>}</button>)}</div>}
    </>}
  </Dialog></div>;
}
