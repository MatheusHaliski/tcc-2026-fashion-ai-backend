/**
 * Símbolos de cuidado desenhados no próprio app: formas simples e genéricas (bacia, triângulo, quadrado com círculo,
 * ferro, círculo e quadrado de secagem), sem reproduzir arte registrada de terceiros. Traço em currentColor.
 */
export type CareSlot = 'wash' | 'bleach' | 'tumble' | 'iron' | 'dryClean' | 'naturalDry';

const cross = <path d="M6 6 34 34M34 6 6 34" />;
const dots = (n: number, cx: number, cy: number) => Array.from({ length: n }, (_, i) => <circle key={i} cx={cx + (i - (n - 1) / 2) * 6} cy={cy} r="1.8" fill="currentColor" stroke="none" />);

function Wash({ code }: { code: string }) {
  return <>
    <path d="M5 13 9 33H31L35 13" />
    <path d="M5 13Q9 9 13 13T21 13T29 13T35 13" />
    {code === 'HAND_30' && <path d="M15 27V20M18 27V18M21 27V18M24 27V20M15 27Q19 31 24 27" />}
    {code.startsWith('MACHINE') && <text x="20" y="28" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor" stroke="none">{code === 'MACHINE_40' ? 40 : 30}</text>}
    {code === 'MACHINE_30_GENTLE' && <path d="M9 37H31" />}
    {code === 'DO_NOT_WASH' && cross}
  </>;
}

function Bleach({ code }: { code: string }) {
  return <>
    <path d="M20 6 35 33H5Z" />
    {code === 'NON_CHLORINE' && <path d="M15 31 22 15M20 31 27 17" />}
    {code === 'DO_NOT_BLEACH' && cross}
  </>;
}

function Tumble({ code }: { code: string }) {
  return <>
    <rect x="6" y="6" width="28" height="28" rx="2" />
    <circle cx="20" cy="20" r="10" />
    {code === 'TUMBLE_LOW' && dots(1, 20, 20)}
    {code === 'TUMBLE_MEDIUM' && dots(2, 20, 20)}
    {code === 'DO_NOT_TUMBLE' && cross}
  </>;
}

function Iron({ code }: { code: string }) {
  const level = code === 'IRON_LOW' ? 1 : code === 'IRON_MEDIUM' ? 2 : code === 'IRON_HIGH' ? 3 : 0;
  return <>
    <path d="M5 30H35L31 16Q29 12 24 12H14Q12 12 12 15V18" />
    <path d="M12 18H32" />
    {dots(level, 21, 24)}
    {code === 'DO_NOT_IRON' && cross}
  </>;
}

function DryClean({ code }: { code: string }) {
  return <>
    <circle cx="20" cy="20" r="13" />
    {code === 'PROFESSIONAL_ONLY' && <circle cx="20" cy="20" r="8" />}
    {code === 'DRY_CLEAN' && <path d="M17 26V14H22Q26 14 26 18T22 22H17" />}
    {code === 'DO_NOT_DRY_CLEAN' && cross}
  </>;
}

function NaturalDry({ code }: { code: string }) {
  return <>
    <rect x="6" y="6" width="28" height="28" rx="2" />
    {code.startsWith('LINE_DRY') && <path d="M20 11V29" />}
    {code.startsWith('FLAT_DRY') && <path d="M11 20H29" />}
    {code.endsWith('SHADE') && <path d="M6 13 13 6M6 18 18 6" />}
  </>;
}

const SLOTS: Record<CareSlot, (props: { code: string }) => React.ReactNode> = { wash: Wash, bleach: Bleach, tumble: Tumble, iron: Iron, dryClean: DryClean, naturalDry: NaturalDry };

export function CareIcon({ slot, code, size = 40 }: { slot: CareSlot; code: string; size?: number }) {
  const Symbol = SLOTS[slot];
  return <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false" className="care-symbol"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Symbol code={code} />
  </svg>;
}
