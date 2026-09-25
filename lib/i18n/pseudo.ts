/**
 * Pseudolocalização (QA de i18n): troca letras por equivalentes acentuadas, alonga ~30% e envolve em colchetes.
 * Todo texto que vier do catálogo aparece assim; texto que aparecer "normal" está embutido no código.
 */
const MAP: Record<string, string> = {
  a: "á", b: "ƀ", c: "ç", d: "ð", e: "é", f: "ƒ", g: "ğ", h: "ĥ", i: "í", j: "ĵ", k: "ķ", l: "ł", m: "ɱ", n: "ñ", o: "ó", p: "þ",
  q: "ǫ", r: "ř", s: "š", t: "ŧ", u: "ú", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "Á", B: "Ɓ", C: "Ç", D: "Ð", E: "É", F: "Ƒ", G: "Ğ", H: "Ĥ", I: "Í", J: "Ĵ", K: "Ķ", L: "Ł", M: "Ṁ", N: "Ñ", O: "Ó", P: "Þ",
  Q: "Ǫ", R: "Ř", S: "Š", T: "Ŧ", U: "Ú", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
};

export function pseudo(text: string): string {
  if (!text || text.trim().length < 2 || !/[A-Za-z]/.test(text)) return text;
  let out = "";
  for (const ch of text) out += MAP[ch] ?? ch;
  const letters = text.replace(/[^A-Za-z]/g, "").length;
  const pad = "~".repeat(Math.max(1, Math.round(letters * 0.3)));
  return `[${out} ${pad}]`;
}
