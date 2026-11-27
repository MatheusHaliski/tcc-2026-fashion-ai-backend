'use client';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n/i18n';
import { EmptyState } from '@/components/ui';

/**
 * Peça sem modelo 3D: não é erro ("Algo deu errado"), é um estado explicado — o que o editor faz, de onde vem o
 * modelo e o caminho de volta. Sem as etiquetas de modelo ("Modelo de vitrine…", versão da personalização), que
 * descreveriam um modelo que não existe.
 */
export function PieceEditorNoModel({ pieceId }: { pieceId: string }) {
  const { t } = useI18n();
  return <EmptyState title={t('editor3d.noModelTitle')} hint={t('editor3d.noModelHint')}
    action={<Link className="btn" href={`/pieces/${encodeURIComponent(pieceId)}`}>{t('editor3d.backToPiece')}</Link>} />;
}
