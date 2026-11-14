/**
 * Nome curto do aparelho de uma sessão a partir do texto bruto do navegador (User-Agent): "Chrome no Windows",
 * "Safari no iPhone". Texto que não é um User-Agent (um nome que o servidor já mandou pronto) volta como veio.
 */
const BROWSERS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/HeadlessChrome\/|Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "Mac"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

export interface SessionDevice {
  browser: string | null;
  system: string | null;
}

/** Navegador e sistema reconhecidos no User-Agent; `null` no que não foi reconhecido. */
export function parseSessionDevice(raw: string | null | undefined): SessionDevice {
  const ua = raw ?? "";
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1] ?? null;
  const system = SYSTEMS.find(([re]) => re.test(ua))?.[1] ?? null;
  return { browser, system };
}

/** O texto do servidor parece um User-Agent bruto ("Mozilla/5.0 (…) AppleWebKit/…")? */
export function looksLikeUserAgent(raw: string | null | undefined): boolean {
  return /Mozilla\/|AppleWebKit\/|Gecko\//.test(raw ?? "");
}
