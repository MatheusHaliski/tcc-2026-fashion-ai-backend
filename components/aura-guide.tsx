'use client';
import { useEffect, useState } from 'react';
import { Button, Dialog } from '@/components/ui';
import { useAuth } from '@/lib/auth/session';
import { useI18n } from '@/lib/i18n/i18n';
const GUIDE_FAMILIES = ['common', 'electro', 'splash', 'hype', 'metamorphose', 'impersonation'] as const;
const AURA_COLORS: Record<typeof GUIDE_FAMILIES[number], string> = {
  common: '#c8a16b',
  electro: '#55dce8',
  splash: '#e66eab',
  hype: '#77d9ed',
  metamorphose: '#b99aeb',
  impersonation: '#74dfc0',
};
export function AuraGuide() {
  const { user } = useAuth(); const { t } = useI18n();
  const [open,setOpen] = useState(false);
  const key = `fai.aura.guide.v2:${user?.id ?? 'anon'}`;
  useEffect(() => { if (!user) return; try { setOpen(localStorage.getItem(key) !== 'seen'); } catch { setOpen(true); } },[key,!!user]);
  const close = () => { try { localStorage.setItem(key,'seen'); } catch {} setOpen(false); };
  return <><Button size="sm" onClick={() => setOpen(true)}>{t('auraGuide.help')}</Button><Dialog open={open} onClose={close} title={t('auraGuide.title')} footer={<Button onClick={close}>{t('common.close')}</Button>}>
    <div className="grid gap-3 sm:grid-cols-2">
      {GUIDE_FAMILIES.map(family => <section key={family} className="rounded-lg border border-line-soft p-3">
        <AuraDiagram family={family} color={AURA_COLORS[family]} label={t(`auraGuide.${family}.text`)} artLabel={t('auraGuide.diagram.art')} photoLabel={t(family === 'impersonation' ? 'auraGuide.impersonation.diagram' : 'auraGuide.diagram.photo')} />
        <h3 className="type-heading mt-2">{t(`auraGuide.${family}.title`)}</h3>
        <p className="type-body-sm">{t(`auraGuide.${family}.text`)}</p>
      </section>)}
    </div>
    <section className="mt-3 rounded-lg border border-line-soft p-3"><h3 className="type-heading">{t('auraGuide.rewards.title')}</h3><p className="type-body-sm">{t('auraGuide.rewards.text')}</p></section>
  </Dialog></>;
}

function AuraDiagram({ family, color, label, artLabel, photoLabel }: { family: typeof GUIDE_FAMILIES[number]; color: string; label: string; artLabel: string; photoLabel: string }) {
  const arrow = `aura-guide-arrow-${family}`;
  return <svg viewBox="0 0 300 112" role="img" aria-label={label} className="w-full rounded-md bg-surface-2">
    <defs><marker id={arrow} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill={color} /></marker></defs>
    <rect x="8" y="8" width="128" height="96" rx="9" fill="var(--surface-1)" stroke={color} strokeWidth="3" />
    <rect x="17" y="17" width="110" height="14" rx="3" fill={color} opacity=".7" />
    <rect x="17" y="35" width="110" height="48" rx="3" fill={color} opacity=".2" />
    {family === 'electro' && <path d="M19 58H125M19 68H125" stroke={color} strokeWidth="2" />}
    {family === 'splash' && <g fill={color} opacity=".75"><circle cx="30" cy="47" r="5" /><circle cx="110" cy="72" r="7" /><circle cx="72" cy="41" r="3" /></g>}
    {family === 'hype' && <path d="M19 57H125" stroke={color} strokeWidth="3" strokeDasharray="5 4" />}
    {family === 'metamorphose' && <path d="M20 77L48 40L74 77L102 40L125 72" fill="none" stroke={color} strokeWidth="3" />}
    <path d="M48 48L37 60L45 69L52 65V78H84V65L92 69L100 60L88 48Q68 61 48 48Z" fill="var(--surface-1)" stroke="currentColor" strokeWidth="2" />
    <rect x="17" y="87" width="110" height="8" rx="3" fill="currentColor" opacity=".22" />
    <path d="M143 43H174" stroke={color} strokeWidth="2" markerEnd={`url(#${arrow})`} />
    <text x="182" y="47" fill="currentColor" fontSize="12">{artLabel}</text>
    <path d="M77 57L174 77" stroke={color} strokeWidth="2" markerEnd={`url(#${arrow})`} />
    <text x="182" y="82" fill="currentColor" fontSize="12">{photoLabel}</text>
  </svg>;
}
