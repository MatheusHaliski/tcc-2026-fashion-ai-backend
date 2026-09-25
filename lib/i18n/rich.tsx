/**
 * Mensagens com marcação: "Leia os <0>termos</0>" → o `rich()` troca cada tag numerada por um elemento React
 * (negrito, link, quebra de linha) mantendo a frase inteira como uma única unidade de tradução.
 */
import { Fragment, type ReactNode } from "react";
import { formatIcu, isTag, parseIcu, type IcuNode, type IcuVars } from "./icu";
import { resolveMessage } from "./core";
import { pseudo } from "./pseudo";
import { PSEUDO_LOCALE, getCurrentLocale, intlOf, type Locale } from "./state";

export type RichTags = Record<string, (chunks: ReactNode) => ReactNode>;

function render(nodes: IcuNode[], vars: IcuVars, locale: string, tags: RichTags | undefined, pseudoize: boolean): ReactNode[] {
  return nodes.map((n, i) => {
    if (typeof n === "string") return pseudoize ? pseudo(n) : n;
    if (isTag(n)) {
      const inner = render(n.children, vars, locale, tags, pseudoize);
      const factory = tags?.[n.tag];
      return <Fragment key={i}>{factory ? factory(inner) : inner}</Fragment>;
    }
    const text = formatIcu([n], vars, locale);
    return pseudoize ? pseudo(text) : text;
  });
}

export function translateRich(locale: Locale, key: string, vars?: IcuVars, tags?: RichTags): ReactNode {
  const msg = resolveMessage(locale, key);
  return render(parseIcu(msg), vars, intlOf(locale), tags, locale === PSEUDO_LOCALE);
}

/** Versão para módulos sem React (idioma corrente). */
export const trRich = (key: string, vars?: IcuVars, tags?: RichTags) => translateRich(getCurrentLocale(), key, vars, tags);
