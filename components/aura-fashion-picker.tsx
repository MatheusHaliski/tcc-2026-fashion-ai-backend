'use client';
import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui';
import { useI18n } from '@/lib/i18n/i18n';
import { AURA_FAMILIES, fashionPreset, suggestBrandAuras, type AuraFamily, type FashionPreset } from '@/lib/aura-fashion';
export function AuraFashionPicker({ value, onChange, brandName, colorHex, colorName }: { brandName?: string | null; colorHex?: string | null; colorName?: string | null; value?: FashionPreset | null; onChange: (preset: FashionPreset | null) => void }) {
  const { t } = useI18n();
  const [family,setFamily] = useState<AuraFamily | null>(null);
  const [presets,setPresets] = useState<FashionPreset[]>([]);
  const [status,setStatus] = useState<'loading'|'ready'|'error'>('loading');
  useEffect(() => {
    if (!family) return;
    const controller = new AbortController(); setStatus('loading');
    fetch('/aura/fashion-curated/catalog.json', { cache:'no-store',signal:controller.signal }).then(r => { if (!r.ok) throw new Error('catalog'); return r.json(); }).then(data => {
      setPresets((Array.isArray(data.presets) ? data.presets : []).map(fashionPreset).filter((p: FashionPreset | null): p is FashionPreset => !!p)); setStatus('ready');
    }).catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  },[family]);
  const list = presets.filter(p => p.family === family);
  const suggested = suggestBrandAuras(presets, brandName, colorHex, colorName);
  return <div className="opt-group"><p className="label">{t('fashionAura.title')}</p><div className="opt-grid">
    {AURA_FAMILIES.map(f => <button className="opt-tile" type="button" key={f} onClick={() => setFamily(f)} aria-pressed={value?.family === f}><span className="opt-name">{t(`fashionAura.${f}`)}</span><span className="type-caption">{t('fashionAura.variations')}</span></button>)}
    {value && <button type="button" className="opt-tile" onClick={() => onChange(null)}>{t('fashionAura.remove')}</button>}
  </div><Dialog open={!!family} onClose={() => setFamily(null)} title={family ? t(`fashionAura.${family}`) : t('fashionAura.title')} size="lg">
    <p className="type-caption text-muted">{t('fashionAura.hint')}</p>
    {status === 'loading' && <p role="status">{t('fashionAura.loading')}</p>}
    {status === 'error' && <p role="alert">{t('fashionAura.error')}</p>}
    {status === 'ready' && !presets.some(p => p.family === family) && <p>{t('fashionAura.empty')}</p>}
    {family === 'METAMORPHOSE' && suggested[0] && <p className="type-caption" role="status">{t('fashionAura.suggested',{name:suggested[0].name})}</p>}
    <div className="opt-grid">{(family === 'METAMORPHOSE' ? [...suggested,...list.filter(p => !suggested.includes(p))] : list).map(p => <button type="button" className="opt-tile" key={p.id} aria-pressed={value?.id === p.id} onClick={() => { onChange(p); setFamily(null); }}>{p.video ? <video className="opt-thumb" src={p.video} poster={p.image} muted loop playsInline autoPlay preload="none" aria-hidden/> : <img className="opt-thumb" src={p.image} alt="" loading="lazy"/>}<span className="opt-name">{p.name}</span>{p.source && <span className="type-caption text-muted">{p.source}</span>}</button>)}</div>
  </Dialog></div>;
}
