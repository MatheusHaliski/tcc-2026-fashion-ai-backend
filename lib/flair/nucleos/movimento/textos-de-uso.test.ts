import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AJUDA_DO_CONSOLE } from "@/lib/flair/nucleos/controle/perfil-console";

/**
 * As chaves montadas em tempo de execução na fase de uso dos jogos de zonas (o lance da carta, o efeito, o momento-chave)
 * não aparecem literais no código, então a varredura de i18n não as vê: este teste segura o catálogo (um merge já as
 * apagou duas vezes sem nenhum aviso).
 */
const msgs = (l: string) => JSON.parse(readFileSync(join(process.cwd(), `lib/i18n/messages/${l}.json`), "utf8")) as Record<string, string>;
const IDIOMAS = { "pt-BR": msgs("pt-BR"), en: msgs("en"), es: msgs("es") };

const LANCES = ["CARRINHO", "ARRANCADA", "DRIBLE", "TABELA", "CHUTE", "GOLEIRO", "SILHUETA", "COREOGRAFIA", "HOLOFOTE", "GRAVE", "AGUDO", "FUMACA",
  "FREIO", "PISTA_LIVRE", "VACUO", "ADERENCIA", "TURBO", "BANDEIRA", "SOMBRA", "CURA", "LUZ", "VOO", "RAIO", "CAMPO_DE_FORCA", "METAMORFOSE"];
const OPCOES = ["ESQUERDA", "DIREITA", "REVELAR", "FECHAR", "MACIO", "CHUVA", "ESCUDO", "SALTO"];
const CONDICOES = ["GOLEIRO_DIREITA", "GOLEIRO_ESQUERDA", "REFRAO_EXPLODE", "REFRAO_BALADA", "PISTA_SECA", "PISTA_MOLHADA", "ATAQUE_AEREO", "ATAQUE_TERRESTRE"];

const CHAVES = [
  ...LANCES.map((l) => `flair3d.uso.lance.${l}`),
  ...["EMBALO", "FOLEGO", "ESCUDO", "METAMORFOSE"].map((e) => `flair3d.uso.efeito.${e}`),
  ...["PENALTI", "VIRADA", "PIT_STOP", "AMEACA"].map((m) => `flair3d.uso.chave.momento.${m}`),
  ...OPCOES.flatMap((o) => [`flair3d.uso.chave.opcao.${o}`, `flair3d.uso.chave.curta.${o}`]),
  ...CONDICOES.flatMap((c) => [`flair3d.uso.chave.condicao.${c}`, `flair3d.uso.chave.curta.${c}`]),
  ...["CHAVE", "DEFENDIDO"].map((n) => `flair3d.execucao.nota.${n}`),
  ...["titulo", "vazia", "recarga", "torcida"].map((k) => `flair3d.uso.mao.${k}`),
  ...["cartas", "roda", "seguir"].map((k) => `flair3d.uso.console.${k}`),
  ...AJUDA_DO_CONSOLE.map((l) => `flair3d.console.acao.${l.acao}`),
];

describe("textos da fase de uso dos jogos de zonas", () => {
  it("toda chave montada em tempo de execução está nos três idiomas", () => {
    for (const [l, m] of Object.entries(IDIOMAS)) {
      expect(CHAVES.filter((k) => !m[k]), l).toEqual([]);
    }
  });
});
