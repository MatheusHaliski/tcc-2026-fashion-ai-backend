import type { Metadata } from 'next';
import { PassportPublic } from '@/components/passport/passport-public';
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';
export default async function SharedPassportPage({ params }: { params: Promise<{ token: string }> }) {
  return <PassportPublic token={(await params).token} />;
}
