import { afterEach, describe, expect, it } from "vitest";
import { __setTaxonomyCache, label, subcategoryLabel, type Taxonomy } from "@/lib/api/taxonomy";
import { setCurrentLocale } from "@/lib/i18n/state";

describe("subcategoryLabel", () => {
  afterEach(() => { __setTaxonomyCache(null); setCurrentLocale("pt-BR"); });

  it("top e boots não caem no rótulo de categoria nem ficam sem tradução", () => {
    setCurrentLocale("pt-BR");
    expect(label("top")).toBe("Parte de cima");          // chave de categoria continua igual
    expect(subcategoryLabel("top")).toBe("Top");
    expect(subcategoryLabel("boots")).toBe("Bota");
    setCurrentLocale("es");
    expect(subcategoryLabel("top")).toBe("Top");
    expect(subcategoryLabel("boots")).toBe("Botas");
  });

  it("usa os rótulos do servidor quando a taxonomia já chegou", () => {
    __setTaxonomyCache({ subcategoryLabels: { boots: { "pt-BR": "Botas (servidor)", en: "Boots", es: "Botas" } } } as unknown as Taxonomy);
    setCurrentLocale("pt-BR");
    expect(subcategoryLabel("boots")).toBe("Botas (servidor)");
    setCurrentLocale("en");
    expect(subcategoryLabel("boots")).toBe("Boots");
    expect(subcategoryLabel("jeans")).toBe(label("jeans"));  // sem rótulo do servidor: tabela estática
  });
});
