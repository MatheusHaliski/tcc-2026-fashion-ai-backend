/**
 * Contração da preposição com o artigo nas frases montadas do Fashion Detective ("Pegar o papel do bolso de {assunto}"
 * com "o segurança do salão" dava "de o segurança"). Só as contrações que as frases montadas produzem: em português,
 * de + o/a/os/as e em + o/a; em espanhol, de + el e a + el. Puro.
 */
const PT: [RegExp, string][] = [
  [/\bde o(s?)\b/g, "do$1"],
  [/\bde a(s?)\b/g, "da$1"],
  [/\bem o(s?)\b/g, "no$1"],
  [/\bem a(s?)\b/g, "na$1"],
];
const ES: [RegExp, string][] = [
  [/\bde el\b/g, "del"],
  [/\ba el\b/g, "al"],
];

export function contrair(frase: string, locale: string): string {
  const regras = locale.startsWith("pt") ? PT : locale.startsWith("es") ? ES : [];
  return regras.reduce((acc, [de, para]) => acc.replace(de, para), frase);
}
