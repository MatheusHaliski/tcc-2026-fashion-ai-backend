/** Seven-segment display for real scores. Text remains available to assistive technology. */
const SEGMENTS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc',
  '5': 'afgcd', '6': 'afgecd', '7': 'abc', '8': 'abcdefg', '9': 'abfgcd',
};
const SHAPES: Record<string, string> = {
  a: '5,0 25,0 28,3 24,6 8,6 2,3', b: '27,4 30,7 30,20 27,23 24,20 24,8',
  c: '27,25 30,28 30,41 27,44 24,40 24,28', d: '5,42 25,42 28,45 24,48 8,48 2,45',
  e: '3,25 6,28 6,40 3,44 0,41 0,28', f: '3,4 6,8 6,20 3,23 0,20 0,7',
  g: '6,21 24,21 27,24 24,27 6,27 3,24',
};
export function LedNumber({ value, className = '' }: { value: number; className?: string }) {
  const text = Number.isFinite(value) ? String(Math.round(value)) : '—';
  return <span className={`led-number ${className}`} style={{ width: `${text.length * .82}em` }}><span className="sr-only">{text}</span>
    <svg viewBox={`0 0 ${text.length * 38} 50`} aria-hidden="true" focusable="false">
      {[...text].map((digit, index) => <g key={index} transform={`translate(${index * 38 + 3},1)`}>
        {Object.entries(SHAPES).map(([segment, points]) => <polygon key={segment} points={points} className={SEGMENTS[digit]?.includes(segment) || digit === '—' && segment === 'g' ? 'is-lit' : undefined} />)}
      </g>)}
    </svg>
  </span>;
}
