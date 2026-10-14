'use client';
import { useEffect, useState } from 'react';
import { Button, Dialog } from '@/components/ui';
import { useAuth } from '@/lib/auth/session';
import { useI18n } from '@/lib/i18n/i18n';
export function AuraGuide() {
  const { user } = useAuth(); const { t } = useI18n();
  const [open,setOpen] = useState(false);
  const key = `fai.aura.guide.v1:${user?.id ?? 'anon'}`;
  useEffect(() => { if (!user) return; try { setOpen(localStorage.getItem(key) !== 'seen'); } catch { setOpen(true); } },[key,!!user]);
  const close = () => { try { localStorage.setItem(key,'seen'); } catch {} setOpen(false); };
  return <><Button size="sm" onClick={() => setOpen(true)}>{t('auraGuide.help')}</Button><Dialog open={open} onClose={close} title={t('auraGuide.title')} footer={<Button onClick={close}>{t('common.close')}</Button>}>
    {['common','hype','metamorphose','rewards'].map(part => <section key={part}><h3 className="type-heading">{t(`auraGuide.${part}.title`)}</h3><p className="type-body">{t(`auraGuide.${part}.text`)}</p></section>)}
  </Dialog></>;
}
