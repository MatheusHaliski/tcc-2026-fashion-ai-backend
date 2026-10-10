/**
 * Medidor semicircular 0–100 (reaproveitado do card "Hype Focus" das anatomias). A cor é decorativa: o número e o rótulo
 * em texto ao lado carregam a informação.
 */
export function HypeScoreGauge({ value, size = 92, color = "var(--thread)", suffix = "", text }: { value: number; size?: number; color?: string; suffix?: string; text?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={Math.round(size * 0.58)} viewBox="0 0 92 54" aria-hidden className="hype-gauge">
      <path d="M8 48 A38 38 0 0 1 84 48" fill="none" stroke="var(--line-soft)" strokeWidth="9" strokeLinecap="round" />
      <path d="M8 48 A38 38 0 0 1 84 48" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(v / 100) * 119.4} 200`} />
      <text x="46" y="45" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">{text ?? `${Math.round(v)}${suffix}`}</text>
    </svg>
  );
}
