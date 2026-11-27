'use client';
import { useState } from 'react';
import { Button, Dialog, SegmentPicker } from '@/components/ui';
import { useI18n } from '@/lib/i18n/i18n';
import { PIECE_CREATION_STEPS, type PieceCreationStep } from '@/components/piece-creation-steps';

/** Mesmo nome das abas do formulário: o guia tem uma etapa para cada aba (antes eram 5 etapas para 4 abas). */
const TITLES: Record<PieceCreationStep, string> = {
  piece: 'pieces.new.etapa_peca',
  more: 'pieceForm.moreDetails',
  art: 'pieces.new.etapa_arte',
  review: 'builder.step.review',
};

export function PieceCreationGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState<PieceCreationStep>('piece');
  const index = PIECE_CREATION_STEPS.indexOf(step);
  const last = index === PIECE_CREATION_STEPS.length - 1;
  const footer = (
    <div className="flex gap-3">
      <Button size="sm" disabled={index === 0} onClick={() => setStep(PIECE_CREATION_STEPS[index - 1])}>{t('pieceGuide.previous')}</Button>
      {last
        ? <Button onClick={onClose}>{t('pieceGuide.start')}</Button>
        : <Button onClick={() => setStep(PIECE_CREATION_STEPS[index + 1])}>{t('pieceGuide.next')}</Button>}
    </div>
  );
  return (
    <Dialog open={open} onClose={onClose} title={t('pieceGuide.title')} size="lg" footer={footer}>
      <SegmentPicker label={t('pieceGuide.steps')} value={step} onChange={setStep}
        options={PIECE_CREATION_STEPS.map((id, i) => ({ id, label: `${i + 1}. ${t(TITLES[id])}` }))} />
      <figure className="my-5 rounded-xl bg-surface-2 p-5">
        <GuideFigure step={step} label={t(`pieceGuide.${step}.figure`)} />
        <figcaption className="mt-3 type-caption text-center text-muted">{t(`pieceGuide.${step}.figure`)}</figcaption>
      </figure>
      <h3 className="type-heading">{t(TITLES[step])}</h3>
      <p className="type-body">{t(`pieceGuide.${step}.text`)}</p>
    </Dialog>
  );
}

/** Desenho de cada etapa: a peça (Peça), os campos (Mais detalhes), a moldura (Arte de fundo) e o visto (Revisar). */
function GuideFigure({ step, label }: { step: PieceCreationStep; label: string }) {
  if (step === 'art') {
    return (
      <div className="mx-auto max-w-48 rounded-xl border p-3" role="img" aria-label={label}
        style={{ backgroundImage: 'url(/aura/fashion-curated/satin-ivory.webp)', backgroundSize: 'cover' }}>
        <div className="rounded-lg bg-surface-1 p-4"><Garment /></div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-64">
      <svg viewBox="0 0 300 175" role="img" aria-label={label}>
        <rect x="2" y="2" width="296" height="171" rx="16" fill="var(--surface-1)" stroke="currentColor" opacity=".6" />
        {step === 'more'
          ? [40, 72, 104, 136].map((y, i) => (
            <g key={y}>
              <rect x="25" y={y} width="65" height="9" rx="4" fill="currentColor" opacity=".3" />
              <rect x="110" y={y - 4} width={130 - i * 12} height="18" rx="5" fill="none" stroke="currentColor" />
            </g>
          ))
          : <>
            <path d="M115 35L85 55L100 82L118 74V140H182V74L200 82L215 55L185 35Q150 58 115 35Z" fill="none" stroke="currentColor" strokeWidth="3" />
            {step === 'piece' && <circle cx="150" cy="87" r="61" fill="none" stroke="currentColor" opacity=".25" />}
            {step === 'review' && <path d="M238 105L249 117L273 90" fill="none" stroke="#4c9b86" strokeWidth="5" />}
          </>}
      </svg>
    </div>
  );
}

function Garment() {
  return <svg viewBox="0 0 150 170" aria-hidden><path d="M45 20L15 40L30 67L48 59V145H112V59L130 67L145 40L115 20Q80 43 45 20Z" fill="none" stroke="currentColor" strokeWidth="3" /></svg>;
}
