'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useI18n } from '@/lib/i18n/i18n';
import { Button } from '@/components/ui';
import { moduleLabel } from '@/components/room3d/room-store';
import { RoomView } from '@/components/room3d/room-view';

/**
 * Atelier › Quarto: o quarto da pessoa em 3D, ao lado da instalação de objetos. Com `module`, a câmera vai ao módulo e
 * ele acende (o objeto recém-instalado ou o que a pessoa pediu para ver). Sem WebGL ou com erro, um aviso em texto: a
 * lista de objetos e onde estão instalados continua logo abaixo.
 */
export function AtelierRoom3D({ module, onClose }: { module: string | null; onClose: () => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLElement>(null);
  const lit = useMemo(() => new Set(module ? [module] : []), [module]);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [module]);
  return (
    <section ref={ref} id="quarto-3d" className="atelier-room-3d" aria-label={t('atelier.room.view3d.title')}>
      <div className="atelier-room-3d-head">
        <h3 className="type-h3">{t('atelier.room.view3d.title')}</h3>
        <Button size="sm" onClick={onClose}>{t('atelier.room.view3d.close')}</Button>
      </div>
      <p className="type-body-sm text-muted">
        {module ? t('atelier.room.view3d.focus', { module: moduleLabel(module) }) : t('atelier.room.view3d.hint')}
      </p>
      <RoomView focusModule={module} lit={lit} fallback={<p role="status" className="atelier-room-3d-fallback">{t('atelier.room.view3d.no3d')}</p>} />
    </section>
  );
}
