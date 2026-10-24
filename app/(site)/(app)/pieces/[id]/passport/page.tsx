'use client';
import { use } from 'react';
import { PassportEditor } from '@/components/passport/passport-editor';
export default function PiecePassportPage({ params }: { params: Promise<{ id: string }> }) {
  return <PassportEditor pieceId={use(params).id} />;
}
