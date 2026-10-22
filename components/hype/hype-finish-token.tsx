import { useId } from 'react';
import type { AuraHypeCardLevel } from '@/lib/hype/types';

const METALS = {
  COMMON: { light: '#efbd90', base: '#b87333', dark: '#71401f' },
  RARE: { light: '#f5f7fa', base: '#b7c0cb', dark: '#596777' },
  LEGENDARY: { light: '#fff0a1', base: '#e6b431', dark: '#886008' },
  COLLAB_DROP: { light: '#f9ddff', base: '#be8ee9', dark: '#70449e' },
} as const;

/** FAI token language: espresso rim, orange halo and cream medallion.
 * The centre represents the finish itself; it does not imply the user's XP rank.
 * Inline vectors remain visible when an external icon PNG fails to load. */
export function HypeFinishToken({ finish }: { finish: AuraHypeCardLevel }) {
  const id = useId();
  const metal = METALS[finish];
  return <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" focusable="false" data-fai-finish-token={finish}>
    <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop stopColor={metal.light}/><stop offset=".48" stopColor={metal.base}/><stop offset="1" stopColor={metal.dark}/></linearGradient></defs>
    <circle cx="32" cy="32" r="31" fill="#2a211c"/>
    <circle cx="32" cy="32" r="26" fill="#f57c1f"/>
    <circle cx="32" cy="32" r="22" fill="#f5ebd7"/>
    {finish === 'COLLAB_DROP' ? <g fill={`url(#${id})`} stroke={metal.dark} strokeWidth="1.5" strokeLinejoin="round" data-finish-shape="stars">
      <path d="m28 17 4.5 9.2 10.2 1.5-7.4 7.2 1.7 10.2-9-4.8-9 4.8 1.7-10.2-7.4-7.2 10.2-1.5z"/>
      <path d="m45 17 1.7 3.4 3.8.6-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.7 3.8-.6z"/>
      <path d="m43 39 1.3 2.6 2.9.4-2.1 2.1.5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2.1 2.9-.4z"/>
    </g> : <g data-finish-shape="medal">
      <path d="m23 36-3 14 8-4 4 4 2-14m-2 0 2 14 4-4 6 4-3-14" fill={metal.dark}/>
      <circle cx="32" cy="29" r="14" fill={`url(#${id})`} stroke={metal.dark} strokeWidth="1.5"/>
      <circle cx="32" cy="29" r="10.5" fill="none" stroke={metal.light} strokeWidth="1.5"/>
      <path d="m32 21 2.3 4.8 5.3.8-3.8 3.7.9 5.3-4.7-2.5-4.7 2.5.9-5.3-3.8-3.7 5.3-.8z" fill={metal.dark}/>
    </g>}
  </svg>;
}

/** Separate high-contrast lock; never hidden by the decorative finish token. */
export function HypeLockToken() {
  return <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" focusable="false" data-fai-lock>
    <circle cx="14" cy="14" r="13" fill="#f5ebd7" stroke="#f57c1f" strokeWidth="2"/>
    <path d="M10 12V9a4 4 0 0 1 8 0v3" fill="none" stroke="#2a211c" strokeWidth="2.2"/>
    <rect x="7.5" y="11.5" width="13" height="10.5" rx="2.5" fill="#2a211c"/>
    <circle cx="14" cy="16" r="1.3" fill="#f5ebd7"/><path d="M14 17v2" stroke="#f5ebd7" strokeWidth="1.5"/>
  </svg>;
}
